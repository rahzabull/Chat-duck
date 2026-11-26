import { isExcludedApps } from '../../shared/schemas/settings';
import { PRIVATE_TITLE_PATTERN } from '../../core/awareness/title';
import { PRIVATE_EXE_PATTERN } from '../../core/awareness';
import { captureMethods } from './capture-script';

/** Optional title APIs are absent from the script unless separately authorized. */
export function awarenessScript(parentPid: number, ownPids: number[], identity = true, titles = false, screen = false, excludedApps: string[] = []): string {
  if (!isExcludedApps(excludedApps)) throw new Error('Invalid exclusions');
  if (![parentPid, ...ownPids].every(Number.isSafeInteger)) throw new Error('Invalid process id');
  let script = `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.IO;
using System.Runtime.InteropServices;
public static class DuckyForeground {
  public static volatile bool InputClosed;
  public static volatile uint[] Own;
  public static System.Threading.AutoResetEvent Wake = new System.Threading.AutoResetEvent(false);
  public static void Listen(uint[] own) {
    Own = own;
    // Console.In.ReadLineAsync can block synchronously on Windows PowerShell's
    // synchronized reader. A managed background thread sleeps on the pipe instead.
    var reader = new System.Threading.Thread(() => {
      try {
        string line;
        while ((line = Console.ReadLine()) != null) {
          if (line == "sample") { Wake.Set(); continue; }
          if (!System.Text.RegularExpressions.Regex.IsMatch(line, @"\\A[0-9]+(,[0-9]+)*\\z")) continue;
          string[] parts = line.Split(','); uint[] ids = new uint[parts.Length]; bool valid = true;
          for (int i = 0; i < parts.Length; i++) if (!UInt32.TryParse(parts[i], out ids[i])) { valid = false; break; }
          if (valid) Own = ids;
        }
      } catch (IOException) { } finally { InputClosed = true; }
    });
    reader.IsBackground = true; reader.Start();
  }
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [StructLayout(LayoutKind.Sequential)] public struct MONITORINFO { public int Size; public RECT Monitor, Work; public uint Flags; }
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool QueryFullProcessImageName(IntPtr process, uint flags, StringBuilder name, ref uint size);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
  [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr handle, uint ms);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
  [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr hwnd, uint flags);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern bool GetMonitorInfo(IntPtr monitor, ref MONITORINFO info);
  [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
  public static IntPtr Parent(uint pid) { SetProcessDPIAware(); return OpenProcess(0x00100000, false, pid); }
  public static bool Alive(IntPtr parent) { return parent != IntPtr.Zero && WaitForSingleObject(parent, 0) == 258; }
  public static void Close(IntPtr parent) { if (parent != IntPtr.Zero) CloseHandle(parent); }
  public static string Sample(uint[] own) {
    IntPtr hwnd = GetForegroundWindow(); uint pid;
    if (hwnd == IntPtr.Zero) return "unknown|0|0";
    GetWindowThreadProcessId(hwnd, out pid);
    RECT rect; MONITORINFO info = new MONITORINFO(); info.Size = Marshal.SizeOf(info);
    bool fullscreen = GetWindowRect(hwnd, out rect) && GetMonitorInfo(MonitorFromWindow(hwnd, 2), ref info)
      && rect.L <= info.Monitor.L && rect.T <= info.Monitor.T && rect.R >= info.Monitor.R && rect.B >= info.Monitor.B;
    string suffix = (fullscreen ? "|1|" : "|0|") + hwnd.ToInt64();
    IntPtr process = OpenProcess(0x1000, false, pid); // PROCESS_QUERY_LIMITED_INFORMATION
    if (process == IntPtr.Zero) return "unknown" + suffix;
    try {
      uint size = 32768; StringBuilder path = new StringBuilder((int)size);
      if (!QueryFullProcessImageName(process, 0, path, ref size)) return "unknown" + suffix;
      string exe = Path.GetFileName(path.ToString()).ToLowerInvariant();
      if ((exe == "electron.exe" || exe == "ducky.exe") && Array.IndexOf(own, pid) >= 0) return "self" + suffix;
      if (Array.IndexOf(new string[] { ${excludedApps.map(name => JSON.stringify(name.toLowerCase())).join(',')} }, exe) >= 0) return "private" + suffix;
      if (System.Text.RegularExpressions.Regex.IsMatch(exe, @"${PRIVATE_EXE_PATTERN}", System.Text.RegularExpressions.RegexOptions.IgnoreCase)) return "private" + suffix;
      if (!System.Text.RegularExpressions.Regex.IsMatch(exe, @"^[a-zA-Z0-9][a-zA-Z0-9 ._+()-]{0,100}\\.exe$")) return "unknown" + suffix;
      return exe + suffix;
    } finally { CloseHandle(process); }
  }
}
'@
$duckyParent = [DuckyForeground]::Parent(${parentPid})
[uint32[]]$duckyOwn = @(${[parentPid, ...ownPids].join(',')})
[DuckyForeground]::Listen($duckyOwn)
try {
  while ([DuckyForeground]::Alive($duckyParent) -and -not [DuckyForeground]::InputClosed) {
    [Console]::Out.WriteLine([DuckyForeground]::Sample([DuckyForeground]::Own))
    [Console]::Out.Flush()
    [void][DuckyForeground]::Wake.WaitOne(3000)
  }
} finally { [DuckyForeground]::Close($duckyParent) }
`;
  if (!identity) {
    script = script.replace(/    IntPtr process = OpenProcess\(0x1000,[\s\S]*?    } finally { CloseHandle\(process\); }/, '    return "unknown" + suffix;');
    script = script.replace(/  \[DllImport\("kernel32.dll", CharSet=CharSet.Unicode[^\n]+QueryFullProcessImageName[^\n]+\n/, '');
    script = script.replace(/  \[DllImport\("user32.dll"\)\] static extern uint GetWindowThreadProcessId[^\n]+\n/, '');
    script = script.replace('IntPtr hwnd = GetForegroundWindow(); uint pid;', 'IntPtr hwnd = GetForegroundWindow();').replace('    GetWindowThreadProcessId(hwnd, out pid);', '');
  }
  if (identity && (titles || screen)) {
    script = script.replace('  public static IntPtr Parent', '  [DllImport("user32.dll", EntryPoint="GetWindowTextW", CharSet=CharSet.Unicode)] static extern int GetWindowTextW(IntPtr hwnd, StringBuilder title, int count);\n  public static IntPtr Parent');
    script = script.replace('      return exe + suffix;', `      StringBuilder titleBuffer = new StringBuilder(201);
      GetWindowTextW(hwnd, titleBuffer, 201);
      string title = System.Text.RegularExpressions.Regex.Replace(titleBuffer.ToString(), @"[\\p{Cc}\\p{Cf}]", "");
      if (System.Text.RegularExpressions.Regex.IsMatch(title, @"${PRIVATE_TITLE_PATTERN}", System.Text.RegularExpressions.RegexOptions.IgnoreCase)) return "private" + suffix;
      // A browser with no readable title cannot be safely classified.
      if (title.Length == 0 && System.Text.RegularExpressions.Regex.IsMatch(exe, @"^(chrome|msedge|firefox|brave|opera|vivaldi|arc)\\.exe$")) return "private" + suffix;
      return exe + suffix + "|" + ${titles ? 'Convert.ToBase64String(Encoding.UTF8.GetBytes(title))' : '""'};`);
  }
  if (identity && screen) {
    script = script.replace("Add-Type -TypeDefinition", "Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition");
    script = script.replace('          if (line == "sample")', '          if (line.StartsWith("capture")) { QueueCapture(line); continue; }\n          if (line == "sample")');
    script = script.replace('    IntPtr hwnd = GetForegroundWindow(); uint pid;', '    return Inspect(GetForegroundWindow(), own);\n  }\n  static string Inspect(IntPtr hwnd, uint[] own) {\n    uint pid;');
    script = script.replace("\n}\n'@", `${captureMethods}\n}\n'@`);
    script = script.replace('    [Console]::Out.WriteLine', '    [DuckyForeground]::FlushCapture()\n    [Console]::Out.WriteLine');
  }
  return script;
}
