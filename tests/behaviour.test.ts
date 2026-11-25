import { describe, expect, it } from 'vitest';
import { BehaviourScheduler, weightedChoice } from '../src/core/behaviour';

const options = { paused: false, sleeping: false, walkingEnabled: true, busy: false };
function rng(seed: number): () => number { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
describe('behaviour scheduler', () => {
  it('selects weighted buckets at their boundaries', () => {
    const choices = [['idle', 8], ['walk', 2]] as const;
    expect(weightedChoice(choices, () => 0.79)).toBe('idle'); expect(weightedChoice(choices, () => 0.8)).toBe('walk');
  });
  it('has reproducible weighted choices with injected RNG and clock', () => {
    let now = 0; const first = new BehaviourScheduler(rng(45), () => now); const second = new BehaviourScheduler(rng(45), () => now);
    const sequence: Array<string | null> = [];
    for (let i = 0; i < 100; i++) { now += 16000; const choice = first.tick(options); expect(choice).toBe(second.tick(options)); sequence.push(choice); }
    expect(sequence.filter(v => v === 'idle').length).toBeGreaterThan(sequence.filter(v => v === 'walk_left').length);
    expect(sequence).toContain('walk_right'); expect(sequence).toContain('sitting');
  });
  it('never walks while paused, sleeping, busy, or walking is disabled', () => {
    const scheduler = new BehaviourScheduler(() => 0.99, () => 100);
    expect(scheduler.tick({ ...options, paused: true })).toBeNull();
    expect(scheduler.tick({ ...options, busy: true })).toBeNull();
    expect(scheduler.tick({ ...options, sleeping: true })).toBe('sleeping');
    expect(new BehaviourScheduler(() => 0.99).tick({ ...options, walkingEnabled: false })).toBe('sitting');
  });
  it('honours scheduling delay and bounded walk distances', () => {
    const scheduler = new BehaviourScheduler(() => 0, () => 0);
    expect(scheduler.tick(options)).toBe('idle'); expect(scheduler.tick(options)).toBeNull(); expect(scheduler.walkDistance()).toBe(70);
  });
});
