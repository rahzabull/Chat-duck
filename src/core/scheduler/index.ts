import { localTime, type Reminder } from '../productivity/types';
export const CHECK_MS = 15000;
export function nextOccurrence(reminder: Reminder, after: Date): string {
  const r = reminder.recurrence; if (!r) return reminder.at;
  const anchor = new Date(reminder.at); const [hour, minute] = (reminder.wallTime ?? localTime(anchor)).split(':').map(Number);
  let date = new Date(anchor); date.setHours(hour, minute, 0, 0);
  // Calendar arithmetic, never 24-hour millisecond arithmetic (DST days vary).
  if (r.kind === 'monthly') {
    date = new Date(after.getFullYear(), after.getMonth(), Math.min(r.dayOfMonth!, new Date(after.getFullYear(), after.getMonth() + 1, 0).getDate()), hour, minute);
    if (date <= after) date = new Date(after.getFullYear(), after.getMonth() + 1, Math.min(r.dayOfMonth!, new Date(after.getFullYear(), after.getMonth() + 2, 0).getDate()), hour, minute);
  } else if (r.kind === 'weekly') {
    date = new Date(after); date.setHours(hour, minute, 0, 0);
    while (date <= after || !r.weekdays!.includes(date.getDay())) { date.setDate(date.getDate() + 1); date.setHours(hour, minute, 0, 0); }
  } else {
    const interval = r.intervalDays ?? 1;
    // Skip years of missed occurrences in constant time, retaining the original day phase.
    const calendar = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    const days = Math.floor((calendar(after) - calendar(date)) / 86400000);
    if (days > 0) date.setDate(date.getDate() + Math.floor(days / interval) * interval);
    date.setHours(hour, minute, 0, 0);
    while (date <= after) { date.setDate(date.getDate() + interval); date.setHours(hour, minute, 0, 0); }
  }
  return date.toISOString();
}
/** Convert an instant's OLD zone wall clock to the new system-local zone. */
export function rezone(reminder: Reminder, timezone: string): Reminder {
  if (timezone === reminder.timezone) return reminder;
  const shift = (instant: string, wallTime?: string) => {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: reminder.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(instant));
    const get = (key: string) => Number(parts.find(p => p.type === key)!.value);
    const [h, m] = (wallTime ?? `${get('hour')}:${get('minute')}`).split(':').map(Number);
    return new Date(get('year'), get('month') - 1, get('day'), h, m).toISOString();
  };
  return { ...reminder, at: shift(reminder.at, reminder.wallTime), ...(reminder.lastFiredAt ? { lastFiredAt: shift(reminder.lastFiredAt) } : {}), timezone };
}
export interface Delivery { reminder: Reminder; missed: boolean; occurrence: string }
export class ReminderScheduler {
  private previous?: number; private monotonic?: number;
  constructor(private now: () => number = Date.now, private steady: () => number = () => performance.now()) {}
  evaluate(reminders: Reminder[], recovery = false, timezone = Intl.DateTimeFormat().resolvedOptions().timeZone): { reminders: Reminder[]; deliveries: Delivery[]; jumped: boolean } {
    const now = this.now(); const mono = this.steady();
    const jumped = this.previous !== undefined && Math.abs((now - this.previous) - (mono - this.monotonic!)) > 120000;
    const gap = this.previous !== undefined && now - this.previous > CHECK_MS + 120000;
    this.previous = now; this.monotonic = mono; const deliveries: Delivery[] = [];
    const updated = reminders.map(original => {
      if (original.state === 'done' || original.state === 'dismissed') return original;
      const r = rezone(original, timezone); const occurrence = r.snoozedUntil ?? r.at;
      if (Date.parse(occurrence) > now || (r.lastFiredAt && Date.parse(r.lastFiredAt) >= Date.parse(occurrence))) return r;
      const next: Reminder = { ...r, state: 'due', lastFiredAt: occurrence, snoozedUntil: undefined };
      if (r.recurrence && Date.parse(r.at) <= now) next.at = nextOccurrence(r, new Date(now));
      deliveries.push({ reminder: next, missed: recovery || jumped || gap, occurrence }); return next;
    });
    return { reminders: updated, deliveries, jumped };
  }
}
