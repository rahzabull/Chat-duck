import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindow } from 'electron';
import type { ForegroundSample } from '../src/core/awareness';
import type { SettingsStore } from '../src/main/settings/store';
import type { Point, Settings } from '../src/shared/types';
import { DEFAULT_SETTINGS } from '../src/shared/schemas/settings';
import { CompanionController } from '../src/main/companion/CompanionController';
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
afterEach(() => { controller?.dispose(); vi.restoreAllMocks(); vi.useRealTimers(); });

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
