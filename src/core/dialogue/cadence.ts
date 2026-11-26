import type { Settings } from '../../shared/types';

/** Milliseconds. The single source of truth for autonomous speech and capture rates. */
export const TALK_CADENCE = {
  quiet: { thoughts: [1200000, 2400000], app: 900000, follow: null, vision: null },
  normal: { thoughts: [480000, 900000], app: 480000, follow: null, vision: [300000, 300000] },
  chatty: { thoughts: [180000, 360000], app: 180000, follow: [300000, 600000], vision: [120000, 180000] },
  unhinged: { thoughts: [60000, 180000], app: 60000, follow: [120000, 240000], vision: [60000, 90000] },
} as const;
export const between = (range: readonly [number, number], rng = Math.random): number => range[0] + rng() * (range[1] - range[0]);
/** Scale personality inside the requested bounds, never outside the cadence contract. */
export function ambientDelay(talk: Settings['talkativeness'], scale = 1, rng = Math.random): number {
  const range = TALK_CADENCE[talk].thoughts;
  return Math.max(range[0], Math.min(range[1], between(range, rng) / scale));
}
