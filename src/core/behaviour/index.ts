export type Behaviour = 'idle' | 'look_left' | 'look_right' | 'walk_left' | 'walk_right' | 'sitting' | 'sleeping';
export function weightedChoice<T>(entries: ReadonlyArray<readonly [T, number]>, rng: () => number): T {
  let remaining = rng() * entries.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [value, weight] of entries) { remaining -= weight; if (remaining < 0) return value; }
  return entries[entries.length - 1][0];
}
export class BehaviourScheduler {
  private nextAt = 0;
  constructor(private rng = Math.random, private clock = Date.now) {}
  tick(state: { paused: boolean; sleeping: boolean; walkingEnabled: boolean; busy: boolean }): Behaviour | null {
    if (state.paused || state.busy || this.clock() < this.nextAt) return null;
    this.nextAt = this.clock() + 5000 + this.rng() * 10000;
    if (state.sleeping) return 'sleeping';
    const choices: Array<[Behaviour, number]> = [['idle', 40], ['look_left', 15], ['look_right', 15], ['sitting', 15]];
    if (state.walkingEnabled) choices.push(['walk_left', 8], ['walk_right', 8]);
    return weightedChoice(choices, this.rng);
  }
  walkDistance(): number { return 70 + this.rng() * 180; }
}
