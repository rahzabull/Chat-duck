import type { PresetId } from '../dialogue/presets';
import type { EmotionId } from '../../animation/adapter';

export const MOODS = ['happy', 'grumpy', 'philosophical', 'sleepy', 'curious', 'chaotic', 'motivated'] as const;
export type Mood = typeof MOODS[number];
export type Emotions = Record<'happiness' | 'irritation' | 'boredom' | 'curiosity' | 'energy' | 'sleepiness' | 'sociability', number>;
export const localDay = (now: number): string => {
  const d = new Date(now); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export function dailyMood(date: string, seed: number, preset: PresetId): Mood {
  let hash = seed >>> 0;
  for (const char of date) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  hash ^= hash >>> 16; hash = Math.imul(hash, 0x45d9f3b) >>> 0; hash ^= hash >>> 16;
  const weights = MOODS.map(m => m === ({ wholesome: 'happy', playful: 'curious', sarcastic: 'grumpy', unhinged: 'chaotic' } as const)[preset] ? 3 : 1);
  let roll = (hash >>> 0) / 4294967296 * weights.reduce((a, b) => a + b, 0);
  return MOODS[weights.findIndex(w => (roll -= w) < 0)] ?? 'happy';
}
export function baseline(mood: Mood, patience = 0): Emotions {
  return { happiness: mood === 'happy' ? 78 : 55, irritation: Math.min(55, (mood === 'grumpy' ? 38 : 10) + patience),
    boredom: 15, curiosity: ['curious', 'philosophical', 'chaotic'].includes(mood) ? 80 : 45,
    energy: mood === 'motivated' ? 85 : mood === 'sleepy' ? 25 : 55,
    sleepiness: mood === 'sleepy' ? 76 : 15, sociability: mood === 'happy' ? 78 : 45 };
}
export class EmotionEngine {
  values: Emotions;
  private last: number;
  private interactionAt: number;
  private day: string;
  private pokes = 0;
  constructor(public mood: Mood, private clock = Date.now) {
    this.last = this.interactionAt = clock(); this.day = localDay(this.last); this.values = baseline(mood);
  }
  private rollover(): void { const day = localDay(this.clock()); if (day !== this.day) { this.day = day; this.pokes = 0; } }
  get patience(): number { this.rollover(); return Math.min(20, Math.floor(this.pokes / 5) * 2); }
  restorePokes(count: number): void { this.rollover(); this.pokes = count; }
  get dailyPokes(): number { this.rollover(); return this.pokes; }
  suspend(): void { this.last = this.interactionAt = this.clock(); }
  input(kind: 'click' | 'drag' | 'shake' | 'hover' | 'return', streak = 1): void {
    this.rollover(); this.interactionAt = this.clock(); this.values.boredom = Math.max(0, this.values.boredom - 20);
    if (kind === 'click' || kind === 'drag' || kind === 'shake') {
      this.pokes++; this.values.irritation = Math.min(100, this.values.irritation + (kind === 'shake' ? 20 : kind === 'drag' ? 8 : 4 + Math.min(8, streak)));
    }
    if (kind === 'hover') this.values.sociability = Math.min(100, this.values.sociability + 5);
    if (kind === 'return') this.values.happiness = Math.min(100, this.values.happiness + 12);
  }
  tick(active = true, away = false): void {
    const now = this.clock(); const elapsed = Math.max(0, now - this.last); this.last = now;
    this.rollover(); if (!active || away) { this.interactionAt = now; return; }
    const target = baseline(this.mood, this.patience), hour = new Date(now).getHours();
    if (hour >= 23 || hour < 5) target.sleepiness = Math.max(85, target.sleepiness);
    if (hour >= 6 && hour < 11) target.energy = Math.max(80, target.energy);
    // Boredom is mild, cosmetic, and never reduces happiness or raises irritation.
    if (now - this.interactionAt > 600000) target.boredom = 55;
    const retention = Math.pow(.5, elapsed / 600000);
    for (const key of Object.keys(target) as (keyof Emotions)[]) this.values[key] = Math.max(0, Math.min(100, target[key] + (this.values[key] - target[key]) * retention));
  }
  face(): EmotionId { const v = this.values; return v.irritation > 60 ? 'angry' : v.sleepiness > 70 ? 'sleepy' : v.sociability > 70 ? 'happy' : v.curiosity > 65 ? 'curious' : 'neutral'; }
  words(): string[] { return Object.entries(this.values).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([key]) => ({ happiness: 'happy', irritation: 'irritated', boredom: 'bored', curiosity: 'curious', energy: 'energetic', sleepiness: 'sleepy', sociability: 'sociable' })[key]!); }
  speechScale(): number { return (this.mood === 'grumpy' ? .65 : this.mood === 'sleepy' ? .7 : this.mood === 'chaotic' ? 1.2 : 1) * (0.8 + this.values.sociability / 250); }
}
