import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { ScreenAwareness, captureWindow, type VisionInput } from '../src/main/platform/screen-awareness';
import { blankCapture, captureEligible, grayHash, nearIdentical } from '../src/core/awareness/vision';
import type { DirectedSpeech } from '../src/core/dialogue';
const native = vi.hoisted(() => ({ createFromBuffer: vi.fn() }));
vi.mock('electron', () => ({ nativeImage: native }));
const line: DirectedSpeech = { text: 'That layout could use a tiny duck.', priority: 'low', emotion: 'curious', animation: 'idle' };
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });
function setup(talk: VisionInput['talk'] = 'unhinged') {
  const input: VisionInput = { allowed: true, talk, model: 'gemma3:4b', sample: { app: { name: 'Figma', category: 'design' }, fullscreen: false, hwnd: '42' }, context: { app: 'Figma' } };
  const capture = vi.fn(async () => ({ jpeg: 'ONLY_IN_RAM', hash: new Uint8Array(640) }));
  const infer = vi.fn(async (_image: string, _model: string, _context: unknown, _signal: AbortSignal) => line);
  const present = vi.fn(() => true), pulse = vi.fn();
  const service = new ScreenAwareness(() => input, infer, present, pulse, capture, Date.now, () => 0);
  return { input, capture, infer, present, pulse, service };
}
describe('window-only capture', () => {
  it('requires a valid permitted opaque handle', () => {
    const sample = setup().input.sample;
    expect(captureEligible(sample)).toBe(true);
    for (const patch of [{ app: null }, { private: true }, { fullscreen: true }, { hwnd: undefined }, { hwnd: '0' }, { hwnd: '42; evil' }, { hwnd: '9223372036854775808' }]) expect(captureEligible({ ...sample, ...patch })).toBe(false);
  });
  it('requests only the sampled HWND and hashes the decoded JPEG at 32 by 20', async () => {
    const sample = setup().input.sample;
    const image = { isEmpty: () => false, resize: vi.fn(() => ({ toBitmap: () => Buffer.alloc(2560, 80) })) };
    native.createFromBuffer.mockReturnValue(image);
    const jpeg = Buffer.from('jpeg').toString('base64'), request = vi.fn(async () => jpeg);
    const result = await captureWindow(sample, request);
    expect(request).toHaveBeenCalledExactlyOnceWith('42', 1280, 800);
    expect(native.createFromBuffer).toHaveBeenCalledWith(Buffer.from('jpeg'));
    expect(image.resize).toHaveBeenCalledWith({ width: 32, height: 20 });
    expect(result?.jpeg).toBe(jpeg);
    expect(result?.hash).toHaveLength(640);
    request.mockClear();
    for (const patch of [{ app: null }, { private: true }, { fullscreen: true }, { hwnd: undefined }]) await captureWindow({ ...sample, ...patch }, request);
    expect(request).not.toHaveBeenCalled();
  });
  it('does not enumerate window thumbnails anywhere in the main vision path', () => {
    for (const file of ['platform/screen-awareness.ts', 'platform/awareness.ts', 'companion/CompanionController.ts']) {
      const source = readFileSync(`src/main/${file}`, 'utf8');
      expect(source).not.toContain('desktopCapturer'); expect(source).not.toContain('getSources');
    }
  });
  it('quietly skips empty/black/white results and helper refusals', async () => {
    const sample = setup().input.sample;
    for (const value of [0, 1, 2, 253, 254, 255]) {
      native.createFromBuffer.mockReturnValue({ isEmpty: () => false, resize: () => ({ toBitmap: () => Buffer.alloc(2560, value) }) });
      expect(await captureWindow(sample, async () => 'anBlZw==')).toBeUndefined();
    }
    native.createFromBuffer.mockReturnValue({ isEmpty: () => true });
    expect(await captureWindow(sample, async () => 'anBlZw==')).toBeUndefined();
    native.createFromBuffer.mockClear();
    expect(await captureWindow(sample, async () => undefined)).toBeUndefined();
    expect(native.createFromBuffer).not.toHaveBeenCalled();
    const darkContent = new Uint8Array(640); darkContent[0] = 100;
    expect(blankCapture(darkContent)).toBe(false);
    expect(blankCapture(new Uint8Array(640).fill(128))).toBe(false);
    expect(blankCapture(new Uint8Array(640).fill(3))).toBe(false);
    expect(blankCapture(new Uint8Array(640).fill(252))).toBe(false);
  });
  it('compares a tiny grayscale hash and rejects invalid/changed hashes', () => {
    const a = grayHash(new Uint8Array(2560));
    expect(nearIdentical(a, grayHash(new Uint8Array(2560).fill(1)))).toBe(true);
    expect(nearIdentical(a, grayHash(new Uint8Array(2560).fill(20)))).toBe(false);
    expect(nearIdentical(a, grayHash(new Uint8Array(1)))).toBe(false);
  });
});
describe('sample scheduler and cancellation', () => {
  it.each(['quiet', 'normal', 'chatty', 'unhinged'] as const)('uses %s cadence, a debounced change and skips unchanged pixels', async talk => {
    const { service, capture, infer } = setup(talk);
    service.tick(); vi.advanceTimersByTime(19000); service.changed(); service.tick();
    vi.advanceTimersByTime(19999); service.tick(); expect(capture).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); service.tick(); await flush();
    if (talk === 'quiet') { expect(capture).not.toHaveBeenCalled(); return; }
    expect(capture).toHaveBeenCalledTimes(1); expect(infer).toHaveBeenCalledTimes(1);
    const delay = talk === 'normal' ? 300000 : talk === 'chatty' ? 120000 : 60000;
    vi.advanceTimersByTime(delay - 1); service.tick(); expect(capture).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1); service.tick(); await flush();
    expect(capture).toHaveBeenCalledTimes(2); expect(infer).toHaveBeenCalledTimes(1);
    service.cancel(); expect(vi.getTimerCount()).toBe(0);
  });
  it('does zero capture or inference work with permission off', () => {
    const { input, service, capture, infer } = setup(); input.allowed = false;
    for (let i = 0; i < 50; i++) { vi.advanceTimersByTime(60000); service.tick(); }
    expect(capture).not.toHaveBeenCalled(); expect(infer).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });
  it('retries a cold or refused delivery on the next cadence instead of poisoning the image hash', async () => {
    const { service, infer, present } = setup(); present.mockReturnValueOnce(false);
    service.tick(); vi.advanceTimersByTime(20000); service.tick(); await flush();
    vi.advanceTimersByTime(60000); service.tick(); await flush();
    expect(infer).toHaveBeenCalledTimes(2); expect(present).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(60000); service.tick(); await flush(); expect(infer).toHaveBeenCalledTimes(2);
    service.cancel();
  });
  it.each(['privacy', 'deadline', 'window change'] as const)('aborts on %s and drops a late result; one request remains in flight', async reason => {
    const { input, service, capture, infer, present } = setup();
    let complete!: (line: DirectedSpeech) => void;
    infer.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    service.tick(); vi.advanceTimersByTime(20000); service.tick(); await flush();
    const signal = infer.mock.calls[0][3]; expect(signal.aborted).toBe(false);
    if (reason === 'privacy') { input.allowed = false; service.cancel(); }
    else if (reason === 'window change') service.changed();
    else vi.advanceTimersByTime(8000);
    expect(signal.aborted).toBe(true);
    vi.advanceTimersByTime(120000); service.tick(); expect(capture).toHaveBeenCalledTimes(1);
    complete(line); await flush(); expect(present).not.toHaveBeenCalled();
    service.cancel(); expect(vi.getTimerCount()).toBe(0);
  });
  it('includes slow capture in the total eight-second budget', async () => {
    const { service, capture, infer, present } = setup(); let complete!: (frame: { jpeg: string; hash: Uint8Array<ArrayBuffer> }) => void;
    capture.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    service.tick(); vi.advanceTimersByTime(20000); service.tick(); vi.advanceTimersByTime(8000);
    complete({ jpeg: 'late', hash: new Uint8Array(640) }); await flush();
    expect(infer).not.toHaveBeenCalled(); expect(present).not.toHaveBeenCalled(); service.cancel();
  });
});
