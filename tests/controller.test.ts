import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindow } from 'electron';
import type { ForegroundSample } from '../src/core/awareness';
import type { SettingsStore } from '../src/main/settings/store';
import type { Point, Settings } from '../src/shared/types';
import { DEFAULT_SETTINGS } from '../src/shared/schemas/settings';
import { CompanionController } from '../src/main/companion/CompanionController';
import type { Situation } from '../src/core/dialogue';
const driver = vi.hoisted(() => ({
  point: { x: 1736, y: 1030 }, idle: 0,
  drag: (_point: Point) => {}, sample: (_sample: ForegroundSample) => {}, status: (_active: boolean) => {},
  configure: vi.fn(), dispose: vi.fn(),
}));
vi.mock('electron', () => ({
  app: { getVersion: () => 'test', getAppMetrics: () => [], setLoginItemSettings: vi.fn() },
  powerMonitor: { getSystemIdleTime: () => driver.idle },
  systemPreferences: { getAnimationSettings: () => ({ prefersReducedMotion: false }) },
  screen: { getAllDisplays: () => [{ id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1080 } }],
    getPrimaryDisplay: () => ({ id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1080 } }), getCursorScreenPoint: () => driver.point },
}));
vi.mock('../src/main/platform/cursor', () => ({ CursorPoller: class {
  constructor(_changed: unknown, drag: (point: Point) => void) { driver.drag = drag; }
  configure() {} stop() {}
} }));
vi.mock('../src/main/platform/awareness', () => ({ AppAwareness: class {
  constructor(sample: (value: ForegroundSample) => void, status: (active: boolean) => void) { driver.sample = sample; driver.status = status; }
  configure(active: boolean) { driver.configure(active); if (!active) driver.status(false); }
  dispose() { driver.dispose(); driver.status(false); }
} }));
let controller: CompanionController;
let window: ReturnType<typeof fakeWindow>;
function fakeWindow() {
  return Object.assign(new EventEmitter(), {
    webContents: Object.assign(new EventEmitter(), { send: vi.fn() }),
    isDestroyed: () => false, setBounds: vi.fn(), setAlwaysOnTop: vi.fn(), showInactive: vi.fn(), hide: vi.fn(), setIgnoreMouseEvents: vi.fn(),
  });
}
function create(patch: Partial<Settings> = {}) {
  window = fakeWindow();
  const store = { value: { ...DEFAULT_SETTINGS, walking: false, firstLaunchDone: true, ...patch },
    update(patch: Partial<Settings>) { this.value = { ...this.value, ...patch }; }, flush: vi.fn() };
  controller = new CompanionController(window as unknown as BrowserWindow, store as unknown as SettingsStore, vi.fn());
  window.emit('ready-to-show'); return controller;
}
function click() {
  const bounds = window.setBounds.mock.calls.at(-1)![0] as Point;
  driver.point = { x: bounds.x + 160, y: bounds.y + 250 };
  controller.startDrag({ x: 160, y: 250 }); controller.endDrag();
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 10, 25, 12)); vi.clearAllMocks();
  vi.spyOn(Math, 'random').mockReturnValue(0); vi.spyOn(console, 'log').mockImplementation(() => {});
  driver.idle = 0; driver.point = { x: 1736, y: 1030 };
});
afterEach(() => { controller?.dispose(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('controller personality wiring', () => {
  it('shows the first-launch follow-up and cancels it immediately on pointer down', () => {
    create({ firstLaunchDone: false }); expect(controller.state.bubble).toBe('Hello. I live here now.');
    vi.advanceTimersByTime(1500); expect(controller.state.bubble).toContain('judging quietly');
    controller.startDrag({ x: 160, y: 250 }); expect(controller.state.bubble).toBeNull();
  });
  it('maps repeated clicks, interrupts old speech and angers once', () => {
    create();
    for (let i = 1; i <= 5; i++) { click(); vi.advanceTimersByTime(600); }
    expect(controller.state.bubble).toBe("RIGHT. That's it."); expect(controller.state.emotion).toBe('angry');
    click(); vi.advanceTimersByTime(600); expect(controller.state.bubble).toBeNull();
    vi.advanceTimersByTime(21000); expect(controller.state.bubble).toContain('forgive');
  });
  it('speaks on lingering once and cancels pending linger when hidden', () => {
    create(); controller.hover(true); vi.advanceTimersByTime(2501);
    expect(controller.state.bubble).toBe('Okay, this is getting weird.');
    controller.hover(false); controller.setVisible(false); vi.advanceTimersByTime(6000); expect(controller.state.bubble).toBeNull();
  });
  it('reacts to high drops once after final settle, not at every bounce', () => {
    create(); const landed = vi.fn(); controller.events.on('CHARACTER_LANDED', landed);
    controller.startDrag({ x: 160, y: 250 }); driver.point = { x: 1736, y: 400 }; driver.drag(driver.point);
    vi.advanceTimersByTime(150); driver.drag(driver.point); controller.endDrag();
    expect(controller.state.animation).toBe('falling'); expect(landed).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2500); expect(landed).toHaveBeenCalledTimes(1); expect(controller.state.bubble).toBe('OW. My everything.');
    expect(controller.state.emotion).toBe('angry');
    vi.advanceTimersByTime(3000); expect(landed).toHaveBeenCalledTimes(1);
  });
  it('stops/restarts awareness through settings, pause, hide, sleep and disposal', () => {
    create(); expect(driver.configure).toHaveBeenLastCalledWith(false);
    controller.updateSettings({ appAwareness: true }); expect(driver.configure).toHaveBeenLastCalledWith(true);
    driver.status(true); expect(controller.state.awarenessActive).toBe(true);
    controller.togglePause(); expect(driver.configure).toHaveBeenLastCalledWith(false); expect(controller.state.awarenessActive).toBe(false);
    controller.togglePause(); expect(driver.configure).toHaveBeenLastCalledWith(true);
    controller.setVisible(false); expect(driver.configure).toHaveBeenLastCalledWith(false);
    controller.setVisible(true); expect(driver.configure).toHaveBeenLastCalledWith(true);
    driver.idle = 301; controller.checkIdle(); expect(driver.configure).toHaveBeenLastCalledWith(false);
    driver.idle = 0; controller.checkIdle(); expect(driver.configure).toHaveBeenLastCalledWith(true);
    controller.updateSettings({ appAwareness: false }); expect(driver.configure).toHaveBeenLastCalledWith(false);
    controller.dispose(); expect(driver.dispose).toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });
  it('drops app speech/follow-up on private apps or fullscreen and suppresses medium speech', () => {
    create({ appAwareness: true }); driver.status(true);
    driver.sample({ app: { name: 'Chrome', category: 'browser' }, fullscreen: false }); expect(controller.state.bubble).toContain('Chrome');
    driver.sample({ app: null, fullscreen: true }); expect(controller.state.bubble).toBeNull();
    click(); vi.advanceTimersByTime(600); expect(controller.state.bubble).toBeNull();
    for (let i = 0; i < 4; i++) { click(); vi.advanceTimersByTime(600); }
    expect(controller.state.bubble).toBe("RIGHT. That's it.");
  });
  it('does not emit ambient thoughts while dragging or in fullscreen', () => {
    create({ appAwareness: true }); driver.status(true);
    driver.sample({ app: { name: 'Chrome', category: 'browser' }, fullscreen: true });
    vi.advanceTimersByTime(8 * 60000); expect(controller.state.bubble).toBeNull();
    driver.sample({ app: null, fullscreen: false });
    controller.startDrag({ x: 160, y: 250 }); driver.point = { x: 1700, y: 700 }; driver.drag(driver.point);
    vi.advanceTimersByTime(8 * 60000); expect(controller.state.bubble).toBeNull();
  });
});

const aiLine = 'My hat deserves a tiny holiday.';
const aiJSON = () => JSON.stringify({ shouldSpeak: true, dialogue: aiLine, then: '', emotion: 'curious', animation: 'idle' });
const flushAI = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
function requestSituation(situation: Situation): void {
  (controller as unknown as { saySituation(situation: Situation): void }).saySituation(situation);
}
async function createWithAI() {
  const fetcher = vi.fn<typeof fetch>(async url => {
    const body = String(url).endsWith('/api/version') ? { version: '0.40.18' } : String(url).endsWith('/api/tags') ? { models: [{ name: 'gemma3:4b' }] } : { message: { content: aiJSON() } };
    return new Response(JSON.stringify(body));
  });
  vi.stubGlobal('fetch', fetcher); create({ aiEnabled: true, aiModel: 'gemma3:4b', appAwareness: true });
  await flushAI(); expect(controller.state.brain.phase).toBe('connected'); fetcher.mockClear();
  return fetcher;
}
describe('controller local AI boundaries', () => {
  it('persists the preferred installed model and exposes it to Settings without another warmup', async () => {
    const fetcher = vi.fn<typeof fetch>(async url => new Response(JSON.stringify(
      String(url).endsWith('/api/version') ? { version: '0.40.18' } : String(url).endsWith('/api/tags') ?
        { models: [{ name: 'gemma3:4b' }, { name: 'qwen3:8b' }] } : { message: { content: aiJSON() } })));
    vi.stubGlobal('fetch', fetcher); create({ aiEnabled: true, aiModel: '' }); await flushAI();
    expect(controller.store.value.aiModel).toBe('qwen3:8b');
    expect(controller.state.settings.aiModel).toBe('qwen3:8b');
    expect(controller.state.brain.models).toEqual(['gemma3:4b', 'qwen3:8b']);
    expect(controller.state.brain.phase).toBe('connected');
    expect(JSON.parse(fetcher.mock.calls[2][1]!.body as string).model).toBe('qwen3:8b');
    controller.updateSettings({ mute: true }); await flushAI(); expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it.each(['hide', 'pause'] as const)('cancels offline recovery on %s and automatically reconnects on return', async action => {
    const fetcher = await createWithAI(); fetcher.mockRejectedValueOnce(new TypeError('ECONNREFUSED'));
    requestSituation('thought'); await flushAI(); expect(controller.state.brain.phase).toBe('offline');
    if (action === 'hide') controller.setVisible(false); else controller.togglePause();
    fetcher.mockClear(); await vi.advanceTimersByTimeAsync(240000); expect(fetcher).not.toHaveBeenCalled();
    if (action === 'hide') controller.setVisible(true); else controller.togglePause();
    await flushAI(); expect(controller.state.brain.phase).toBe('connected');
    expect(fetcher.mock.calls.map(([url]) => String(url).split('/').at(-1))).toEqual(['version', 'tags', 'chat']);
  });
  it('never invokes AI for director silence, interruption rejection, or situation cooldown', async () => {
    const fetcher = await createWithAI();
    vi.mocked(Math.random).mockReturnValue(.99); requestSituation('hover_linger'); expect(fetcher).not.toHaveBeenCalled();
    vi.mocked(Math.random).mockReturnValue(0); controller.updateSettings({ mute: true }); requestSituation('thought'); expect(fetcher).not.toHaveBeenCalled();
    controller.updateSettings({ mute: false }); requestSituation('thought'); await flushAI();
    expect(controller.state.bubble).toBe(aiLine); expect(fetcher).toHaveBeenCalledTimes(1);
    controller.dismissBubble(); requestSituation('thought'); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('shows click dialogue within 100ms without waiting for the provider', async () => {
    const fetcher = await createWithAI(); click(); vi.advanceTimersByTime(99);
    expect(controller.state.bubble).toBe('Ow. Rude.'); expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(['pause', 'hide', 'disable', 'privacy', 'fullscreen', 'revoke', 'sleep', 'dismiss', 'app change'] as const)('aborts and suppresses late AI on %s', async action => {
    const fetcher = await createWithAI(); driver.status(true);
    let complete!: (response: Response) => void;
    fetcher.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    requestSituation('thought'); const signal = fetcher.mock.calls.at(-1)![1]!.signal!;
    if (action === 'pause') controller.togglePause();
    if (action === 'hide') controller.setVisible(false);
    if (action === 'disable') controller.updateSettings({ aiEnabled: false });
    if (action === 'privacy') driver.sample({ app: null, fullscreen: false, private: true });
    if (action === 'fullscreen') driver.sample({ app: null, fullscreen: true });
    if (action === 'revoke') controller.updateSettings({ appAwareness: false });
    if (action === 'sleep') { driver.idle = 400; controller.checkIdle(); }
    if (action === 'dismiss') controller.dismissBubble();
    if (action === 'app change') driver.sample({ app: { name: 'Unmapped', category: 'other' }, fullscreen: false });
    expect(signal.aborted).toBe(true);
    complete(new Response(JSON.stringify({ message: { content: aiJSON() } }))); await flushAI();
    expect(controller.state.bubble).not.toBe(aiLine);
  });
  it('cancels drag_long when released and leaves physics in charge', async () => {
    const fetcher = await createWithAI();
    controller.startDrag({ x: 160, y: 250 }); driver.point = { x: 1700, y: 700 }; driver.drag(driver.point);
    let complete!: (response: Response) => void;
    fetcher.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    vi.advanceTimersByTime(6000); expect(fetcher).toHaveBeenCalledTimes(1);
    const signal = fetcher.mock.calls[0][1]!.signal!;
    controller.endDrag(); expect(signal.aborted).toBe(true); expect(controller.state.animation).toBe('falling');
    complete(new Response(JSON.stringify({ message: { content: aiJSON() } }))); await flushAI(); expect(controller.state.bubble).not.toBe(aiLine);
  });
  it('aborts warmup on private apps, but Settings/self samples do not block connection tests', async () => {
    const fetcher = await createWithAI(); driver.status(true);
    driver.sample({ app: null, fullscreen: false }); await controller.testAI();
    expect(controller.state.brain.sample).toBe(aiLine);
    driver.sample({ app: null, fullscreen: false, private: true });
    expect(controller.state.brain.phase).toBe('suspended');
    fetcher.mockClear(); await controller.testAI(); expect(fetcher).not.toHaveBeenCalled();
  });
});
