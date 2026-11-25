import * as chrono from 'chrono-node';
import type { ToolCall } from '../conversation/types';
import { localDate, localTime, type Recurrence } from './types';
import { nextInterval } from '../scheduler';
export interface ParsedDate { at: string; due: string; dueTime?: string; text: string; index: number }
/** Chrono supplies calendar interpretation; explicit local setters preserve wall-clock semantics. */
export function parseDate(input: string, now = new Date()): ParsedDate | undefined {
  // Preserve source offsets: title extraction slices the original input using these spans.
  const source = input.replace(/\ban hour\b/gi, '1  hour').replace(/\ba minute\b/gi, '1 minute');
  const result = chrono.casual.parse(source, now, { forwardDate: true })[0]; if (!result) return;
  const date = result.start.date(); const hasTime = result.start.isCertain('hour');
  if (hasTime && !result.start.isCertain('meridiem') && !/\b(?:in|after)\b/i.test(result.text)) {
    const hour = result.start.get('hour')!;
    if (hour >= 1 && hour <= 12 && !/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/.test(result.text)) {
      if (!result.start.isCertain('day') && !result.start.isCertain('weekday')) date.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());
      date.setHours(hour % 12, date.getMinutes(), 0, 0);
      while (date.getTime() <= now.getTime()) date.setHours(date.getHours() + 12);
    }
  }
  if (hasTime && date.getTime() <= now.getTime() && !/\b(?:yesterday|ago|last)\b/i.test(result.text)) date.setDate(date.getDate() + 1);
  return { at: date.toISOString(), due: localDate(date), ...(hasTime ? { dueTime: localTime(date) } : {}), text: input.slice(result.index, result.index + result.text.length), index: result.index };
}
const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const politePrefix = /^(?:(?:can|could|would|will) you|please|pls|hey ducky|ducky)\b[\s,:]*/i;
function stripPoliteness(input: string): string {
  let text = input.trim().replace(/’/g, "'");
  while (politePrefix.test(text)) text = text.replace(politePrefix, '').trim();
  return text;
}
/** Run after schedule extraction so connectors left on either side cannot become the title. */
export function cleanProductivityTitle(input: string): string {
  let text = input.trim().replace(/\s+/g, ' ');
  let previous: string;
  do {
    previous = text;
    text = stripPoliteness(text).replace(/^(?:remind me(?:\s+(?:to|that))?|i need to|don't let me forget to)\b[\s,:]*/i, '').trim();
  } while (text !== previous);
  return text.replace(/\s+to (?:my|the) list\b/gi, '')
    .replace(/[\s,:?.!]+$/g, '')
    .replace(/(?:\s+\b(?:in|at|on|every|for|by))+$/i, '')
    .replace(/^[\s,:]+|[\s,:?.!]+$/g, '').trim();
}
export function recurrence(input: string): { rule?: Recurrence; rest: string; error?: string } {
  let m: RegExpMatchArray | null;
  // Consume "in every ..." as one schedule, including when it precedes the title.
  const removeSchedule = (match: RegExpMatchArray) => input.slice(0, match.index).replace(/\bin\s+$/i, '') + input.slice(match.index! + match[0].length);
  if ((m = input.match(/\b(?:every\s+(?:half\s+an?\s+hour|(?:an?\s+)?hour|(?:(\d+(?:\.\d+)?)\s*)(minutes?|mins?|hours?|hrs?))|hourly)\b/i))) {
    const minutes = m[1] ? +m[1] * (/^(?:hour|hr)/i.test(m[2]) ? 60 : 1) : /half/i.test(m[0]) ? 30 : 60;
    let rest = removeSchedule(m);
    if (!Number.isSafeInteger(minutes) || minutes < 5) return { rest, error: 'Choose an interval of at least 5 whole minutes.' };
    const rule: Recurrence = { kind: 'interval', intervalMinutes: minutes };
    const clock = '(\\d{1,2}(?::[0-5]\\d)?\\s*(?:am|pm)?)';
    const range = rest.match(new RegExp(`(?:between\\s+${clock}\\s+and\\s+${clock}|during work hours\\s*\\(\\s*${clock}\\s*[-–]\\s*${clock}\\s*\\))`, 'i'));
    const until = rest.match(new RegExp(`\\buntil\\s+${clock}`, 'i'));
    if (range || until) {
      const read = (value: string): number => {
        const match = value.trim().match(/^(\d{1,2})(?::(\d\d))?\s*(am|pm)?$/i)!;
        let h = +match[1]; if (h > 23 || match[3] && (h < 1 || h > 12)) return NaN;
        if (match[3]) h = h % 12 + (/pm/i.test(match[3]) ? 12 : 0);
        return h * 60 + +(match[2] ?? 0);
      };
      const startText = range ? range[1] ?? range[3] : '9am';
      const endText = range ? range[2] ?? range[4] : until![1];
      const start = read(startText); let end = read(endText);
      if (!/am|pm/i.test(endText) && end <= start && end < 720) end += 720;
      if (!Number.isFinite(start + end) || start >= end) return { rest, error: 'Use a same-day window, such as between 9am and 6pm. “Until” starts each day at 9am.' };
      const format = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
      rule.window = { start: format(start), end: format(end) }; rest = rest.replace((range ?? until)![0], '');
    }
    return { rule, rest };
  }
  if ((m = input.match(/(?:on\s+)?(?:the\s+)?(first|second|third|last|\d{1,2}(?:st|nd|rd|th)?)\s+(?:of\s+)?every month/i))) {
    const n = ({ first: 1, second: 2, third: 3, last: 31 } as Record<string, number>)[m[1].toLowerCase()] ?? parseInt(m[1]);
    return { rule: { kind: 'monthly', dayOfMonth: n }, rest: removeSchedule(m) };
  }
  if ((m = input.match(/every\s+(\d+)\s+days?/i))) return { rule: { kind: 'custom', intervalDays: +m[1] }, rest: removeSchedule(m) };
  if ((m = input.match(/every\s+(?:weekdays?|(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)(?:\s*(?:,|and)\s*(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday))*)/i))) {
    return { rule: { kind: 'weekly', weekdays: /weekday/i.test(m[0]) ? [1, 2, 3, 4, 5] : weekdays.flatMap((d, i) => m![0].toLowerCase().includes(d) ? [i] : []) }, rest: removeSchedule(m) };
  }
  if ((m = input.match(/\b(?:every day|daily)\b/i))) return { rule: { kind: 'daily' }, rest: removeSchedule(m) };
  if ((m = input.match(/\bmonthly\b/i))) return { rule: { kind: 'monthly', dayOfMonth: 1 }, rest: removeSchedule(m) };
  return { rest: input };
}
export function reminderDate(input: string, now = new Date()): { text: string; at?: string; recurrence?: Recurrence; error?: string } {
  const { rule, rest, error } = recurrence(input);
  if (error) return { text: rest.trim(), error };
  if (rule?.kind === 'interval') {
    if (+now + rule.intervalMinutes! * 60000 > 8640000000000000) return { text: rest.trim(), error: 'That interval is too far in the future. Choose a shorter interval.' };
    return { text: cleanProductivityTitle(rest), at: nextInterval(now.toISOString(), rule, now), recurrence: rule };
  }
  const parsed = parseDate(rest, now);
  let text = parsed ? rest.slice(0, parsed.index) + rest.slice(parsed.index + parsed.text.length) : rest;
  text = text.replace(/^[\s,:]+|[\s,:]+$/g, '').replace(/\s+/g, ' ');
  let date = parsed ? new Date(parsed.at) : undefined;
  if (rule) {
    date ??= new Date(now); if (!parsed?.dueTime) date.setHours(9, 0, 0, 0);
    if (rule.kind === 'weekly') {
      while (!rule.weekdays!.includes(date.getDay()) || date <= now) date.setDate(date.getDate() + 1);
    } else if (rule.kind === 'monthly') {
      const target = rule.dayOfMonth!;
      date.setDate(Math.min(target, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
      if (date <= now) { date.setDate(1); date.setMonth(date.getMonth() + 1); date.setDate(Math.min(target, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate())); }
    } else if (date <= now) date.setDate(date.getDate() + (rule.intervalDays ?? 1));
  }
  return { text: cleanProductivityTitle(text), ...(date ? { at: date.toISOString() } : {}), ...(rule ? { recurrence: rule } : {}) };
}
export type ProductivityIntent = { call: ToolCall } | { when: { text: string } } | { error: string } | null;
const call = (name: string, args: Record<string, unknown> = {}): ProductivityIntent => ({ call: { name, args } });
export function parseProductivity(input: string, now = new Date()): ProductivityIntent {
  const s = stripPoliteness(input).replace(/[?.!]+$/, ''); let m: RegExpMatchArray | null;
  if (/^(?:what reminders do i have|show (?:my )?reminders|list reminders)$/i.test(s)) return call('list_reminders');
  if (/^(?:remind me\b|don't let me forget to\b|wake me up\b)/i.test(s) || /\b(?:hourly|every\s+(?:half an? hour|an? hour|hour|day|weekday|sunday|monday|tuesday|wednesday|thursday|friday|saturday|month|\d+ (?:days|minutes?|mins?|hours?)))\b/i.test(s)) {
    const parsed = reminderDate(s, now); if (/^wake me up/i.test(s)) parsed.text = 'Wake up';
    if (parsed.error) return { error: parsed.error };
    if (!parsed.at) return { when: { text: parsed.text || 'Reminder' } };
    return call('add_reminder', { ...parsed, text: parsed.text || 'Reminder' });
  }
  if ((m = s.match(/^snooze (?:that|(?:the )?(.+?) reminder)\s*(?:for\s+)?(\d+)\s*(?:minutes?|mins?)$/i))) return call('snooze_reminder', { query: m[1] ?? '', minutes: +m[2] });
  if ((m = s.match(/^(?:cancel|delete|stop) (?:the )?(.+?) reminder$/i))) return call('cancel_reminder', { query: m[1] });
  if ((m = s.match(/^(?:note\s*:|save this idea\s*:|remember this (?:idea|note)\s*:?)\s*(.+)$/i))) return call('add_note', { text: m[1], topic: 'ideas' });
  if ((m = s.match(/^what notes do i have(?: about (?:the )?(.+))?$/i))) return call('search_notes', { query: m[1] ?? '' });
  if (/^(?:show|list) (?:my )?notes$/i.test(s)) return call('search_notes');
  if ((m = s.match(/^delete (?:the )?(.+?) note$/i))) return call('delete_note', { query: m[1] });
  if ((m = s.match(/^(?:start (?:a )?|focus for )(?:(\d+(?:\.\d+)?)[-\s]*(?:minute|min)|(?:an?|1) hour)(?:s)?(?: focus)?(?: timer)?$/i))) return call('start_focus', { minutes: m[1] ? +m[1] : 60 });
  if (/^(?:start (?:a )?focus(?: timer)?)$/i.test(s)) return call('start_focus');
  if ((m = s.match(/^(pause|resume|stop) (?:the )?(?:focus )?timer$/i))) return call(`${m[1].toLowerCase()}_focus`);
  if (/^how (?:much time|long) is left$/i.test(s)) return call('focus_status');
  if (/^(?:show me what i have to do today|what do i have today|what(?:'s| is) due this week|overdue|show (?:my )?(?:tasks|list)|list tasks)$/i.test(s)) return call('list_tasks', { filter: /overdue/i.test(s) ? 'overdue' : /week/i.test(s) ? 'week' : /today/i.test(s) ? 'today' : 'upcoming' });
  if (/^clear completed(?: tasks)?$/i.test(s)) return call('clear_completed');
  if ((m = s.match(/^(?:mark (.+?) done|i finished (.+)|done with (.+))$/i))) return call('complete_task', { query: (m[1] ?? m[2] ?? m[3]).replace(/^(?:the )?(.+?) task$/i, '$1') });
  if ((m = s.match(/^move (?:the )?(.+?)(?: task)? to (.+)$/i))) { const d = parseDate(m[2], now); return call('update_task', { query: m[1], dueInput: m[2], ...(d ? { due: d.due, dueTime: d.dueTime } : {}) }); }
  if ((m = s.match(/^rename (?:the )?(.+?)(?: task)? to (.+)$/i))) return call('update_task', { query: m[1], title: m[2] });
  if ((m = s.match(/^delete (?:the )?(.+?)(?: task)?$/i))) return call('delete_task', { query: m[1] });
  if ((m = s.match(/^(?:add(?: task)?|i need to)\s+(.+)$/i))) {
    let title = m[1].replace(/\s+to (?:my|the) list\b/gi, '');
    const priority = /\b(?:urgent|high priority)\b/i.test(title) ? 'high' : /\blow priority\b/i.test(title) ? 'low' : 'normal';
    title = title.replace(/\b(?:urgent|high priority|low priority)\b/gi, '').trim();
    const d = parseDate(title, now); if (d) title = (title.slice(0, d.index) + title.slice(d.index + d.text.length)).trim();
    return call('add_task', { title: cleanProductivityTitle(title), priority, ...(d ? { due: d.due, dueTime: d.dueTime } : {}) });
  }
  return null;
}
