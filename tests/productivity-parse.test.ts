import { describe, expect, it } from 'vitest';
import { parseDate, parseProductivity, reminderDate } from '../src/core/productivity/parse';
const now = new Date(2026, 10, 25, 10, 0); // Wednesday, local time.
const parse = (text: string) => parseProductivity(text, now);
describe('offline productivity language', () => {
  it.each([
    ['add buy dog food', 'add_task'], ['add finish the presentation to my list.', 'add_task'], ['I need to call insurance tomorrow', 'add_task'],
    ['show me what I have to do today', 'list_tasks'], ['what do I have today?', 'list_tasks'], ["what's due this week?", 'list_tasks'], ['overdue?', 'list_tasks'],
    ['move the presentation task to Friday', 'update_task'], ['rename presentation to finish slides', 'update_task'],
    ['mark slides done', 'complete_task'], ['I finished slides', 'complete_task'], ['done with slides', 'complete_task'], ['delete slides', 'delete_task'], ['clear completed', 'clear_completed'],
    ['remind me to call Mum tomorrow at 6', 'add_reminder'], ['remind me to drink water in 20 minutes', 'add_reminder'], ['every Tuesday take vitamins', 'add_reminder'], ['pay rent on the first of every month', 'add_reminder'], ['wake me up in an hour', 'add_reminder'],
    ['what reminders do I have?', 'list_reminders'], ['snooze that 10 minutes', 'snooze_reminder'], ['cancel the rent reminder', 'cancel_reminder'],
    ['note: campaign ideas', 'add_note'], ['save this idea: flying ducks', 'add_note'], ['remember this idea flying ducks', 'add_note'], ['remember this note tea', 'add_note'], ['what notes do I have about the campaign?', 'search_notes'], ['show my notes', 'search_notes'],
    ['start a 25 minute focus timer', 'start_focus'], ['focus for an hour', 'start_focus'], ['pause the timer', 'pause_focus'], ['resume the timer', 'resume_focus'], ['stop the timer', 'stop_focus'], ['how long is left?', 'focus_status'],
  ])('%s → %s', (text, name) => expect(parse(text)).toMatchObject({ call: { name } }));
  it('strips dates, list suffix and priority from a task title', () => {
    expect(parse('add urgent buy dog food tomorrow to my list')).toMatchObject({ call: { args: { title: 'buy dog food', due: '2026-11-26', priority: 'high' } } });
    expect(parse('move the presentation task to Friday')).toMatchObject({ call: { args: { query: 'presentation', due: '2026-11-27' } } });
  });
  it('asks When, never downgrading a reminder to a task', () => { expect(parse('remind me to call Mum')).toEqual({ when: { text: 'call Mum' } }); });
  it('keeps ordinary conversation and explicit memory with Phase A', () => { expect(parse('remember that my favourite colour is green')).toBeNull(); expect(parse('explain the moon')).toBeNull(); });
  it('handles relative dates without adding twelve hours', () => {
    expect(new Date(reminderDate('drink water in 20 minutes', now).at!).getTime() - now.getTime()).toBe(20 * 60000);
    expect(new Date((parse('wake me up in an hour') as any).call.args.at).getTime() - now.getTime()).toBe(3600000);
  });
  it('takes the next 6 o’clock and rolls past explicit times to tomorrow', () => {
    expect(new Date(parseDate('at 6', now)!.at).getHours()).toBe(18);
    const early = new Date(2026, 10, 25, 5); expect(new Date(parseDate('at 6', early)!.at).getHours()).toBe(6);
    const late = new Date(2026, 10, 25, 20); const next = new Date(parseDate('at 6', late)!.at); expect(next.getHours()).toBe(6); expect(next.getDate()).toBe(26);
    expect(parseDate('today at 9am', now)?.due).toBe('2026-11-26');
    expect(parseDate('tomorrow at 6', now)?.dueTime).toBe('06:00');
  });
  it('extracts recurring reminders and supplies an explicit 9am default', () => {
    const weekly = reminderDate('every Tuesday take vitamins', now); expect(weekly.text).toBe('take vitamins'); expect(weekly.recurrence).toEqual({ kind: 'weekly', weekdays: [2] }); expect(new Date(weekly.at!).getDay()).toBe(2); expect(new Date(weekly.at!).getHours()).toBe(9);
    const monthly = reminderDate('pay rent on the first of every month', now); expect(monthly.text).toBe('pay rent'); expect(new Date(monthly.at!).getDate()).toBe(1);
    expect(reminderDate('water every 3 days at 9am', now).recurrence).toEqual({ kind: 'custom', intervalDays: 3 });
    expect(reminderDate('exercise every Monday and Friday at 7pm', now).recurrence).toEqual({ kind: 'weekly', weekdays: [1, 5] });
  });
});
