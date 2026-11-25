import { describe, expect, it } from 'vitest';
import { DialogueDirector, fillTemplate, POLICIES, thoughtDelay, thoughtSituation, timeAway } from '../src/core/dialogue';
import { LINES, type Situation } from '../src/core/dialogue/lines';
import { ANIMATION_IDS, EMOTION_IDS } from '../src/animation/adapter';
function seeded(seed: number) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); }

describe('dialogue director', () => {
  it('fills every slot using local time and human away durations', () => {
    const now = new Date(2026, 10, 25, 1, 40).getTime();
    expect(fillTemplate('{app}/{minutes}/{hours}/{count}/{timeAway}/{time}', { app: 'VS Code', minutes: 120, count: 7, awayMs: 20 * 60000 }, now))
      .toBe('VS Code/120/2/7/twenty minutes/1:40 AM');
    expect([3, 20, 60, 180].map(n => timeAway(n * 60000))).toEqual(['a few minutes', 'twenty minutes', 'about an hour', 'three hours']);
  });
  it('cycles shuffled bags without repeats and never repeats the last twelve selections', () => {
    let now = 0; const director = new DialogueDirector(seeded(21), () => now);
    const lines: string[] = [];
    for (let i = 0; i < 70; i++) {
      now += 3600000;
      const result = director.decide('thought');
      expect(result).not.toBeNull(); expect(lines.slice(-12)).not.toContain(result!.text); lines.push(result!.text);
    }
    for (let i = 0; i < 70; i += 14) expect(new Set(lines.slice(i, i + 14)).size).toBe(14);
    expect(lines.slice(0, 14)).not.toEqual(LINES.thought.map(line => line.text));
  });
  it('keeps exclusion across situations and stays silent when a small bag is exhausted', () => {
    let now = 0; const director = new DialogueDirector(() => 0, () => now);
    const history: string[] = [];
    const situations = Object.keys(LINES) as Situation[];
    for (let i = 0; i < 300; i++) {
      now += 3600000; const result = director.decide(situations[i % situations.length]);
      if (!result) continue;
      expect(history.slice(-12)).not.toContain(result.text); history.push(result.text);
      expect(ANIMATION_IDS).toContain(result.animation); expect(EMOTION_IDS).toContain(result.emotion);
    }
    const small = new DialogueDirector(() => 0, () => now);
    for (let i = 0; i < 8; i++) { now += 60000; expect(small.decide('click')).not.toBeNull(); }
    now += 60000; expect(small.decide('click')).toBeNull();
  });
  it('uses the chance table with a seeded roll and scales talkativeness', () => {
    for (const situation of Object.keys(POLICIES) as Situation[]) {
      for (const talkativeness of ['quiet', 'normal', 'chatty'] as const) {
        const chance = POLICIES[situation][0];
        const threshold = Math.min(1, chance >= .9 ? chance : chance * (talkativeness === 'quiet' ? .5 : talkativeness === 'chatty' ? 1.5 : 1));
        for (let seed = 0; seed < 100; seed += 7) {
          const roll = seeded(seed * 9001)();
          const director = new DialogueDirector(seeded(seed * 9001), () => 0);
          expect(!!director.decide(situation, { talkativeness })).toBe(roll < threshold);
        }
      }
    }
  });
  it('honours cooldowns and only consumes accepted speech', () => {
    let now = 0; const director = new DialogueDirector(() => 0, () => now);
    expect(director.decide('hover', {}, () => false)).toBeNull();
    const first = director.decide('hover'); expect(first?.text).toBe(LINES.hover[0].text);
    now = 44999; expect(director.decide('hover')).toBeNull();
    now = 45000; expect(director.decide('hover')).not.toBeNull();
    now = 50000; expect(director.decide('app_browser', { app: 'Chrome' })).not.toBeNull();
    now += 599999; expect(director.decide('app_browser_long', { app: 'Chrome' })).toBeNull();
    now++; expect(director.decide('app_browser_long', { app: 'Chrome' })).not.toBeNull();
  });
  it('suppresses low/medium lines in fullscreen and never calls the duck an AI', () => {
    const director = new DialogueDirector(() => 0, () => 0);
    expect(director.decide('click', { fullscreen: true })).toBeNull();
    expect(director.decide('thought', { fullscreen: true })).toBeNull();
    expect(director.decide('click_angry', { fullscreen: true })).not.toBeNull();
    expect(director.decide('app_ai')?.text).not.toContain('another AI');
  });
  it('selects thoughts by local hour and uses the requested interval ranges', () => {
    for (const [hour, situation] of [[0, 'thought_late'], [3, 'thought_late'], [4, 'thought'], [6, 'thought_morning'], [9, 'thought_morning'], [10, 'thought'], [23, 'thought']] as const)
      expect(thoughtSituation(new Date(2026, 10, 25, hour))).toBe(situation);
    for (const [talk, min, max] of [['quiet', 15, 35], ['normal', 8, 20], ['chatty', 4, 10]] as const) {
      expect(thoughtDelay(talk, () => 0)).toBe(min * 60000);
      expect(thoughtDelay(talk, () => 1)).toBe(max * 60000);
    }
  });
});
