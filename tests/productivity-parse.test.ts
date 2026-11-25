import { describe, expect, it } from 'vitest';
import { cleanProductivityTitle, parseDate, parseProductivity, reminderDate } from '../src/core/productivity/parse';
const now = new Date(2026, 10, 25, 10, 0); // Wednesday, local time.
const parse = (text: string) => parseProductivity(text, now);
describe('offline productivity language', () => {
  it.each([
    ['can you remind me to drink water in every half an hour', 'drink water'],
    ['remind me every half an hour to drink water', 'drink water'],
    ['please remind me to stretch every hour between 10 and 7?', 'stretch'],
    ['could you remind me to call mum tomorrow at 6', 'call mum'],
    ['would you please remind me that the oven needs checking in 20 minutes.', 'the oven needs checking'],
    ['will you remind me to take vitamins every day?', 'take vitamins'],
    ['hey ducky, pls remind me to pay rent on the first of every month.', 'pay rent'],
    ['ducky, please remind me to drink water in every 30 minutes?', 'drink water'],
    ["don't let me forget to call mum tomorrow at 6", 'call mum'],
    ['please remind me that I need to stretch every hour', 'stretch'],
    ['remind me in every half an hour to drink water', 'drink water'],
    ['remind me in every day to take vitamins', 'take vitamins'],
    ['remind me in every Tuesday to take vitamins', 'take vitamins'],
    ['please remind me to drink water in an hour', 'drink water'],
    ['please remind me in an hour to drink water', 'drink water'],
    ['please remind me to add milk every hour', 'add milk'],
    ['can you remind me to check in every hour', 'check'],
  ])('cleans reminder title: %s', (input, text) => {
    expect(parse(input)).toMatchObject({ call: { name: 'add_reminder', args: { text } } });
    expect(reminderDate(input, now).text).toBe(text);
  });
  it.each([
    'can you add buy milk to my list', 'could you please add task buy milk tomorrow to my list?',
    'would you add buy milk to the list tomorrow.', 'will you pls add buy milk',
    'hey ducky, please add buy milk to my list', 'ducky, I need to buy milk tomorrow at 6.',
  ])('cleans task title: %s', input => {
    expect(parse(input)).toMatchObject({ call: { name: 'add_task', args: { title: 'buy milk' } } });
  });
  it.each(['in', 'at', 'on', 'every', 'for', 'by', 'in every', 'in every at'])('removes dangling schedule connectors: %s', suffix => {
    expect(cleanProductivityTitle(`can you please remind me to drink water ${suffix}?.`)).toBe('drink water');
    expect(cleanProductivityTitle(`could you I need to buy milk ${suffix}.`)).toBe('buy milk');
  });
  it('preserves internal words and cleans undated reminder prompts', () => {
    expect(parse('could you remind me to call mum?')).toEqual({ when: { text: 'call mum' } });
    expect(cleanProductivityTitle('check in with mum')).toBe('check in with mum');
    expect(cleanProductivityTitle('buy milk for tea')).toBe('buy milk for tea');
  });
  it('preserves the requested interval window while cleaning punctuation', () => {
    expect(parse('please remind me to stretch every hour between 10 and 7?')).toMatchObject({ call: { args: {
      text: 'stretch', recurrence: { kind: 'interval', intervalMinutes: 60, window: { start: '10:00', end: '19:00' } },
    } } });
  });
  it.each([
    ['every half an hour', 30], ['every 30 minutes', 30], ['every 2 hours', 120],
    ['every hour', 60], ['hourly', 60], ['every 45 mins', 45], ['every 5 minutes', 5], ['every an hour', 60], ['every 48 hours', 2880],
  ])('parses interval %s and starts one interval after creation', (phrase, minutes) => {
    const result = parse(`remind me to drink water ${phrase}`);
    expect(result).toEqual({ call: { name: 'add_reminder', args: { text: 'drink water', recurrence: { kind: 'interval', intervalMinutes: minutes }, at: new Date(+now + minutes * 60000).toISOString() } } });
  });
  it.each(['between 9 and 6', 'during work hours (9-6)', 'until 6pm', 'between 9am and 6pm'])('parses local window %s without leaking it into the title', window => {
    const result = reminderDate(`drink water every 30 minutes ${window}`, now);
    expect(result).toMatchObject({ text: 'drink water', recurrence: { kind: 'interval', intervalMinutes: 30, window: { start: '09:00', end: '18:00' } } });
  });
  it.each(['every 4 minutes', 'every 0 hours', 'every 1.1 minutes'])('rejects invalid interval %s instead of creating a one-off', phrase => {
    expect(parse(`remind me to drink water ${phrase}`)).toEqual({ error: 'Choose an interval of at least 5 whole minutes.' });
  });
  it('rejects inverted explicit windows and resolves stop as a series cancellation', () => {
    expect(parse('remind me to drink water hourly between 6pm and 9am')).toHaveProperty('error');
    expect(parse('stop the water reminder')).toEqual({ call: { name: 'cancel_reminder', args: { query: 'water' } } });
  });
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
