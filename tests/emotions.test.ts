import { describe, expect, it } from 'vitest';
import { baseline, dailyMood, EmotionEngine, localDay, MOODS } from '../src/core/emotions';
import { InteractionContext } from '../src/core/dialogue/context';
describe('simulated emotions', () => {
  it('halves distance from the mood baseline in ten minutes', () => {
    let now = new Date(2026, 0, 1, 12).getTime(); const e = new EmotionEngine('happy', () => now);
    e.values.happiness = 100; now += 600000; e.tick();
    expect(e.values.happiness).toBe((100 + baseline('happy').happiness) / 2);
    for (const n of Object.values(e.values)) expect(n).toBeGreaterThanOrEqual(0);
  });
  it('caps inputs, escalates clicks/shakes but never gentle visits', () => {
    const e = new EmotionEngine('happy', () => 0), start = e.values.irritation;
    for (let i = 0; i < 100; i++) e.input('hover');
    expect(e.values.irritation).toBe(start); expect(e.patience).toBe(0); expect(e.values.sociability).toBe(100);
    const gentle = new EmotionEngine('happy', () => 0), streak = new EmotionEngine('happy', () => 0);
    gentle.input('click'); streak.input('click', 5); expect(streak.values.irritation).toBeGreaterThan(gentle.values.irritation);
    streak.input('drag'); streak.input('shake'); expect(streak.values.irritation).toBeGreaterThan(40);
    for (let i = 0; i < 100; i++) streak.input('click', 10);
    expect(streak.values.irritation).toBe(100); expect(streak.face()).toBe('angry'); expect(streak.patience).toBe(20);
  });
  it('has no away penalty or hidden/paused catch-up, and welcomes returning', () => {
    let now = 0; const e = new EmotionEngine('happy', () => now); const start = { ...e.values };
    now += 86400000; e.tick(false); expect(e.values).toEqual(start);
    now += 86400000; e.tick(true, true); expect(e.values).toEqual(start);
    e.input('return'); expect(e.values.happiness).toBeGreaterThan(start.happiness); expect(e.values.irritation).toBe(start.irritation);
    now += 600000; e.suspend(); e.tick(); expect(e.values.boredom).toBe(0);
  });
  it('caps idle boredom and clears it on any interaction without unhappiness', () => {
    let now = new Date(2026, 0, 1, 12).getTime(); const e = new EmotionEngine('happy', () => now);
    now += 3600000; e.tick(); expect(e.values.boredom).toBeLessThanOrEqual(55); expect(e.values.happiness).toBe(78);
    const boredom = e.values.boredom; e.input('hover'); expect(e.values.boredom).toBeLessThan(boredom);
  });
  it('gets sleepy late and energetic in the morning, exposes words and faces', () => {
    let now = new Date(2026, 0, 1, 23).getTime(); const e = new EmotionEngine('curious', () => now);
    now += 3600000; e.tick(); expect(e.values.sleepiness).toBeGreaterThan(70); expect(e.face()).toBe('sleepy');
    now = new Date(2026, 0, 2, 8).getTime(); e.tick(); expect(e.values.energy).toBeGreaterThan(75);
    expect(e.words()).toHaveLength(2); expect(e.words()).toContain('energetic');
    expect(new EmotionEngine('grumpy').speechScale()).toBeLessThan(new EmotionEngine('chaotic').speechScale());
  });
  it('resets daily patience and shortens repeated click/drag tolerance only after poking', () => {
    let now = new Date(2026, 0, 1, 12).getTime(); const e = new EmotionEngine('happy', () => now);
    e.restorePokes(30); expect(e.patience).toBe(12);
    const c = new InteractionContext(() => now); c.click(e.patience); c.click(e.patience); expect(c.click(e.patience)?.situation).toBe('click_angry');
    const d = new InteractionContext(() => now); d.pickup({ x: 0, y: 0 }, e.patience); expect(d.pickup({ x: 0, y: 0 }, e.patience).situation).toBe('pickup_again');
    now += 86400000; expect(e.patience).toBe(0); expect(e.dailyPokes).toBe(0);
  });
  it('chooses stable local daily moods with install diversity and preset bias', () => {
    const date = localDay(new Date(2026, 0, 1, 23, 59).getTime()); expect(date).toBe('2026-01-01');
    expect(dailyMood(date, 4, 'unhinged')).toBe(dailyMood(date, 4, 'unhinged'));
    const moods = Array.from({ length: 3000 }, (_, seed) => dailyMood(date, seed, 'unhinged'));
    expect(new Set(moods).size).toBe(MOODS.length);
    expect(moods.filter(m => m === 'chaotic').length).toBeGreaterThan(moods.filter(m => m === 'happy').length * 2);
  });
});
