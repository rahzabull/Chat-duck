import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from 'electron';
import { CursorPoller } from '../src/main/platform/cursor';

vi.mock('electron', () => ({ screen: { getCursorScreenPoint: vi.fn() } }));

describe('adaptive cursor polling', () => {
  let point = { x: 2000, y: 2000 };
  let bounds = { x: 0, y: 0, width: 320, height: 300 };
  const changed = vi.fn(); const sampleDrag = vi.fn();
  let poller: CursorPoller;
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllMocks();
    point = { x: 2000, y: 2000 }; bounds = { x: 0, y: 0, width: 320, height: 300 };
    vi.mocked(screen.getCursorScreenPoint).mockImplementation(() => ({ ...point }));
    poller = new CursorPoller(changed, sampleDrag, () => bounds);
  });
  afterEach(() => { poller.stop(); vi.useRealTimers(); });

  it('drops to 4 Hz after one stationary second far away without duplicate IPC', () => {
    poller.configure(true, false); vi.advanceTimersByTime(1000);
    vi.mocked(screen.getCursorScreenPoint).mockClear();
    vi.advanceTimersByTime(1000);
    expect(screen.getCursorScreenPoint).toHaveBeenCalledTimes(4);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(sampleDrag).not.toHaveBeenCalled();
  });
  it('keeps 20 Hz near the duck and detects a duck moving near a stationary cursor', () => {
    poller.configure(true, false); vi.advanceTimersByTime(1000);
    bounds = { ...bounds, x: 1700, y: 1700 }; vi.advanceTimersByTime(250);
    vi.mocked(screen.getCursorScreenPoint).mockClear(); vi.advanceTimersByTime(1000);
    expect(screen.getCursorScreenPoint).toHaveBeenCalledTimes(20);
    expect(changed).toHaveBeenCalledTimes(1);
  });
  it('returns to 20 Hz on distant movement, then drops back after one second', () => {
    poller.configure(true, false); vi.advanceTimersByTime(1000);
    point = { x: 2100, y: 2000 }; vi.advanceTimersByTime(250);
    expect(changed).toHaveBeenCalledTimes(2);
    vi.mocked(screen.getCursorScreenPoint).mockClear(); vi.advanceTimersByTime(1000);
    expect(screen.getCursorScreenPoint).toHaveBeenCalledTimes(20);
    vi.mocked(screen.getCursorScreenPoint).mockClear(); vi.advanceTimersByTime(1000);
    expect(screen.getCursorScreenPoint).toHaveBeenCalledTimes(4);
  });
  it('samples stationary drags at 60 Hz and cancels capture polling on release/hide', () => {
    poller.configure(true, true); vi.advanceTimersByTime(1000);
    expect(sampleDrag.mock.calls.length).toBeGreaterThanOrEqual(60);
    expect(sampleDrag.mock.calls.length).toBeLessThanOrEqual(64);
    expect(changed).toHaveBeenCalledTimes(1);
    poller.configure(true, false); sampleDrag.mockClear();
    vi.mocked(screen.getCursorScreenPoint).mockClear(); vi.advanceTimersByTime(1000);
    expect(screen.getCursorScreenPoint).toHaveBeenCalledTimes(4);
    expect(sampleDrag).not.toHaveBeenCalled(); expect(changed).toHaveBeenCalledTimes(1);
    poller.configure(false, false); vi.mocked(screen.getCursorScreenPoint).mockClear();
    vi.advanceTimersByTime(5000);
    expect(screen.getCursorScreenPoint).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
    poller.configure(true, false); expect(changed).toHaveBeenCalledTimes(2);
    poller.configure(true, false); expect(vi.getTimerCount()).toBe(1);
  });
});
