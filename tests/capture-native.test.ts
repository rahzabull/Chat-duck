import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';
import { awarenessScript } from '../src/main/platform/awareness-script';

it.skipIf(process.platform !== 'win32')('runs native capture gates and JPEG encoding against synthetic windows only', () => {
  let definition = awarenessScript(process.pid, [], true, false, true, ['secret-editor.exe']).split('$duckyParent =')[0];
  // Replace EVERY Win32 import. The actual production policy and encoder run,
  // but this fixture cannot inspect or render any desktop window.
  const stubs: Record<string, string> = {
    GetForegroundWindow: 'static IntPtr GetForegroundWindow() { return new IntPtr(Mode == "foreground" ? 43 : 42); }',
    GetWindowThreadProcessId: 'static uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid) { pid = Mode == "self" ? 123u : 456u; return 1; }',
    OpenProcess: 'static IntPtr OpenProcess(uint access, bool inherit, uint pid) { return Mode == "unavailable" ? IntPtr.Zero : new IntPtr(1); }',
    QueryFullProcessImageName: 'static bool QueryFullProcessImageName(IntPtr process, uint flags, StringBuilder name, ref uint size) { name.Append(Exe); return true; }',
    CloseHandle: 'static bool CloseHandle(IntPtr handle) { return true; }',
    WaitForSingleObject: 'static uint WaitForSingleObject(IntPtr handle, uint ms) { return 258; }',
    GetWindowRect: 'static bool GetWindowRect(IntPtr hwnd, out RECT rect) { rect = new RECT { R = Mode == "size" ? 20000 : 1920, B = 1080 }; return true; }',
    MonitorFromWindow: 'static IntPtr MonitorFromWindow(IntPtr hwnd, uint flags) { return new IntPtr(1); }',
    GetMonitorInfo: 'static bool GetMonitorInfo(IntPtr monitor, ref MONITORINFO info) { info.Monitor = new RECT { R = Mode == "fullscreen" ? 1920 : 2560, B = Mode == "fullscreen" ? 1080 : 1440 }; return Mode != "geometry"; }',
    SetProcessDPIAware: 'static bool SetProcessDPIAware() { return true; }',
    GetWindowTextW: 'static int GetWindowTextW(IntPtr hwnd, StringBuilder title, int count) { TitleReads++; title.Append(Title); return Title.Length; }',
    IsWindow: 'static bool IsWindow(IntPtr hwnd) { return true; }',
    IsIconic: 'static bool IsIconic(IntPtr hwnd) { return Mode == "minimized"; }',
    PrintWindow: `static bool PrintWindow(IntPtr hwnd, IntPtr hdc, uint flags) {
      Renders++; if (hwnd.ToInt64() != 42 || flags != 2) throw new Exception("Wrong capture target");
      if (Mode == "render") return false;
      using (var graphics = System.Drawing.Graphics.FromHdc(hdc)) { graphics.Clear(System.Drawing.Color.CornflowerBlue); }
      if (Mode == "changed") Mode = "foreground";
      return true;
    }`,
  };
  definition = definition.replace(/\[DllImport\([^\n]+?\)\] static extern [^\n]+? (\w+)\([^\n]+?;/g, (_match, name: string) => {
    expect(stubs[name], name).toBeDefined(); return stubs[name];
  });
  expect(definition).not.toContain('[DllImport');
  definition = definition.replace('public static volatile bool InputClosed;', `
    public static string Mode = "ok", Exe = "figma.exe", Title = "Canvas";
    public static int Renders, TitleReads;
    public static volatile bool InputClosed;
  `);
  const assertions = `
    [DuckyForeground]::Own = [uint32[]]@(123)
    foreach ($mode in @('foreground', 'minimized', 'self', 'fullscreen', 'unavailable', 'size', 'geometry')) {
      [DuckyForeground]::Mode = $mode
      $expected = if ($mode -eq 'geometry') { 'unavailable' } else { $mode }
      if ([DuckyForeground]::Capture('capture 42 1280 800') -ne "capture|skip|$expected") { throw "Wrong skip: $mode" }
      if ([DuckyForeground]::Renders -ne 0) { throw 'Rendered a forbidden window' }
    }
    [DuckyForeground]::Mode = 'ok'
    foreach ($exe in @('bitwarden.exe', 'whatsapp.exe', 'secret-editor.exe')) {
      [DuckyForeground]::Exe = $exe
      [DuckyForeground]::TitleReads = 0
      if ([DuckyForeground]::Capture('capture 42 1280 800') -ne 'capture|skip|private') { throw 'Private exe accepted' }
      if ([DuckyForeground]::Renders -ne 0 -or [DuckyForeground]::TitleReads -ne 0) { throw 'Read excluded app content' }
    }
    [DuckyForeground]::Exe = 'chrome.exe'
    foreach ($title in @('Gmail', 'Incognito', '')) {
      [DuckyForeground]::Title = $title
      if ([DuckyForeground]::Capture('capture 42 1280 800') -ne 'capture|skip|private') { throw 'Private title accepted' }
      if ([DuckyForeground]::Renders -ne 0) { throw 'Rendered private browser' }
    }
    [DuckyForeground]::Title = 'Canvas'
    foreach ($mode in @('render', 'changed')) {
      [DuckyForeground]::Mode = $mode
      $expected = if ($mode -eq 'changed') { 'foreground' } else { 'render' }
      if ([DuckyForeground]::Capture('capture 42 1280 800') -ne "capture|skip|$expected") { throw "Wrong post-render skip: $mode" }
    }
    [DuckyForeground]::Mode = 'ok'
    [DuckyForeground]::Renders = 0
    $reply = [DuckyForeground]::Capture('capture 42 1280 800')
    if (-not $reply.StartsWith('capture|ok|') -or $reply.Length -gt 409598 -or [DuckyForeground]::Renders -ne 1) { throw 'Invalid success reply' }
    $bytes = [Convert]::FromBase64String($reply.Substring(11))
    $stream = New-Object System.IO.MemoryStream(,$bytes)
    $image = [System.Drawing.Image]::FromStream($stream)
    try {
      if ($image.Width -ne 1280 -or $image.Height -ne 720) { throw 'Wrong scale or aspect ratio' }
      if ($image.RawFormat.Guid -ne [System.Drawing.Imaging.ImageFormat]::Jpeg.Guid) { throw 'Not JPEG' }
    } finally { $image.Dispose(); $stream.Dispose() }
    [Console]::Write('verified')
  `;
  expect(execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', definition + assertions],
    { windowsHide: true, timeout: 15000, encoding: 'utf8', stdio: 'pipe' })).toBe('verified');
}, 20000);
