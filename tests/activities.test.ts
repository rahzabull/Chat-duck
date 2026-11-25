import { describe, expect, it } from 'vitest';
import { ACTIVITIES, ACTIVITY_DURATION, BehaviourScheduler, RARE_COOLDOWN } from '../src/core/behaviour';
import { baseline } from '../src/core/emotions';
import { ANIMATION_IDS } from '../src/animation/adapter';
import { awarenessScript } from '../src/main/platform/awareness-script';
const options = { paused: false, sleeping: false, walkingEnabled: true, busy: false };
const seeded = (seed: number) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
describe('autonomous activities', () => {
  it.each(['paused', 'hidden', 'dragging', 'fullscreen', 'busy'] as const)('blocks even rare activities when %s', key => {
    expect(new BehaviourScheduler(() => .99999, () => 0).tick({ ...options, [key]: true })).toBeNull();
  });
  it('only naps with high sleepiness and sleepy moods yawn more', () => {
    function sample(sleepy: boolean) {
      let now = 0; const scheduler = new BehaviourScheduler(seeded(61), () => now); const list: string[] = [];
      for (let i = 0; i < 5000; i++) { now += 16000; const activity = scheduler.tick({ ...options, emotions: baseline(sleepy ? 'sleepy' : 'happy') }); if (activity) list.push(activity); }
      return list;
    }
    const normal = sample(false), sleepy = sample(true);
    expect(normal).not.toContain('nap'); expect(sleepy).toContain('nap');
    expect(sleepy.filter(a => a === 'yawn').length).toBeGreaterThan(normal.filter(a => a === 'yawn').length * 2);
  });
  it('scales autonomous frequency without touching talkativeness', () => {
    function decisions(activityLevel: 'calm' | 'normal' | 'lively') {
      let now = 0, count = 0; const scheduler = new BehaviourScheduler(seeded(34), () => now);
      for (; now < 3600000; now += 2000) if (scheduler.tick({ ...options, activityLevel })) count++;
      return count;
    }
    expect(decisions('lively')).toBeGreaterThan(decisions('normal') * 1.5);
    expect(decisions('normal')).toBeGreaterThan(decisions('calm') * 1.5);
  });
  it.each(Object.entries(RARE_COOLDOWN))('enforces the independent %s cooldown', (id, cooldown) => {
    let now = 0, call = 0;
    const order = Object.keys(RARE_COOLDOWN).indexOf(id);
    // Tick consumes a delay roll, then one roll per eligible rare event.
    const scheduler = new BehaviourScheduler(() => ++call === order + 2 ? .9999999 : 0, () => now);
    expect(scheduler.tick(options)).toBe(id);
    now = cooldown - 1; call = 0; expect(scheduler.tick(options)).not.toBe(id);
    now = cooldown + 16000; call = 0; expect(scheduler.tick(options)).toBe(id);
  });
  it('visitors average roughly once per active day at normal level', () => {
    let now = 0, visits = 0; const scheduler = new BehaviourScheduler(seeded(713), () => now);
    const days = 120;
    for (; now < days * 86400000; now += 2000) if (scheduler.tick(options) === 'visitor') visits++;
    expect(visits / days).toBeGreaterThan(.5); expect(visits / days).toBeLessThan(1.5);
  });
  it('covers every activity through the adapter and holds finite event durations', () => {
    for (const id of ACTIVITIES) expect(ANIMATION_IDS).toContain(id.startsWith('walk_') ? 'walking' : id);
    expect(ACTIVITY_DURATION.dance).toBe(2000); expect(ACTIVITY_DURATION.strike).toBe(8000);
    expect(ACTIVITY_DURATION.sunglasses).toBe(120000);
  });
  it('the fullscreen-only helper never reads foreground process identity', () => {
    const script = awarenessScript(123, [], false);
    expect(script).toContain('GetWindowRect'); expect(script).toContain('return "unknown" + suffix;');
    for (const text of ['QueryFullProcessImageName', 'GetWindowThreadProcessId', 'OpenProcess(0x1000', 'GetFileName', 'GetWindowText']) expect(script).not.toContain(text);
  });
});
