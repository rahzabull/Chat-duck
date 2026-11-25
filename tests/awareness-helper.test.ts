import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { spawn, execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppAwareness } from '../src/main/platform/awareness';
import { ForegroundFocus } from '../src/main/platform/foreground';
import { awarenessScript } from '../src/main/platform/awareness-script';
function fakeChild() {
  return Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill: vi.fn(() => true) });
}
afterEach(() => vi.useRealTimers());
describe('foreground helper lifecycle', () => {
  it('captures synchronously even with awareness disabled and never uses a sampled handle', () => {
    const child = fakeChild(); const run = vi.fn().mockReturnValue('222');
    const focus = new ForegroundFocus(run as unknown as typeof execFileSync, 'win32');
    const helper = new AppAwareness(vi.fn(), vi.fn(), () => [], vi.fn(() => child) as unknown as typeof spawn, focus);
    expect(helper.captureForeground()).toBe('222');
    helper.configure(true); child.stdout.write('chrome.exe|0|111\n');
    run.mockImplementationOnce(() => { throw new Error('Timed out'); });
    expect(helper.captureForeground()).toBeUndefined();
    helper.configure(false); child.emit('close');
    run.mockReturnValue('333'); expect(helper.captureForeground()).toBe('333');
    run.mockReturnValue('True'); expect(helper.restoreForeground('333')).toBe(true);
    helper.dispose();
  });
  it('keeps sampling independent of synchronous focus commands and identity lookup', () => {
    const script = awarenessScript(123, [], false);
    expect(script).not.toContain('line == "fg"');
    expect(script).not.toContain('SetForegroundWindow');
    expect(script).not.toContain('QueryFullProcessImageName'); expect(script).not.toContain('GetWindowThreadProcessId');
  });
  it('switches geometry/identity modes without recursion, overlap or leaking names', () => {
    const children = [fakeChild(), fakeChild(), fakeChild()];
    const launch = vi.fn().mockReturnValueOnce(children[0]).mockReturnValueOnce(children[1]).mockReturnValueOnce(children[2]);
    const sample = vi.fn();
    const helper = new AppAwareness(sample, vi.fn(), () => [], launch as typeof spawn);
    helper.configure(true, false);
    expect(String(launch.mock.calls[0][1].at(-1))).not.toContain('QueryFullProcessImageName');
    children[0].stdout.write('chrome.exe|1\n'); expect(sample).toHaveBeenLastCalledWith({ app: null, fullscreen: true });
    helper.configure(true, true); expect(launch).toHaveBeenCalledTimes(1); expect(children[0].kill).toHaveBeenCalledOnce();
    children[0].emit('close'); expect(launch).toHaveBeenCalledTimes(2);
    children[1].stdout.write('chrome.exe|0\n'); expect(sample).toHaveBeenLastCalledWith({ app: { name: 'Chrome', category: 'browser' }, fullscreen: false });
    helper.configure(true, false); children[1].emit('close'); expect(launch).toHaveBeenCalledTimes(3);
    children[2].stdout.write('chrome.exe|0\n'); expect(sample).toHaveBeenLastCalledWith({ app: null, fullscreen: false });
    helper.dispose(); expect(children[2].kill).toHaveBeenCalledOnce(); children[2].emit('close');
  });
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
