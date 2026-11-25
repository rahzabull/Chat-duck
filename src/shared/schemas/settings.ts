import type { EditableSettings, Settings } from '../types';

export const DEFAULT_SETTINGS: Settings = {
  alwaysOnTop: true, desktopOnly: false, characterSize: 1, launchAtStartup: false,
  walking: true, talkativeness: 'normal', idleToSleepMinutes: 5, reducedMotion: false,
  mute: false, firstLaunchDone: false, position: null,
};
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
export const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
export const isPoint = (value: unknown): value is { x: number; y: number } =>
  isRecord(value) && Object.keys(value).length === 2 && finite(value.x) && finite(value.y) &&
  Math.abs(value.x) <= 1000000 && Math.abs(value.y) <= 1000000;
const booleanKeys = ['alwaysOnTop', 'desktopOnly', 'launchAtStartup', 'walking', 'reducedMotion', 'mute'] as const;

/** Tolerant disk boundary: invalid fields fall back independently. */
export function parseSettings(value: unknown): Settings {
  const result: Settings = { ...DEFAULT_SETTINGS };
  if (!isRecord(value)) return result;
  for (const key of booleanKeys) if (typeof value[key] === 'boolean') result[key] = value[key];
  if (typeof value.firstLaunchDone === 'boolean') result.firstLaunchDone = value.firstLaunchDone;
  if (finite(value.characterSize)) result.characterSize = Math.min(1.6, Math.max(0.6, value.characterSize));
  if (finite(value.idleToSleepMinutes)) result.idleToSleepMinutes = Math.min(120, Math.max(1, value.idleToSleepMinutes));
  if (['quiet', 'normal', 'chatty'].includes(value.talkativeness as string)) result.talkativeness = value.talkativeness as Settings['talkativeness'];
  if (isPoint(value.position)) result.position = { ...value.position };
  return result;
}

/** Strict IPC boundary: reject the entire patch, including unknown keys. */
export function isSettingsPatch(value: unknown): value is Partial<EditableSettings> {
  if (!isRecord(value) || Object.keys(value).length === 0) return false;
  return Object.entries(value).every(([key, v]) => {
    if ((booleanKeys as readonly string[]).includes(key)) return typeof v === 'boolean';
    if (key === 'characterSize') return finite(v) && v >= 0.6 && v <= 1.6;
    if (key === 'idleToSleepMinutes') return finite(v) && v >= 1 && v <= 120;
    if (key === 'talkativeness') return ['quiet', 'normal', 'chatty'].includes(v as string);
    return false;
  });
}
