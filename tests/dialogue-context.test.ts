import { describe, expect, it } from 'vitest';
import { InteractionContext, landingSituation } from '../src/core/dialogue/context';
describe('interaction context', () => {
  it('maps clicks 1, 2-4 and 5+, angers once per streak, then forgives after twenty quiet seconds', () => {
    let now = 0; const tracker = new InteractionContext(() => now);
    for (const situation of ['click', 'click_escalate', 'click_escalate', 'click_escalate', 'click_angry', undefined]) {
      now += 200; expect(tracker.click()?.situation).toBe(situation);
    }
    now += 19999; expect(tracker.tick()).toEqual([]);
    now++; expect(tracker.tick()).toEqual([{ situation: 'click_forgive' }]); expect(tracker.tick()).toEqual([]);
    expect(tracker.click()?.situation).toBe('click');
  });
  it('postpones forgiveness on any subsequent click', () => {
    let now = 0; const tracker = new InteractionContext(() => now);
    for (let i = 0; i < 5; i++) tracker.click();
    now = 19000; tracker.click(); now = 20000; expect(tracker.tick()).toEqual([]);
    now = 39000; expect(tracker.tick()[0].situation).toBe('click_forgive');
  });
  it('counts separate hovers and emits lingering only once, never after leave', () => {
    let now = 0; const tracker = new InteractionContext(() => now);
    expect(tracker.hover(true)?.situation).toBe('hover'); expect(tracker.hover(true)).toBeNull();
    now = 2500; expect(tracker.tick()).toEqual([]);
    now++; expect(tracker.tick()).toEqual([{ situation: 'hover_linger' }]); expect(tracker.tick()).toEqual([]);
    tracker.hover(false); tracker.hover(true); tracker.hover(false);
    expect(tracker.hover(true)).toEqual({ situation: 'hover_again', context: { count: 3 } });
    tracker.hover(false); now += 60000; expect(tracker.tick()).toEqual([]); expect(tracker.hover(true)?.situation).toBe('hover');
  });
  it('counts pickups over two minutes, long holds once, and forgets released holds', () => {
    let now = 0; const tracker = new InteractionContext(() => now);
    expect(tracker.pickup({ x: 0, y: 0 }).situation).toBe('pickup');
    now = 4001; expect(tracker.tick()).toEqual([{ situation: 'drag_long' }]); expect(tracker.tick()).toEqual([]);
    tracker.release(); tracker.pickup({ x: 0, y: 0 }); tracker.release();
    expect(tracker.pickup({ x: 0, y: 0 })).toEqual({ situation: 'pickup_again', context: { count: 3 } });
    tracker.release(); now += 120001; expect(tracker.tick()).toEqual([]); expect(tracker.pickup({ x: 0, y: 0 }).situation).toBe('pickup');
  });
  it('detects four fast horizontal reversals in a second once per drag, ignoring slow motion', () => {
    let now = 0; const tracker = new InteractionContext(() => now);
    tracker.pickup({ x: 0, y: 0 });
    for (const x of [200, 0, 200, 0]) { now += 100; expect(tracker.drag({ x, y: 0 })).toBeNull(); }
    now += 100; expect(tracker.drag({ x: 200, y: 0 })?.situation).toBe('drag_shaken');
    now += 100; expect(tracker.drag({ x: 0, y: 0 })).toBeNull();
    tracker.release(); tracker.pickup({ x: 0, y: 0 });
    for (let i = 0; i < 10; i++) { now += 100; expect(tracker.drag({ x: i % 2 * 100, y: 0 })).toBeNull(); }
  });
  it('does not combine reversals separated by more than one second', () => {
    let now = 0; const tracker = new InteractionContext(() => now); tracker.pickup({ x: 0, y: 0 });
    for (let i = 0; i < 12; i++) { now += 1100; tracker.drag({ x: 0, y: 0 }); now += 50; expect(tracker.drag({ x: i % 2 ? -200 : 200, y: 0 })).toBeNull(); }
  });
  it('maps final landing height and walls, and wake durations at the boundary', () => {
    expect(landingSituation(500, false)).toBe('drop_small'); expect(landingSituation(501, false)).toBe('drop_big');
    expect(landingSituation(501, true)).toBe('thrown_wall');
    let now = 1000000; const tracker = new InteractionContext(() => now);
    tracker.idle(899); expect(tracker.wake()).toEqual({ situation: 'wake_short', context: { awayMs: 899000 } });
    tracker.idle(900); now += 60000; expect(tracker.wake()).toEqual({ situation: 'wake_long', context: { awayMs: 960000 } });
  });
});
