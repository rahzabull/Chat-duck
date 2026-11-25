import * as chrono from 'chrono-node';
import type { ToolCall } from '../conversation/types';
import { localDate, localTime, type Recurrence } from './types';
export interface ParsedDate { at: string; due: string; dueTime?: string; text: string; index: number }
/** Chrono supplies calendar interpretation; explicit local setters preserve wall-clock semantics. */
export function parseDate(input: string, now = new Date()): ParsedDate | undefined {
  const source = input.replace(/\ban hour\b/gi, '1 hour').replace(/\ba minute\b/gi, '1 minute');
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
  return { at: date.toISOString(), due: localDate(date), ...(hasTime ? { dueTime: localTime(date) } : {}), text: result.text, index: result.index };
}
const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
export function recurrence(input: string): { rule?: Recurrence; rest: string } {
  let m: RegExpMatchArray | null;
  if ((m = input.match(/(?:on\s+)?(?:the\s+)?(first|second|third|last|\d{1,2}(?:st|nd|rd|th)?)\s+(?:of\s+)?every month/i))) {
    const n = ({ first: 1, second: 2, third: 3, last: 31 } as Record<string, number>)[m[1].toLowerCase()] ?? parseInt(m[1]);
    return { rule: { kind: 'monthly', dayOfMonth: n }, rest: input.replace(m[0], '') };
  }
  if ((m = input.match(/every\s+(\d+)\s+days?/i))) return { rule: { kind: 'custom', intervalDays: +m[1] }, rest: input.replace(m[0], '') };
  if ((m = input.match(/every\s+(?:weekdays?|(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)(?:\s*(?:,|and)\s*(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday))*)/i))) {
    return { rule: { kind: 'weekly', weekdays: /weekday/i.test(m[0]) ? [1, 2, 3, 4, 5] : weekdays.flatMap((d, i) => m![0].toLowerCase().includes(d) ? [i] : []) }, rest: input.replace(m[0], '') };
  }
  if ((m = input.match(/\b(?:every day|daily)\b/i))) return { rule: { kind: 'daily' }, rest: input.replace(m[0], '') };
  if ((m = input.match(/\bmonthly\b/i))) return { rule: { kind: 'monthly', dayOfMonth: 1 }, rest: input.replace(m[0], '') };
  return { rest: input };
}
export function reminderDate(input: string, now = new Date()): { text: string; at?: string; recurrence?: Recurrence } {
  const { rule, rest } = recurrence(input); const parsed = parseDate(rest, now);
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
  return { text, ...(date ? { at: date.toISOString() } : {}), ...(rule ? { recurrence: rule } : {}) };
}
export type ProductivityIntent = { call: ToolCall } | { when: { text: string } } | null;
const call = (name: string, args: Record<string, unknown> = {}): ProductivityIntent => ({ call: { name, args } });
export function parseProductivity(input: string, now = new Date()): ProductivityIntent {
  const s = input.trim().replace(/^please\s+/i, '').replace(/’/g, "'").replace(/[?.!]+$/, ''); let m: RegExpMatchArray | null;
  if (/^(?:what reminders do i have|show (?:my )?reminders|list reminders)$/i.test(s)) return call('list_reminders');
  if ((m = s.match(/^(?:remind me(?: to)?|wake me up)\s*(.*)$/i)) || /\bevery\s+(?:day|weekday|sunday|monday|tuesday|wednesday|thursday|friday|saturday|month|\d+ days)\b/i.test(s)) {
    const parsed = reminderDate(m ? m[1] : s, now); if (/^wake me up/i.test(s)) parsed.text = 'Wake up';
    if (!parsed.at) return { when: { text: parsed.text || 'Reminder' } };
    return call('add_reminder', { ...parsed, text: parsed.text || 'Reminder' });
  }
  if ((m = s.match(/^snooze (?:that|(?:the )?(.+?) reminder)\s*(?:for\s+)?(\d+)\s*(?:minutes?|mins?)$/i))) return call('snooze_reminder', { query: m[1] ?? '', minutes: +m[2] });
  if ((m = s.match(/^(?:cancel|delete) (?:the )?(.+?) reminder$/i))) return call('cancel_reminder', { query: m[1] });
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
    let title = m[1].replace(/\s+(?:to my list|to the list)$/i, '');
    const priority = /\b(?:urgent|high priority)\b/i.test(title) ? 'high' : /\blow priority\b/i.test(title) ? 'low' : 'normal';
    title = title.replace(/\b(?:urgent|high priority|low priority)\b/gi, '').trim();
    const d = parseDate(title, now); if (d) title = (title.slice(0, d.index) + title.slice(d.index + d.text.length)).trim();
    return call('add_task', { title: title.replace(/\s+/g, ' '), priority, ...(d ? { due: d.due, dueTime: d.dueTime } : {}) });
  }
  return null;
}
