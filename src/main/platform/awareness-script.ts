import { PRIVATE_EXE_PATTERN } from '../../core/awareness';

/** Only foreground process identity and window/monitor geometry. No title/content APIs. */
export function awarenessScript(parentPid: number, ownPids: number[], identity = true): string {
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
  public static void Listen(uint[] own) {
    Own = own;
    // Console.In.ReadLineAsync can block synchronously on Windows PowerShell's
    // synchronized reader. A managed background thread sleeps on the pipe instead.
    var reader = new System.Threading.Thread(() => {
      try {
        string line;
        while ((line = Console.ReadLine()) != null) {
          if (line == "fg") {
            Console.Out.WriteLine("hwnd|" + GetForegroundWindow().ToInt64()); Console.Out.Flush(); continue;
          }
          if (System.Text.RegularExpressions.Regex.IsMatch(line, @"\\Arestore [0-9]+\\z")) {
            long value;
            if (Int64.TryParse(line.Substring(8), out value) && value > 0 && (IntPtr.Size == 8 || value <= Int32.MaxValue)) {
              IntPtr hwnd = new IntPtr(value);
              if (IsWindow(hwnd)) SetForegroundWindow(hwnd);
            }
            continue;
          }
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
  [DllImport("user32.dll")] static extern bool IsWindow(IntPtr hwnd);
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hwnd);
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
    Start-Sleep -Milliseconds 3000
  }
} finally { [DuckyForeground]::Close($duckyParent) }
`;
  if (!identity) {
    script = script.replace(/    IntPtr process = OpenProcess\(0x1000,[\s\S]*?    } finally { CloseHandle\(process\); }/, '    return "unknown" + suffix;');
    script = script.replace(/  \[DllImport\("kernel32.dll", CharSet=CharSet.Unicode[^\n]+QueryFullProcessImageName[^\n]+\n/, '');
    script = script.replace(/  \[DllImport\("user32.dll"\)\] static extern uint GetWindowThreadProcessId[^\n]+\n/, '');
    script = script.replace('IntPtr hwnd = GetForegroundWindow(); uint pid;', 'IntPtr hwnd = GetForegroundWindow();').replace('    GetWindowThreadProcessId(hwnd, out pid);', '');
  }
  return script;
}
