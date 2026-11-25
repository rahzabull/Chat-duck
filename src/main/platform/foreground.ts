import { execFileSync } from 'node:child_process';

const validHwnd = (value: string): boolean => /^[1-9][0-9]{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n;
/** Only opaque window handles. No process identities, titles, or sampled-window fallback. */
export const foregroundScript = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class DuckyFocus {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hwnd);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hwnd);
}
'@
`;

export class ForegroundFocus {
  constructor(private run = execFileSync, private platform = process.platform) {}
  private command(code: string): string | undefined {
    if (this.platform !== 'win32') return;
    try {
      return this.run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-Command', foregroundScript + code],
        { windowsHide: true, encoding: 'utf8', timeout: 3000, maxBuffer: 4096, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    } catch { return; }
  }
  capture(): string | undefined {
    // Block the open path until GetForegroundWindow returns, before Ducky can activate.
    const hwnd = this.command('[Console]::Write([DuckyFocus]::GetForegroundWindow().ToInt64())');
    return hwnd && validHwnd(hwnd) ? hwnd : undefined;
  }
  restore(hwnd: string): boolean {
    if (!validHwnd(hwnd)) return false;
    // Wait for the actual Win32 result before Electron drops focusability.
    return this.command(`$duckyTarget = [IntPtr][long]${hwnd}; [Console]::Write([DuckyFocus]::IsWindow($duckyTarget) -and [DuckyFocus]::SetForegroundWindow($duckyTarget))`) === 'True';
  }
}
