import { afterEach, describe, expect, it } from 'vitest';
import { nextInterval, nextOccurrence, ReminderScheduler, rezone } from '../src/core/scheduler';
import { validReminder } from '../src/core/productivity/validation';
import { localTime, type Reminder } from '../src/core/productivity/types';
const originalTZ = process.env.TZ;
afterEach(() => { if (originalTZ === undefined) delete process.env.TZ; else process.env.TZ = originalTZ; });
function reminder(date: Date, recurrence?: Reminder['recurrence']): Reminder { return { id: 'r', text: 'drink water', at: date.toISOString(), recurrence, wallTime: localTime(date), state: 'scheduled', createdAt: date.toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }; }
describe('calendar recurrence and reliable delivery', () => {
  it('keeps creation phase through late checks, months asleep, and restart with one recovery delivery', () => {
    const created = new Date(2026, 0, 1, 10, 7, 23); let now = +new Date(2026, 10, 25, 11, 18);
    const rule = { kind: 'interval', intervalMinutes: 30 } as const;
    const r = { ...reminder(created, rule), at: nextInterval(created.toISOString(), rule, created) };
    const scheduler = new ReminderScheduler(() => now);
    const first = scheduler.evaluate([r], true); expect(first.deliveries).toHaveLength(1);
    expect(Date.parse(first.reminders[0].at)).toBeGreaterThan(now);
    expect((Date.parse(first.reminders[0].at) - +created) % 1800000).toBe(0);
    expect(new ReminderScheduler(() => now).evaluate(first.reminders, true).deliveries).toHaveLength(0);
    now = Date.parse(first.reminders[0].at); expect(scheduler.evaluate(first.reminders).deliveries).toHaveLength(1);
  });
  it.each([[2, 8], [10, 1]])('keeps elapsed hourly intervals across the DST transition %s/%s', (month, day) => {
    process.env.TZ = 'America/New_York';
    const created = new Date(2026, month, day, 0, 30); let r = reminder(created, { kind: 'interval', intervalMinutes: 60 });
    for (let i = 0; i < 5; i++) {
      const next = nextOccurrence(r, new Date(r.at)); expect(Date.parse(next) - Date.parse(r.at)).toBe(3600000);
      r = { ...r, at: next };
    }
    process.env.TZ = 'Europe/London'; expect(rezone(r, 'Europe/London').at).toBe(r.at);
  });
  it('suppresses recovery outside the window and resumes next day at its local opening', () => {
    const created = new Date(2026, 10, 25, 10, 7);
    const rule = { kind: 'interval', intervalMinutes: 30, window: { start: '09:00', end: '18:00' } } as const;
    let now = +new Date(2026, 10, 25, 19); const scheduler = new ReminderScheduler(() => now);
    const closed = scheduler.evaluate([{ ...reminder(created, rule), at: nextInterval(created.toISOString(), rule, created) }], true);
    expect(closed.deliveries).toHaveLength(0); expect(new Date(closed.reminders[0].at)).toEqual(new Date(2026, 10, 26, 9));
    now = +new Date(2026, 10, 26, 9); const open = scheduler.evaluate(closed.reminders);
    expect(open.deliveries).toHaveLength(1); expect(new Date(open.reminders[0].at)).toEqual(new Date(2026, 10, 26, 9, 30));
  });
  it.each([[2, 7, 23], [9, 31, 25]])('opens a window at 9am across DST, %s/%s', (month, day, hours) => {
    process.env.TZ = 'America/New_York';
    const created = new Date(2026, month, day, 9);
    const rule = { kind: 'interval', intervalMinutes: 45, window: { start: '09:00', end: '18:00' } } as const;
    const next = new Date(nextInterval(created.toISOString(), rule, new Date(2026, month, day, 18)));
    expect(next.getHours()).toBe(9); expect(+next - +created).toBe(hours * 3600000);
  });
  it('snoozes the current occurrence without delaying the next series slot', () => {
    const created = new Date(2026, 10, 25, 9); let now = +created + 300000;
    const rule = { kind: 'interval', intervalMinutes: 5 } as const;
    const scheduler = new ReminderScheduler(() => now);
    const fired = scheduler.evaluate([{ ...reminder(created, rule), at: new Date(now).toISOString() }]).reminders[0];
    const snoozed = { ...fired, state: 'scheduled' as const, snoozedUntil: new Date(now + 480000).toISOString() };
    now += 300000; const next = scheduler.evaluate([snoozed]); expect(next.deliveries).toHaveLength(1); expect(next.reminders[0].snoozedUntil).toBe(snoozed.snoozedUntil);
    now += 180000; const again = scheduler.evaluate(next.reminders); expect(again.deliveries).toHaveLength(1);
    expect(again.reminders[0].snoozedUntil).toBeUndefined(); expect(new Date(again.reminders[0].at)).toEqual(new Date(2026, 10, 25, 9, 15));
  });
  it('validates persisted interval limits and daily windows', () => {
    const r = reminder(new Date(), { kind: 'interval', intervalMinutes: 5 }); expect(validReminder(r)).toBe(true);
    for (const intervalMinutes of [0, 4, 5.5, Infinity, 1e15]) expect(validReminder({ ...r, recurrence: { kind: 'interval', intervalMinutes } })).toBe(false);
    for (const window of [{ start: '18:00', end: '09:00' }, { start: '09:00', end: '09:00' }, { start: '99:00', end: '18:00' }]) expect(validReminder({ ...r, recurrence: { ...r.recurrence, window } })).toBe(false);
  });
  it('fires once, including after a restart with the persisted marker', () => {
    const date = new Date(2026, 10, 25, 9); const scheduler = new ReminderScheduler(() => +date + 60000, () => 0);
    const first = scheduler.evaluate([reminder(date)], true); expect(first.deliveries).toHaveLength(1); expect(first.deliveries[0].missed).toBe(true);
    expect(scheduler.evaluate(first.reminders).deliveries).toHaveLength(0);
    expect(new ReminderScheduler(() => +date + 120000).evaluate(first.reminders, true).deliveries).toHaveLength(0);
  });
  it('collapses months of missed recurrences into one delivery and a future occurrence', () => {
    const now = new Date(2026, 10, 25, 12); const scheduler = new ReminderScheduler(() => +now);
    const result = scheduler.evaluate([reminder(new Date(2026, 1, 1, 9), { kind: 'daily' })], true);
    expect(result.deliveries).toHaveLength(1); expect(new Date(result.reminders[0].at)).toEqual(new Date(2026, 10, 26, 9));
    expect(scheduler.evaluate(result.reminders, true).deliveries).toHaveLength(0);
  });
  it.each([[2026, 1, 28], [2028, 1, 29], [2026, 3, 30]])('clamps monthly day 31 in %s/%s to %s', (year, month, day) => {
    const r = reminder(new Date(year, month - 1, 31, 9), { kind: 'monthly', dayOfMonth: 31 });
    const next = new Date(nextOccurrence(r, new Date(year, month, 1, 12))); expect(next).toEqual(new Date(year, month, day, 9));
    const following = new Date(nextOccurrence({ ...r, at: next.toISOString() }, next)); expect(following.getDate()).toBe(31);
  });
  it('advances weekly selected days and every N days from the original phase', () => {
    const date = new Date(2026, 10, 24, 9);
    expect(new Date(nextOccurrence(reminder(date, { kind: 'weekly', weekdays: [2, 5] }), date))).toEqual(new Date(2026, 10, 27, 9));
    expect(new Date(nextOccurrence(reminder(date, { kind: 'custom', intervalDays: 3 }), new Date(2026, 10, 29, 10)))).toEqual(new Date(2026, 10, 30, 9));
  });
  it('preserves 9am over DST and restores 2:30 after a nonexistent spring-forward time', () => {
    process.env.TZ = 'America/New_York';
    const before = new Date(2026, 2, 7, 9); const r = reminder(before, { kind: 'daily' }); const next = new Date(nextOccurrence(r, before));
    expect(next.getHours()).toBe(9); expect(+next - +before).toBe(23 * 3600000);
    const early = reminder(new Date(2026, 2, 7, 2, 30), { kind: 'daily' }); const shifted = nextOccurrence(early, new Date(early.at));
    const restored = new Date(nextOccurrence({ ...early, at: shifted }, new Date(shifted))); expect(restored.getHours()).toBe(2); expect(restored.getMinutes()).toBe(30);
    const fall = new Date(2026, 9, 31, 9); expect(+new Date(nextOccurrence(reminder(fall, { kind: 'daily' }), fall)) - +fall).toBe(25 * 3600000);
  });
  it('detects wall-clock jumps and does not duplicate when time moves backward', () => {
    let now = +new Date(2026, 10, 25, 8); let mono = 0; const scheduler = new ReminderScheduler(() => now, () => mono); const rows = [reminder(new Date(2026, 10, 25, 9))];
    scheduler.evaluate(rows); now += 7200000; mono += 15000;
    const result = scheduler.evaluate(rows); expect(result.jumped).toBe(true); expect(result.deliveries[0].missed).toBe(true);
    now -= 3600000; mono += 15000; expect(scheduler.evaluate(result.reminders).deliveries).toHaveLength(0);
  });
  it('keeps wall-clock time after moving time zones', () => {
    process.env.TZ = 'America/New_York'; const r = reminder(new Date(2026, 10, 25, 9));
    process.env.TZ = 'Europe/London'; const shifted = rezone(r, 'Europe/London'); expect(new Date(shifted.at).getHours()).toBe(9); expect(shifted.at).not.toBe(r.at);
  });
  it('snoozes exactly once and retains recurrence', () => {
    const now = new Date(2026, 10, 25, 9); let clock = +now;
    const scheduler = new ReminderScheduler(() => clock); const first = scheduler.evaluate([reminder(now, { kind: 'daily' })]);
    const snoozed = { ...first.reminders[0], state: 'scheduled' as const, snoozedUntil: new Date(clock + 600000).toISOString() };
    expect(scheduler.evaluate([snoozed]).deliveries).toHaveLength(0); clock += 600000;
    const second = scheduler.evaluate([snoozed]); expect(second.deliveries).toHaveLength(1); expect(second.reminders[0].recurrence?.kind).toBe('daily'); expect(scheduler.evaluate(second.reminders).deliveries).toHaveLength(0);
  });
});
