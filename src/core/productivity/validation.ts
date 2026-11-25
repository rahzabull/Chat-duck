import type { FocusData, Note, Reminder, Task } from './types';
const record = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max = 4000): v is string => typeof v === 'string' && !!v.trim() && v.length <= max;
const optional = (v: unknown, max = 4000) => v === undefined || (typeof v === 'string' && v.length <= max);
export const iso = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/.test(v) && day(v.slice(0, 10)) && Number.isFinite(Date.parse(v));
export const day = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d\d-\d\d$/.test(v) && Number.isFinite(Date.parse(v + 'T12:00:00Z')) && new Date(v + 'T12:00:00Z').toISOString().slice(0, 10) === v;
export const time = (v: unknown): v is string => typeof v === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v);
export function validTask(v: unknown): v is Task {
  return record(v) && text(v.id, 80) && text(v.title) && optional(v.notes) && optional(v.category, 100) &&
    (v.due === undefined || day(v.due)) && (v.dueTime === undefined || time(v.dueTime)) && ['low', 'normal', 'high'].includes(v.priority) &&
    Array.isArray(v.subtasks) && v.subtasks.length <= 100 && v.subtasks.every((s: unknown) => record(s) && text(s.id, 80) && text(s.title) && typeof s.done === 'boolean') && new Set(v.subtasks.map((s: { id: string }) => s.id)).size === v.subtasks.length &&
    typeof v.done === 'boolean' && (v.doneAt === undefined || iso(v.doneAt)) && iso(v.createdAt) && iso(v.updatedAt);
}
export function validReminder(v: unknown): v is Reminder {
  if (!record(v) || !text(v.id, 80) || !text(v.text) || !iso(v.at) || !iso(v.createdAt) || !text(v.timezone, 100) ||
    !['scheduled', 'due', 'done', 'dismissed'].includes(v.state) || (v.snoozedUntil !== undefined && !iso(v.snoozedUntil)) ||
    (v.lastFiredAt !== undefined && !iso(v.lastFiredAt)) || (v.wallTime !== undefined && !time(v.wallTime))) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: v.timezone }); } catch { return false; }
  const r = v.recurrence;
  return r === undefined || (record(r) && (r.kind === 'daily' ||
    (r.kind === 'weekly' && Array.isArray(r.weekdays) && r.weekdays.length > 0 && r.weekdays.length <= 7 && r.weekdays.every((n: unknown) => Number.isInteger(n) && Number(n) >= 0 && Number(n) <= 6)) ||
    (r.kind === 'monthly' && Number.isInteger(r.dayOfMonth) && r.dayOfMonth >= 1 && r.dayOfMonth <= 31) ||
    (r.kind === 'custom' && Number.isInteger(r.intervalDays) && r.intervalDays >= 1 && r.intervalDays <= 3650) ||
    (r.kind === 'interval' && Number.isSafeInteger(r.intervalMinutes) && r.intervalMinutes >= 5 && Date.parse(v.createdAt) + r.intervalMinutes * 60000 <= 8640000000000000 &&
      (r.window === undefined || record(r.window) && time(r.window.start) && time(r.window.end) && r.window.start < r.window.end))));
}
export function validNote(v: unknown): v is Note { return record(v) && text(v.id, 80) && text(v.text, 20000) && optional(v.title) && optional(v.topic, 100) && iso(v.createdAt) && iso(v.updatedAt) && typeof v.pinned === 'boolean'; }
export function validFocus(v: unknown): v is FocusData {
  if (!record(v) || !record(v.settings) || !Array.isArray(v.history) || v.history.length > 1000) return false;
  const s = v.settings;
  return ['notifications', 'autoBreak', 'keepHistory'].every(k => typeof s[k] === 'boolean') &&
    ['defaultSnooze', 'focusMinutes', 'shortMinutes', 'longMinutes'].every(k => typeof s[k] === 'number' && Number.isFinite(s[k]) && s[k] >= .05 && s[k] <= 1440) &&
    v.history.every((h: unknown) => record(h) && iso(h.startedAt) && iso(h.endedAt) && typeof h.minutes === 'number' && h.minutes > 0 && h.minutes <= 1440);
}
export function validAction(v: unknown): boolean {
  return record(v) && Object.keys(v).every(k => ['name', 'args', 'token'].includes(k)) && text(v.name, 60) && record(v.args) &&
    JSON.stringify(v.args).length <= 30000 && (v.token === undefined || text(v.token, 80));
}
