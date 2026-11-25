import type { execFileSync } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import { ForegroundFocus, foregroundScript } from '../src/main/platform/foreground';

describe('synchronous foreground focus', () => {
  it('reads at open and restores precisely that handle, regardless of later foreground changes', () => {
    const run = vi.fn().mockReturnValueOnce('222\r\n').mockReturnValueOnce('True');
    const focus = new ForegroundFocus(run as unknown as typeof execFileSync, 'win32');
    const captured = focus.capture(); expect(captured).toBe('222');
    expect(focus.restore(captured!)).toBe(true);
    expect(run.mock.calls[0][1].at(-1)).toContain('GetForegroundWindow().ToInt64()');
    expect(run.mock.calls[1][1].at(-1)).toContain('[IntPtr][long]222');
    expect(run.mock.calls[1][1].at(-1)).toContain('IsWindow($duckyTarget) -and [DuckyFocus]::SetForegroundWindow($duckyTarget)');
    expect(run.mock.calls[0][2]).toMatchObject({ windowsHide: true, timeout: 3000 });
    expect(run.mock.calls[0][1]).toEqual(expect.arrayContaining(['-WindowStyle', 'Hidden']));
  });
  it.each(['', '0', '-1', '1.2', '1\nfg', '123\n', ' 123', '１２３', '9223372036854775808'])('refuses invalid restore handle %j', hwnd => {
    const run = vi.fn(); const focus = new ForegroundFocus(run as unknown as typeof execFileSync, 'win32');
    expect(focus.restore(hwnd)).toBe(false); expect(run).not.toHaveBeenCalled();
  });
  it('reports unavailable capture and failed restoration without stale fallback or errors', () => {
    const run = vi.fn().mockReturnValueOnce('222').mockImplementationOnce(() => { throw new Error('private system error'); }).mockReturnValueOnce('False').mockReturnValueOnce('0');
    const focus = new ForegroundFocus(run as unknown as typeof execFileSync, 'win32');
    expect(focus.capture()).toBe('222'); expect(focus.capture()).toBeUndefined();
    expect(focus.restore('222')).toBe(false); expect(focus.capture()).toBeUndefined();
  });
  it('does not launch on other platforms or collect titles/process identity', () => {
    const run = vi.fn(); const focus = new ForegroundFocus(run as unknown as typeof execFileSync, 'linux');
    expect(focus.capture()).toBeUndefined(); expect(focus.restore('222')).toBe(false); expect(run).not.toHaveBeenCalled();
    for (const name of ['GetWindowText', 'Get-Process', 'MainWindowTitle', 'QueryFullProcessImageName']) expect(foregroundScript).not.toContain(name);
  });
});
