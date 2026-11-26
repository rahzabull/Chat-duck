import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { spawn } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppAwareness } from '../src/main/platform/awareness';
import { awarenessScript } from '../src/main/platform/awareness-script';
import { CAPTURE_MAX_LINE, CAPTURE_SKIP_REASONS, captureCommand, captureReply } from '../src/main/platform/capture-protocol';
import { PRIVATE_EXE_PATTERN } from '../src/core/awareness';
import { PRIVATE_TITLE_PATTERN } from '../src/core/awareness/title';

const jpeg = Buffer.from([0xff, 0xd8, 1, 2, 0xff, 0xd9]).toString('base64');
function setup(screen = true) {
  const child = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill: vi.fn(() => true) });
  const sample = vi.fn();
  const helper = new AppAwareness(sample, vi.fn(), () => [], vi.fn(() => child) as unknown as typeof spawn);
  helper.configure(true, true, false, screen);
  child.stdout.write('figma.exe|0|42|\n'); child.stdin.read(); sample.mockClear();
  return { child, helper, sample, close: () => { helper.dispose(); child.emit('close'); } };
}
afterEach(() => vi.useRealTimers());

describe('bounded capture protocol', () => {
  it('accepts only positive decimal handles and bounded integer dimensions', () => {
    expect(captureCommand('42', 1280, 800)).toBe('capture 42 1280 800\n');
    for (const hwnd of ['', '0', '-1', '+42', '4.2', '42\n', '42 1', '٤٢', '42;exit', '9223372036854775808', '9'.repeat(100)]) expect(captureCommand(hwnd, 1280, 800)).toBeUndefined();
    for (const [w, h] of [[0, 1], [1, 0], [-1, 1], [1281, 800], [1280, 801], [1.5, 1], [NaN, 1], [1, Infinity]]) expect(captureCommand('42', w, h)).toBeUndefined();
  });
  it('validates bounded JPEG replies and fails closed on malformed output', () => {
    expect(captureReply(`capture|ok|${jpeg}`)).toBe(jpeg);
    for (const value of ['capture|ok|', 'capture|ok|!!!!', 'capture|ok|abcd', 'capture|ok|abcd=', `capture|ok|${'a'.repeat(CAPTURE_MAX_LINE)}`, `capture|ok|${jpeg}|extra`, 'capture|skip|private']) expect(captureReply(value)).toBeUndefined();
  });
  it('requests exactly the latest sampled HWND with screen permission and only one request in flight', async () => {
    const { child, helper, sample, close } = setup();
    expect(await helper.capture('43')).toBeUndefined(); expect(await helper.capture('42;exit')).toBeUndefined();
    expect(await helper.capture('42', 1281, 800)).toBeUndefined(); expect(child.stdin.read()).toBeNull();
    const pending = helper.capture('42');
    expect(child.stdin.read()?.toString()).toBe('capture 42 1280 800\n');
    expect(await helper.capture('42')).toBeUndefined();
    child.stdout.write(`capture|ok|${jpeg.slice(0, 4)}`); child.stdout.write(`${jpeg.slice(4)}\r\n`);
    expect(await pending).toBe(jpeg); expect(sample).not.toHaveBeenCalled();
    child.stdout.write('private|0|42\n'); child.stdin.read();
    expect(await helper.capture('42')).toBeUndefined(); expect(child.stdin.read()).toBeNull(); close();
    const off = setup(false); expect(await off.helper.capture('42')).toBeUndefined(); expect(off.child.stdin.read()).toBeNull(); off.close();
  });
  it.each(CAPTURE_SKIP_REASONS)('silently resolves capture|skip|%s without creating a sample', async reason => {
    const { child, helper, sample, close } = setup();
    const pending = helper.capture('42'); child.stdout.write(`capture|skip|${reason}\n`);
    expect(await pending).toBeUndefined(); expect(sample).not.toHaveBeenCalled(); close();
  });
  it('supports a large chunked JPEG reply followed by normal sample framing', async () => {
    const { child, helper, sample, close } = setup();
    const bytes = Buffer.alloc(250000, 24); bytes[0] = 255; bytes[1] = 216; bytes[bytes.length - 2] = 255; bytes[bytes.length - 1] = 217;
    const encoded = bytes.toString('base64'), wire = `capture|ok|${encoded}\nfigma.exe|0|43|\n`;
    const pending = helper.capture('42');
    for (let i = 0; i < wire.length; i += 8192) child.stdout.write(wire.slice(i, i + 8192));
    expect(await pending).toBe(encoded); expect(sample).toHaveBeenCalledExactlyOnceWith({ app: { name: 'Figma', category: 'design' }, fullscreen: false, hwnd: '43' }); close();
  });
  it.each(['timeout', 'oversized', 'close', 'revocation'])('cancels and drops late output after %s', async cause => {
    vi.useFakeTimers(); const { child, helper, close } = setup();
    const pending = helper.capture('42'); child.stdin.read();
    if (cause === 'timeout') vi.advanceTimersByTime(5000);
    else if (cause === 'oversized') child.stdout.write(`capture|ok|${'a'.repeat(CAPTURE_MAX_LINE)}`);
    else if (cause === 'close') child.emit('close');
    else helper.configure(false);
    expect(await pending).toBeUndefined();
    expect(await helper.capture('42')).toBeUndefined();
    child.stdout.write(`capture|ok|${jpeg}\n`); expect(child.stdin.read()).toBeNull();
    close(); expect(vi.getTimerCount()).toBe(0);
  });
});

describe('native capture policy', () => {
  it('checks private exe/title and foreground policy before rendering only the requested HWND', () => {
    const script = awarenessScript(123, [456], true, false, true, ['secret-editor.exe']);
    const render = script.indexOf('PrintWindow(hwnd, hdc, 2)');
    expect(render).toBeGreaterThan(0);
    for (const guard of [PRIVATE_EXE_PATTERN, PRIVATE_TITLE_PATTERN, 'secret-editor.exe', 'Array.IndexOf(Own, pid)', 'IsIconic(hwnd)', 'hwnd != GetForegroundWindow()', 'return "fullscreen"', 'Inspect(hwnd, Own)', 'reason = CaptureReason(hwnd, out current)']) {
      expect(script.indexOf(guard), guard).toBeGreaterThan(-1); expect(script.indexOf(guard), guard).toBeLessThan(render);
    }
    expect(script).toContain('return Inspect(GetForegroundWindow(), own)');
    expect(script).toContain('new IntPtr(Int64.Parse(parts[1]))');
    expect(script).toContain('quality = 70; quality >= 10; quality -= 10');
    expect(script).toContain('new MemoryStream()'); expect(script).toContain('graphics.ReleaseHdc(hdc)');
    for (const forbidden of ['CopyFromScreen', 'BitBlt', 'EnumWindows', 'WriteAllBytes', 'FileStream']) expect(script).not.toContain(forbidden);
    for (const reason of CAPTURE_SKIP_REASONS) expect(script).toContain(`"${['invalid', 'busy', 'size', 'render', 'oversized'].includes(reason) ? 'capture|skip|' : ''}${reason}"`);
  });
  it('omits all rendering code without effective screen permission', () => {
    for (const script of [awarenessScript(123, [], true, true, false), awarenessScript(123, [], false, true, true)]) {
      for (const api of ['PrintWindow', 'System.Drawing', 'QueueCapture']) expect(script).not.toContain(api);
    }
  });
});
