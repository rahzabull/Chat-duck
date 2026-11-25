import { app } from 'electron';
import { ACTIVITY_DURATION, type Behaviour } from '../src/core/behaviour';
import type { EmotionEngine } from '../src/core/emotions';
import type { Memory } from '../src/core/memory';
import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindow } from 'electron';
import type { ForegroundSample } from '../src/core/awareness';
import type { SettingsStore } from '../src/main/settings/store';
import type { Point, Settings } from '../src/shared/types';
import { DEFAULT_SETTINGS, parseSettings } from '../src/shared/schemas/settings';
import { CompanionController } from '../src/main/companion/CompanionController';
import { FOCUS_DEFAULTS, type ProductivityView } from '../src/core/productivity/types';
import type { Situation } from '../src/core/dialogue';
const driver = vi.hoisted(() => ({
  point: { x: 1736, y: 1030 }, idle: 0,
  drag: (_point: Point) => {}, sample: (_sample: ForegroundSample) => {}, status: (_active: boolean) => {},
  configure: vi.fn(), dispose: vi.fn(),
  captureForeground: vi.fn((ready: (hwnd?: string) => void) => ready('12345')), restoreForeground: vi.fn(() => true),
}));
vi.mock('electron', () => ({
  app: { isPackaged: false, getVersion: () => 'test', getAppMetrics: () => [], setLoginItemSettings: vi.fn() },
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
  captureForeground = driver.captureForeground; restoreForeground = driver.restoreForeground;
  constructor(sample: (value: ForegroundSample) => void, status: (active: boolean) => void) { driver.sample = sample; driver.status = status; }
  configure(active: boolean, identity: boolean) { driver.configure(active && identity); if (!active) driver.status(false); }
  dispose() { driver.dispose(); driver.status(false); }
} }));
let controller: CompanionController;
let window: ReturnType<typeof fakeWindow>;
function fakeWindow() {
  return Object.assign(new EventEmitter(), {
    webContents: Object.assign(new EventEmitter(), { send: vi.fn() }),
    isDestroyed: () => false, setFocusable: vi.fn(), setBounds: vi.fn(), setAlwaysOnTop: vi.fn(), showInactive: vi.fn(), hide: vi.fn(), setIgnoreMouseEvents: vi.fn(),
  });
}
function create(patch: Partial<Settings> = {}) {
  window = fakeWindow();
  const store = { value: { ...DEFAULT_SETTINGS, walking: false, firstLaunchDone: true, ...patch },
    update(patch: Partial<Settings>) { this.value = parseSettings({ ...this.value, ...patch }); }, flush: vi.fn() };
  controller = new CompanionController(window as unknown as BrowserWindow, store as unknown as SettingsStore, vi.fn());
  window.emit('ready-to-show'); driver.sample({ app: null, fullscreen: false }); return controller;
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
  it('restores the captured window before dropping focusability without hiding', () => {
    create(); controller.captureConversationFocus(vi.fn());
    controller.state.productivity = { focus: { kind: 'focus' } } as ProductivityView; // A running focus timer must not retain keyboard focus.
    window.setFocusable.mockClear(); window.hide.mockClear(); window.showInactive.mockClear();
    controller.releaseConversationFocus();
    expect(driver.restoreForeground).toHaveBeenCalledWith('12345');
    expect(driver.restoreForeground.mock.invocationCallOrder[0]).toBeLessThan(window.setFocusable.mock.invocationCallOrder[0]);
    expect(window.setFocusable).toHaveBeenCalledWith(false); expect(window.hide).not.toHaveBeenCalled(); expect(window.showInactive).not.toHaveBeenCalled();
  });
  it('anchors productivity cards and keeps focus quiet while reminders can turn and alarm', () => {
    create({ mute: true, talkativeness: 'quiet' });
    const base = window.setBounds.mock.calls.at(-1)![0];
    const view: ProductivityView = { revision: 1, card: 'tasks', tasks: [], notes: [], reminders: [], settings: { ...FOCUS_DEFAULTS }, queue: 0, message: '', focus: { paused: false, endAt: Date.now() + 60000, remaining: 60000, startedAt: Date.now(), minutes: 1, kind: 'focus' } };
    controller.presentProductivity(view); const bounds = window.setBounds.mock.calls.at(-1)![0]; const layout = controller.state.productivity!.layout!;
    expect(bounds.y + layout.y + layout.height).toBe(base.y + base.height); expect(layout.contentWidth).toBeLessThanOrEqual(420);
    driver.idle = 3600; controller.checkIdle(); expect(controller.state.sleeping).toBe(false); expect(controller.state.animation).toBe('focus');
    controller.productivityAttention('alarm', 'reminder_due'); expect(controller.state.animation).toBe('alarm'); expect(controller.state.direction).toBe('left'); expect(controller.state.productivitySpeech).toBeTruthy();
    vi.advanceTimersByTime(3000); expect(controller.state.animation).toBe('focus');
    controller.productivityAttention('celebrate', 'task_done'); expect(controller.state.productivitySpeech).not.toContain('shit');
  });
  it('suppresses sleep, walking, activities and speech while reading and for 60 seconds afterwards', () => {
    create({ walking: true, appAwareness: true }); controller.beginConversation(); driver.idle = 3600;
    const internals = controller as unknown as { performActivity(b: Behaviour): void; saySituation(s: Situation): boolean; body: { walking: boolean } };
    function assertQuiet() {
      controller.checkIdle(); controller.events.emit('USER_BECAME_IDLE', undefined);
      internals.performActivity('walk_left'); internals.performActivity('dance');
      driver.sample({ app: { name: 'Chrome', category: 'browser' }, fullscreen: false });
      expect(internals.saySituation('first_launch')).toBe(false);
      expect(controller.state.sleeping).toBe(false); expect(controller.state.animation).toBe('idle');
      expect(internals.body.walking).toBe(false); expect(controller.state.bubble).toBeNull();
    }
    vi.advanceTimersByTime(120000); assertQuiet();
    controller.finishConversation(); vi.advanceTimersByTime(59999); assertQuiet();
    vi.advanceTimersByTime(1); controller.checkIdle(); expect(controller.state.sleeping).toBe(true);
  });
  it('yields focus without running the companion hide/close handler', () => {
    create(); controller.beginConversation(); const close = vi.fn(); controller.onConversationClose = close;
    window.hide.mockImplementation(() => { window.emit('hide'); });
    controller.releaseConversationFocus();
    expect(window.setFocusable).toHaveBeenCalledWith(false); expect(window.hide).toHaveBeenCalledOnce();
    expect(window.showInactive).toHaveBeenCalled(); expect(window.setAlwaysOnTop).toHaveBeenLastCalledWith(true, 'screen-saver');
    expect(controller.state.visible).toBe(true); expect(close).not.toHaveBeenCalled();
  });
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

// These probes exercise main-process wiring with no renderer or native helper.
function internals() { return controller as unknown as { performActivity(id: Behaviour): void; emotions: EmotionEngine; memory: Memory; nextThought: number; ambientTick(): void }; }
describe('Milestone 3 controller integration', () => {
  it('blocks autonomous events after helper loss until a new safe geometry sample', () => {
    create(); internals().performActivity('strike'); driver.status(false);
    expect(controller.state.animation).toBe('idle');
    internals().performActivity('visitor'); expect(controller.state.animation).toBe('idle');
    driver.sample({ app: null, fullscreen: true }); internals().performActivity('visitor'); expect(controller.state.animation).toBe('idle');
    driver.sample({ app: null, fullscreen: false }); internals().performActivity('visitor'); expect(controller.state.animation).toBe('visitor');
  });
  it.each(['look_around', 'sitting', 'yawn', 'stretch', 'dance', 'side_eye', 'nap', 'strike', 'bread_snack', 'visitor'] as const)('holds %s for its bounded duration then returns to idle', id => {
    create(); internals().performActivity(id); expect(controller.state.animation).toBe(id);
    vi.advanceTimersByTime(ACTIVITY_DURATION[id]! - 1); expect(controller.state.animation).toBe(id);
    vi.advanceTimersByTime(1); expect(controller.state.animation).toBe('idle');
  });
  it('keeps sunglasses through interactions for about two minutes without holding a motion loop', () => {
    create(); internals().performActivity('sunglasses'); expect(controller.state.sunglasses).toBe(true);
    vi.advanceTimersByTime(2000); expect(controller.state.animation).toBe('idle'); expect(controller.state.sunglasses).toBe(true);
    click(); vi.advanceTimersByTime(1000); expect(controller.state.sunglasses).toBe(true);
    vi.advanceTimersByTime(120000); expect(controller.state.sunglasses).toBe(false);
  });
  it.each(['hide', 'pause', 'drag', 'fullscreen'] as const)('cancels an event on %s and does not resurrect it', action => {
    create(); internals().performActivity('visitor'); expect(controller.state.animation).toBe('visitor');
    if (action === 'hide') controller.setVisible(false);
    if (action === 'pause') controller.togglePause();
    if (action === 'drag') controller.startDrag({ x: 160, y: 250 });
    if (action === 'fullscreen') driver.sample({ app: null, fullscreen: true });
    vi.advanceTimersByTime(12000);
    if (action === 'hide') controller.setVisible(true);
    if (action === 'pause') controller.togglePause();
    expect(controller.state.animation).not.toBe('visitor');
  });
  it('freezes emotions while hidden and updates the adapter emotion from active ticks', () => {
    create(); const e = internals().emotions; e.values.irritation = 90;
    vi.advanceTimersByTime(30000); expect(controller.state.emotion).toBe('angry');
    controller.setVisible(false); const values = { ...e.values }; vi.advanceTimersByTime(600000); expect(e.values).toEqual(values);
    controller.setVisible(true); vi.advanceTimersByTime(30000); expect(e.values.irritation).toBeLessThan(values.irritation);
  });
  it("keeps today's mood through preset changes and emits a new daily mood once", () => {
    create(); const mood = controller.state.mood, changed = vi.fn(); controller.events.on('MOOD_CHANGED', changed);
    controller.updateSettings({ personality: 'unhinged' }); expect(controller.state.mood).toBe(mood);
    vi.setSystemTime(new Date(2026, 10, 26, 12)); vi.advanceTimersByTime(30000);
    expect(changed).toHaveBeenCalledTimes(1); expect(controller.store.value.dailyMood?.date).toBe('2026-11-26');
    vi.advanceTimersByTime(30000); expect(changed).toHaveBeenCalledTimes(1);
  });
  it('clears the preferred name, counters and AI history when forgotten or disabled', () => {
    create({ preferredName: 'Alex' }); click(); vi.advanceTimersByTime(1);
    expect(controller.state.memory.join(' ')).toContain('Alex'); expect(internals().memory.dailyPokes).toBeGreaterThan(0);
    controller.forgetMemory(); expect(controller.state.settings.preferredName).toBe(''); expect(internals().memory.dailyPokes).toBe(0);
    controller.updateSettings({ memoryEnabled: false }); click(); vi.advanceTimersByTime(1);
    expect(controller.state.memory).toEqual([]); expect(internals().memory.totalPickups).toBe(0);
    controller.updateSettings({ preferredName: 'Ignored' }); expect(controller.state.settings.preferredName).toBe('');
  });
  it('shows a milestone once then permits ordinary thoughts later that day', () => {
    create(); internals().memory.daysTogether = 7; internals().nextThought = 0; internals().ambientTick();
    expect(controller.state.bubble).toContain('7 days');
    controller.dismissBubble(); vi.advanceTimersByTime(600000); internals().nextThought = 0; internals().ambientTick();
    expect(controller.state.bubble).not.toContain('7 days');
  });
  it('geometry-only samples leave an in-flight local AI thought and recent voice intact', async () => {
    const fetcher = await createWithAI(); controller.updateSettings({ appAwareness: false }); await flushAI(); fetcher.mockClear();
    let complete!: (response: Response) => void;
    fetcher.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    requestSituation('thought'); const signal = fetcher.mock.calls.at(-1)![1]!.signal!;
    driver.sample({ app: null, fullscreen: false }); expect(signal.aborted).toBe(false);
    complete(new Response(JSON.stringify({ message: { content: aiJSON() } }))); await flushAI(); expect(controller.state.bubble).toBe(aiLine);
  });
  it('honors --debug-activity only in development and validates its id', () => {
    const original = process.argv;
    try {
      process.argv = [...original, '--debug-activity', 'strike']; create(); expect(controller.state.animation).toBe('strike'); controller.dispose();
      Object.defineProperty(app, 'isPackaged', { value: true, configurable: true }); create(); expect(controller.state.animation).toBe('idle'); controller.dispose();
      Object.defineProperty(app, 'isPackaged', { value: false, configurable: true });
      for (const id of ['focus', 'alarm', 'gaming', 'coffee', 'shrug', 'laughing', 'confused', 'thinking']) {
        process.argv = [...original, '--debug-activity', id]; create(); expect(controller.state.animation).toBe(id); controller.dispose();
      }
      Object.defineProperty(app, 'isPackaged', { value: true, configurable: true });
      process.argv = [...original, '--debug-activity', 'coffee']; create(); expect(controller.state.animation).toBe('idle'); controller.dispose();
      Object.defineProperty(app, 'isPackaged', { value: false, configurable: true });
      process.argv = [...original, '--debug-activity', 'shell']; create(); expect(controller.state.animation).toBe('idle');
    } finally { process.argv = original; Object.defineProperty(app, 'isPackaged', { value: false, configurable: true }); }
  });
});


describe('Phase C main mode integration', () => {
  it('keeps geometry alive across a native gaming hide and returns after five seconds', () => {
    create(); window.hide.mockImplementation(() => { window.emit('hide'); });
    driver.sample({ app: null, fullscreen: true }); vi.advanceTimersByTime(9999);
    expect(controller.state.gaming).toBe(false); vi.advanceTimersByTime(1);
    expect(controller.state.mode).toBe('gaming'); expect(controller.state.visible).toBe(true);
    expect(window.hide).toHaveBeenCalled(); expect(controller.notificationsOnly()).toBe(true);
    driver.sample({ app: null, fullscreen: false }); vi.advanceTimersByTime(4999);
    expect(controller.state.gaming).toBe(true); vi.advanceTimersByTime(1001);
    expect(controller.state.gaming).toBe(false); expect(window.showInactive).toHaveBeenCalled();
  });
  it('freezes instead of hiding when configured and preserves a user hide on exit', () => {
    create({ gamingBehaviour: 'freeze' }); window.hide.mockClear();
    driver.sample({ app: null, fullscreen: true }); vi.advanceTimersByTime(10000);
    expect(controller.state.gaming).toBe(true); expect(window.hide).not.toHaveBeenCalled();
    controller.setVisible(false); window.showInactive.mockClear();
    driver.sample({ app: null, fullscreen: false }); vi.advanceTimersByTime(6000);
    expect(controller.state.visible).toBe(false); expect(window.showInactive).not.toHaveBeenCalled();
  });
  it('expires DND while hidden and keeps privacy priority without losing DND restrictions', () => {
    create(); controller.updateSettings({ privacyMode: true, dndUntil: Date.now() + 60000 });
    expect(controller.state.mode).toBe('privacy'); expect(controller.state.dnd).toBe(true);
    requestSituation('click_angry'); internals().performActivity('dance');
    expect(controller.state.bubble).toBeNull(); expect(controller.state.animation).toBe('idle');
    controller.productivityAttention('celebrate', 'task_done'); expect(controller.state.productivitySpeech).toBeUndefined();
    controller.setVisible(false); vi.advanceTimersByTime(60000);
    expect(controller.state.dnd).toBe(false); expect(controller.state.mode).toBe('privacy'); expect(controller.state.settings.dndUntil).toBe(0);
  });
  it.each(['dnd', 'privacy', 'gaming'] as const)('aborts ambient AI, blocks diagnostics and suppresses stale results in %s', async mode => {
    const fetcher = await createWithAI(); driver.status(true);
    let complete!: (response: Response) => void;
    fetcher.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    requestSituation('thought'); const signal = fetcher.mock.calls.at(-1)![1]!.signal!;
    if (mode === 'dnd') controller.updateSettings({ dndUntil: -1 });
    else if (mode === 'privacy') controller.updateSettings({ privacyMode: true });
    else { driver.sample({ app: null, fullscreen: true }); vi.advanceTimersByTime(10000); }
    expect(signal.aborted).toBe(true); fetcher.mockClear(); await controller.testAI();
    expect(fetcher).not.toHaveBeenCalled();
    complete(new Response(JSON.stringify({ message: { content: aiJSON() } }))); await flushAI();
    expect(controller.state.bubble).not.toBe(aiLine); expect(controller.state.brain.phase).toBe('suspended');
    if (mode === 'privacy') { expect(controller.state.sunglasses).toBe(true); expect(controller.state.awarenessActive).toBe(false); expect(driver.configure).toHaveBeenLastCalledWith(false); }
  });
  it('uses only high-priority reminders during DND and keeps the body calm', () => {
    create({ dndUntil: -1, dndReminders: 'bubble' });
    requestSituation('first_launch'); expect(controller.state.bubble).toBeNull();
    controller.productivityAttention('alarm', 'reminder_due');
    expect(controller.state.productivitySpeech).toBeTruthy(); expect(controller.state.animation).toBe('idle');
    controller.updateSettings({ dndReminders: 'notification' });
    expect(controller.notificationsOnly()).toBe(true); expect(controller.state.productivitySpeech).toBeUndefined();
  });
  it('debug morning briefing runs through interruption gates only in development', () => {
    const original = process.argv;
    const view: ProductivityView = { revision: 1, card: null, tasks: [], reminders: [], notes: [], settings: { ...FOCUS_DEFAULTS }, queue: 0, message: '' };
    try {
      process.argv = [...original, '--debug-proactive', 'briefing_morning'];
      create({ mute: true }); controller.presentProductivity(view); vi.advanceTimersByTime(2000); expect(controller.state.bubble).toBeNull();
      controller.updateSettings({ mute: false }); vi.advanceTimersByTime(2000);
      expect(controller.state.bubble).toContain('0 tasks'); expect(controller.state.proactive?.label).toBe('Today');
      const action = vi.fn(); controller.onProactiveAction = action; controller.proactiveAction(true);
      expect(action).toHaveBeenCalledWith({ kind: 'today' }); expect(controller.state.proactive).toBeUndefined();
      controller.dispose(); Object.defineProperty(app, 'isPackaged', { value: true, configurable: true });
      create(); controller.presentProductivity(view); vi.advanceTimersByTime(2000); expect(controller.state.proactive).toBeUndefined();
    } finally { process.argv = original; Object.defineProperty(app, 'isPackaged', { value: false, configurable: true }); }
  });
});


it('releases an in-progress drag when DND takes over and remains calm', () => {
  create(); controller.startDrag({ x: 160, y: 250 }); driver.point = { x: 1600, y: 700 }; driver.drag(driver.point);
  expect(controller.state.dragging).toBe(true); controller.updateSettings({ dndUntil: -1 });
  expect(controller.state.dragging).toBe(false); expect(controller.state.animation).toBe('idle');
  vi.advanceTimersByTime(2000); expect(controller.state.animation).toBe('idle'); expect(controller.state.bubble).toBeNull();
});
