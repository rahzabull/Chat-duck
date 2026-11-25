import { SKILL_PACK_IDS } from '../../core/skills';
import { MOODS } from '../../core/emotions';
import { sanitizeName } from '../../core/memory';
import type { EditableSettings, Settings } from '../types';

export const DEFAULT_SETTINGS: Settings = {
  skillPack: 'companion', privacyMode: false, dndUntil: 0, gamingBehaviour: 'hide', dndReminders: 'notification',
  quietHoursEnabled: false, quietHoursStart: '23:00', quietHoursEnd: '08:00',
  morningBriefing: true, briefingStart: '05:00', briefingEnd: '12:00', eveningSummary: false, deadlineNudges: true, assistanceOffers: true,
  proactiveHistory: {}, talkHintCount: 0,
  conversationShortcut: 'Ctrl+Alt+D', conversationRetention: '7 days',
  personality: 'sarcastic', profanity: false, activityLevel: 'normal', memoryEnabled: true, preferredName: '', installSeed: 0, dailyMood: null,
  alwaysOnTop: true, desktopOnly: false, characterSize: 1, launchAtStartup: false,
  walking: true, talkativeness: 'normal', idleToSleepMinutes: 5, reducedMotion: false,
  mute: false, appAwareness: false, firstLaunchDone: false, position: null,
  aiEnabled: false, aiModel: '', ollamaPort: 11434,
};
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
export const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
export const isPoint = (value: unknown): value is { x: number; y: number } =>
  isRecord(value) && Object.keys(value).length === 2 && finite(value.x) && finite(value.y) &&
  Math.abs(value.x) <= 1000000 && Math.abs(value.y) <= 1000000;
const booleanKeys = ['privacyMode', 'quietHoursEnabled', 'morningBriefing', 'eveningSummary', 'deadlineNudges', 'assistanceOffers', 'alwaysOnTop', 'desktopOnly', 'launchAtStartup', 'walking', 'reducedMotion', 'mute', 'appAwareness', 'aiEnabled', 'profanity', 'memoryEnabled'] as const;
export const isModelName = (value: unknown): value is string => typeof value === 'string' && (value === '' || /^[A-Za-z0-9][A-Za-z0-9._:/+-]{0,199}$/.test(value));
const isPort = (value: unknown): value is number => finite(value) && Number.isInteger(value) && value >= 1 && value <= 65535;

export const isShortcut = (v: unknown): v is string => typeof v === 'string' && /^(?:(?:Ctrl|Alt|Shift|Super)\+){1,3}(?:[A-Z0-9]|F(?:[1-9]|1[0-2]))$/.test(v) && new Set(v.split('+')).size === v.split('+').length;

const timeKeys = ['quietHoursStart', 'quietHoursEnd', 'briefingStart', 'briefingEnd'] as const;
const validTime = (v: unknown): v is string => typeof v === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v);
const validDnd = (v: unknown): v is number => finite(v) && Number.isSafeInteger(v) && v >= -1 && v <= 8640000000000000;

/** Tolerant disk boundary: invalid fields fall back independently. */
export function parseSettings(value: unknown): Settings {
  const result: Settings = { ...DEFAULT_SETTINGS };
  if (!isRecord(value)) return result;
  if (finite(value.talkHintCount) && Number.isInteger(value.talkHintCount)) result.talkHintCount = Math.min(3, Math.max(0, value.talkHintCount));
  if (SKILL_PACK_IDS.includes(value.skillPack as never)) result.skillPack = value.skillPack as Settings['skillPack'];
  if (validDnd(value.dndUntil)) result.dndUntil = value.dndUntil;
  if (['hide', 'freeze'].includes(value.gamingBehaviour as string)) result.gamingBehaviour = value.gamingBehaviour as Settings['gamingBehaviour'];
  if (['notification', 'bubble'].includes(value.dndReminders as string)) result.dndReminders = value.dndReminders as Settings['dndReminders'];
  for (const key of timeKeys) if (validTime(value[key])) result[key] = value[key];
  if (isRecord(value.proactiveHistory)) result.proactiveHistory = Object.fromEntries(Object.entries(value.proactiveHistory).filter(([k, v]) => /^(?:briefing_morning|summary_evening|overdue_nudge|deadline:[\w:-]+)$/.test(k) && k.length < 200 && finite(v) && v >= 0).slice(-512)) as Record<string, number>;
  if (isShortcut(value.conversationShortcut)) result.conversationShortcut = value.conversationShortcut;
  if (['off', '7 days', '30 days'].includes(value.conversationRetention as string)) result.conversationRetention = value.conversationRetention as Settings['conversationRetention'];
  if (['wholesome', 'playful', 'sarcastic', 'unhinged'].includes(value.personality as string)) result.personality = value.personality as Settings['personality'];
  if (['calm', 'normal', 'lively'].includes(value.activityLevel as string)) result.activityLevel = value.activityLevel as Settings['activityLevel'];
  if (typeof value.preferredName === 'string') result.preferredName = sanitizeName(value.preferredName);
  if (finite(value.installSeed) && Number.isInteger(value.installSeed) && value.installSeed > 0 && value.installSeed <= 4294967295) result.installSeed = value.installSeed;
  if (isRecord(value.dailyMood) && typeof value.dailyMood.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.dailyMood.date) && MOODS.includes(value.dailyMood.mood as never)) result.dailyMood = { date: value.dailyMood.date, mood: value.dailyMood.mood as NonNullable<Settings['dailyMood']>['mood'] };
  if (isModelName(value.aiModel)) result.aiModel = value.aiModel;
  if (isPort(value.ollamaPort)) result.ollamaPort = value.ollamaPort;
  for (const key of booleanKeys) if (typeof value[key] === 'boolean') result[key] = value[key];
  if (typeof value.firstLaunchDone === 'boolean') result.firstLaunchDone = value.firstLaunchDone;
  if (finite(value.characterSize)) result.characterSize = Math.min(1.6, Math.max(0.6, value.characterSize));
  if (finite(value.idleToSleepMinutes)) result.idleToSleepMinutes = Math.min(120, Math.max(1, value.idleToSleepMinutes));
  if (['quiet', 'normal', 'chatty'].includes(value.talkativeness as string)) result.talkativeness = value.talkativeness as Settings['talkativeness'];
  if (isPoint(value.position)) result.position = { ...value.position };
  if (!result.memoryEnabled) result.preferredName = '';
  return result;
}

/** Strict IPC boundary: reject the entire patch, including unknown keys. */
export function isSettingsPatch(value: unknown): value is Partial<EditableSettings> {
  if (!isRecord(value) || Object.keys(value).length === 0) return false;
  return Object.entries(value).every(([key, v]) => {
    if (key === 'skillPack') return SKILL_PACK_IDS.includes(v as never);
    if (key === 'dndUntil') return validDnd(v);
    if (key === 'gamingBehaviour') return ['hide', 'freeze'].includes(v as string);
    if (key === 'dndReminders') return ['notification', 'bubble'].includes(v as string);
    if ((timeKeys as readonly string[]).includes(key)) return validTime(v);
    if (key === 'conversationShortcut') return isShortcut(v);
    if (key === 'conversationRetention') return ['off', '7 days', '30 days'].includes(v as string);
    if (key === 'personality') return ['wholesome', 'playful', 'sarcastic', 'unhinged'].includes(v as string);
    if (key === 'activityLevel') return ['calm', 'normal', 'lively'].includes(v as string);
    if (key === 'preferredName') return typeof v === 'string' && v.length <= 30;
    if (key === 'aiModel') return isModelName(v);
    if (key === 'ollamaPort') return isPort(v);
    if ((booleanKeys as readonly string[]).includes(key)) return typeof v === 'boolean';
    if (key === 'characterSize') return finite(v) && v >= 0.6 && v <= 1.6;
    if (key === 'idleToSleepMinutes') return finite(v) && v >= 1 && v <= 120;
    if (key === 'talkativeness') return ['quiet', 'normal', 'chatty'].includes(v as string);
    return false;
  });
}
