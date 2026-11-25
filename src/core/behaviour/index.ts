import type { Emotions, Mood } from '../emotions';
export const ACTIVITIES = ['idle', 'look_around', 'walk_left', 'walk_right', 'sitting', 'yawn', 'stretch', 'dance', 'side_eye', 'nap', 'strike', 'sunglasses', 'bread_snack', 'visitor'] as const;
export type Activity = typeof ACTIVITIES[number];
export type Behaviour = Activity | 'look_left' | 'look_right' | 'sleeping';
export const ACTIVITY_DURATION: Partial<Record<Behaviour, number>> = { look_around: 2400, sitting: 5000, yawn: 1800, stretch: 1800, dance: 2000, side_eye: 2000, nap: 15000, strike: 8000, sunglasses: 120000, bread_snack: 3500, visitor: 10000 };
export const RARE_COOLDOWN = { strike: 3600000, sunglasses: 7200000, bread_snack: 1800000, visitor: 43200000 };
export function weightedChoice<T>(entries: ReadonlyArray<readonly [T, number]>, rng: () => number): T {
  let remaining = rng() * entries.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [value, weight] of entries) { remaining -= weight; if (remaining < 0) return value; }
  return entries[entries.length - 1][0];
}
export class BehaviourScheduler {
  private nextAt = 0;
  private rareAt = new Map<string, number>();
  constructor(private rng = Math.random, private clock = Date.now) {}
  tick(state: { paused: boolean; sleeping: boolean; walkingEnabled: boolean; busy: boolean; hidden?: boolean; dragging?: boolean; fullscreen?: boolean; activityLevel?: 'calm' | 'normal' | 'lively'; mood?: Mood; emotions?: Emotions }): Behaviour | null {
    if (state.paused || state.hidden || state.dragging || state.fullscreen || state.busy || this.clock() < this.nextAt) return null;
    const frequency = state.activityLevel === 'calm' ? 2 : state.activityLevel === 'lively' ? .55 : 1;
    this.nextAt = this.clock() + (5000 + this.rng() * 10000) * frequency;
    if (state.sleeping) return 'sleeping';
    const v = state.emotions;
    const choices: Array<[Behaviour, number]> = [['idle', 40], ['look_around', 10 + (v?.curiosity ?? 40) / 8],
      ['yawn', 2 + (v?.sleepiness ?? 15) / 6], ['stretch', 7], ['dance', (v?.energy ?? 50) / 12],
      ['side_eye', 3 + (v?.irritation ?? 10) / 8], ['sitting', 15]];
    if (state.walkingEnabled) choices.push(['walk_left', 8], ['walk_right', 8]);
    if ((v?.sleepiness ?? 0) > 70) choices.push(['nap', 15]);
    const chaos = state.mood === 'chaotic' ? 2 : 1;
    for (const [id, weight] of [['strike', .15], ['sunglasses', .12], ['bread_snack', .3], ['visitor', .018]] as const) {
      if (this.clock() >= (this.rareAt.get(id) ?? 0) && this.rng() > 1 - weight * chaos / 100) {
        this.rareAt.set(id, this.clock() + RARE_COOLDOWN[id]); return id;
      }
    }
    return weightedChoice(choices, this.rng);
  }
  walkDistance(): number { return 70 + this.rng() * 180; }
}
