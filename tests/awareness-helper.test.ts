import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { spawn } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppAwareness } from '../src/main/platform/awareness';
import { awarenessScript } from '../src/main/platform/awareness-script';
function fakeChild() {
  return Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill: vi.fn(() => true) });
}
afterEach(() => vi.useRealTimers());
describe('foreground helper lifecycle', () => {
  it('is off by default, starts one hidden helper, parses chunked lines, and kills on disable', () => {
    const child = fakeChild(); const spawnMock = vi.fn(() => child); const sample = vi.fn(); const status = vi.fn();
    const helper = new AppAwareness(sample, status, () => [42], spawnMock as unknown as typeof spawn);
    helper.configure(false); expect(spawnMock).not.toHaveBeenCalled();
    helper.configure(true); helper.configure(true); expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(spawnMock.mock.calls[0]).toEqual(['powershell.exe', expect.arrayContaining(['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command']), { windowsHide: true, stdio: 'pipe' }]);
    child.stdout.write('garbage\nchrome.ex'); expect(sample).not.toHaveBeenCalled();
    child.stdout.write('e|0\r\n'); expect(sample).toHaveBeenCalledWith({ app: { name: 'Chrome', category: 'browser' }, fullscreen: false });
    helper.configure(false); expect(child.kill).toHaveBeenCalledTimes(1); expect(status).toHaveBeenLastCalledWith(false);
    child.stdout.write('figma.exe|0\n'); expect(sample).toHaveBeenCalledTimes(1);
    child.emit('close'); helper.dispose(); expect(spawnMock).toHaveBeenCalledTimes(1);
  });
  it('waits for termination before starting again during rapid off/on toggles', () => {
    const children = [fakeChild(), fakeChild()]; const spawnMock = vi.fn().mockReturnValueOnce(children[0]).mockReturnValueOnce(children[1]);
    const helper = new AppAwareness(vi.fn(), vi.fn(), () => [], spawnMock as typeof spawn);
    helper.configure(true); helper.configure(false); helper.configure(true);
    expect(spawnMock).toHaveBeenCalledTimes(1); children[0].emit('close'); expect(spawnMock).toHaveBeenCalledTimes(2);
    helper.dispose(); expect(children[1].kill).toHaveBeenCalledTimes(1); children[1].emit('close');
  });
  it('restarts at most three times with backoff, then stops without an infinite loop', () => {
    vi.useFakeTimers(); const children: ReturnType<typeof fakeChild>[] = [];
    const spawnMock = vi.fn(() => { const child = fakeChild(); children.push(child); return child; });
    const helper = new AppAwareness(vi.fn(), vi.fn(), () => [], spawnMock as unknown as typeof spawn);
    const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
    helper.configure(true);
    for (const [index, delay] of [1000, 2000, 4000].entries()) {
      children[index].emit('error', new Error('failed')); children[index].emit('close');
      vi.advanceTimersByTime(delay - 1); expect(spawnMock).toHaveBeenCalledTimes(index + 1);
      vi.advanceTimersByTime(1); expect(spawnMock).toHaveBeenCalledTimes(index + 2);
    }
    children[3].emit('close'); vi.advanceTimersByTime(60000); expect(spawnMock).toHaveBeenCalledTimes(4); expect(log).toHaveBeenCalledTimes(1);
    helper.dispose(); expect(vi.getTimerCount()).toBe(0); log.mockRestore();
  });
  it('cancels a scheduled restart when paused/hidden/disposed', () => {
    vi.useFakeTimers(); const child = fakeChild(); const spawnMock = vi.fn(() => child);
    const helper = new AppAwareness(vi.fn(), vi.fn(), () => [], spawnMock as unknown as typeof spawn);
    helper.configure(true); child.emit('close'); helper.dispose(); vi.advanceTimersByTime(60000);
    expect(spawnMock).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
  });
  it('restricts the script to identity/geometry APIs and guards against orphaning', () => {
    const script = awarenessScript(123, [456]);
    for (const api of ['GetForegroundWindow', 'GetWindowThreadProcessId', 'QueryFullProcessImageName', 'MonitorFromWindow', 'GetMonitorInfo', 'WaitForSingleObject']) expect(script).toContain(api);
    for (const forbidden of ['GetWindowText', 'Get-Process', 'MainWindowTitle', 'CopyFromScreen', 'GetClipboardData']) expect(script).not.toContain(forbidden);
    expect(script).toContain('OpenProcess(0x1000'); expect(script).toContain('Start-Sleep -Milliseconds 3000');
    expect(script).toContain('Array.IndexOf(own, pid)'); expect(script).toContain('return "private" + suffix');
  });
});
