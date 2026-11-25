import { randomUUID } from 'node:crypto';
import { parseDate, parseProductivity } from '../../core/productivity/parse';
import { localTime, type Card, type FocusSession, type ProductivityAction, type ProductivityResult, type ProductivityView, type Reminder, type Task } from '../../core/productivity/types';
import { day, iso, time, validFocus, validNote, validReminder, validTask } from '../../core/productivity/validation';
import { CHECK_MS, ReminderScheduler } from '../../core/scheduler';
import type { ToolCall } from '../../core/conversation/types';
import { ToolRegistry, type Tool, type ToolResult } from '../tools';
import { ProductivityStore } from './store';

const stamp = () => new Date().toISOString();
const str = (v: unknown, max = 4000): v is string => typeof v === 'string' && !!v.trim() && v.length <= max;
const optional = (v: unknown, max = 4000) => v === undefined || typeof v === 'string' && v.length <= max;
const minutes = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= .05 && v <= 1440;
const target = (a: Record<string, unknown>) => str(a.id, 80) || optional(a.query) && typeof a.query === 'string';
const pick = (a: Record<string, unknown>, keys: string[]) => Object.fromEntries(keys.filter(k => a[k] !== undefined).map(k => [k, a[k]]));
export interface ProductivityHooks {
  changed(view: ProductivityView): void;
  attention(kind: 'alarm' | 'celebrate' | 'focus', text?: string): void;
  notify(reminder: Reminder, click: () => void): void;
  export(kind: 'tasks' | 'reminders' | 'notes', data: unknown[], format: 'json' | 'txt'): Promise<boolean>;
  doNotDisturb(): boolean;
  copy?(text: string): void;
}
export class ProductivityService {
  readonly tools: Tool[]; readonly registry: ToolRegistry;
  private scheduler = new ReminderScheduler(); private interval?: ReturnType<typeof setInterval>;
  private focusTimer?: ReturnType<typeof setTimeout>; private focus?: FocusSession; private sessions = 0;
  private breakMinutes?: number;
  private card: Card = null; private selected?: string; private filter?: string; private revision = 0; private message = '';
  private queue: { id: string; missed: boolean }[] = [];
  private waiting?: { text: string }; private choices?: { call: ToolCall; ids: string[] };
  private confirmations = new Map<string, { call: ToolCall; until: number }>();
  private undo?: { id: string; kind: 'task' | 'reminder'; until: number };
  private chain: Promise<unknown> = Promise.resolve(); private stopped = false;
  constructor(readonly store: ProductivityStore, private hooks: ProductivityHooks) {
    const tool = (name: string, description: string, validate: Tool['validate'], execute: Tool['execute'], destructive = false): Tool => ({ name, description, permission: destructive ? 'confirm' : 'safe', validate, execute: a => this.serial(() => execute(a)) });
    this.tools = [
      tool('add_task', 'add_task(title:string, due?:YYYY-MM-DD, dueTime?:HH:mm, priority?:low|normal|high, notes?:string, category?:string)', a => str(a.title) && optional(a.notes) && optional(a.category, 100) && (a.due === undefined || day(a.due)) && (a.dueTime === undefined || time(a.dueTime)) && (a.priority === undefined || ['low', 'normal', 'high'].includes(a.priority as string)), async a => {
        const task: Task = { id: randomUUID(), title: (a.title as string).trim(), priority: 'normal', subtasks: [], done: false, createdAt: stamp(), updatedAt: stamp(), ...pick(a, ['due', 'dueTime', 'priority', 'notes', 'category']) };
        await store.tasks.save([...store.tasks.value, task]); this.created('task', task.id); return this.result(`Added: ${task.title}`, task);
      }),
      tool('list_tasks', 'list_tasks(filter?:today|week|upcoming|overdue|done)', a => optional(a.filter, 20), a => { this.open('tasks', undefined, a.filter as string); return this.result('Here are your tasks.', store.tasks.value); }),
      tool('update_task', 'update_task(id?:string, query?:title, title?:string, dueInput?:natural date, due?:YYYY-MM-DD, dueTime?:HH:mm, priority?:low|normal|high, notes?:string, category?:string, subtasks?:[{id,title,done}], done?:boolean)', a => target(a) && (a.title === undefined || str(a.title)) && optional(a.dueInput) && optional(a.notes) && optional(a.category, 100) && (a.due === undefined || a.due === '' || day(a.due)) && (a.dueTime === undefined || a.dueTime === '' || time(a.dueTime)) && (a.done === undefined || typeof a.done === 'boolean') && (a.priority === undefined || ['low', 'normal', 'high'].includes(a.priority as string)) && (a.subtasks === undefined || Array.isArray(a.subtasks)), a => this.changeTask(a, false)),
      tool('complete_task', 'complete_task(id?:string, query?:title)', target, a => this.changeTask(a, true)),
      tool('delete_task', 'delete_task(id:string) permanently removes a task; confirm', a => str(a.id, 80), async a => { await store.tasks.save(store.tasks.value.filter(t => t.id !== a.id)); return this.result('Task deleted.'); }, true),
      tool('clear_completed', 'clear_completed() removes completed tasks; confirm', () => true, async () => { await store.tasks.save(store.tasks.value.filter(t => !t.done)); return this.result('Completed tasks cleared.'); }, true),
      tool('add_reminder', 'add_reminder(text:string, at:ISO datetime, recurrence?:{kind:daily|weekly|monthly|custom,weekdays?:number[],dayOfMonth?:number,intervalDays?:number})', a => validReminder(this.newReminder(a)), async a => {
        const reminder = this.newReminder(a); if (Date.parse(reminder.at) <= Date.now()) return { ok: false, message: 'Choose a future reminder time.' };
        await store.reminders.save([...store.reminders.value, reminder]); this.created('reminder', reminder.id); return this.result(`Reminder saved: ${reminder.text} — ${new Date(reminder.at).toLocaleString()}`, reminder);
      }),
      tool('list_reminders', 'list_reminders()', () => true, () => { this.open('reminders'); return this.result('Here are your reminders.', store.reminders.value); }),
      tool('snooze_reminder', 'snooze_reminder(id?:string, query?:text, minutes:number)', a => target(a) && minutes(a.minutes), a => this.changeReminder(a, 'snooze')),
      tool('update_reminder', 'update_reminder(id?:string,query?:text,text?:string,when?:natural date,at?:ISO datetime)', a => target(a) && (a.text === undefined || str(a.text)) && optional(a.when) && (a.at === undefined || iso(a.at)), a => this.changeReminder(a, 'update')),
      tool('done_reminder', 'done_reminder(id:string), acknowledge this occurrence', a => str(a.id, 80), a => this.changeReminder(a, 'done')),
      tool('dismiss_reminder', 'dismiss_reminder(id:string), dismiss this occurrence', a => str(a.id, 80), a => this.changeReminder(a, 'dismiss')),
      tool('cancel_reminder', 'cancel_reminder(id:string) permanently removes a reminder; confirm', a => str(a.id, 80), async a => { await store.reminders.save(store.reminders.value.filter(r => r.id !== a.id)); this.dequeue(a.id as string); return this.result('Reminder cancelled.'); }, true),
      tool('add_note', 'add_note(text:string,title?:string,topic?:string,pinned?:boolean)', a => str(a.text, 20000) && optional(a.title) && optional(a.topic, 100) && (a.pinned === undefined || typeof a.pinned === 'boolean'), async a => {
        const note = { id: randomUUID(), text: a.text as string, pinned: a.pinned === true, createdAt: stamp(), updatedAt: stamp(), ...pick(a, ['title', 'topic']) };
        await store.notes.save([...store.notes.value, note]); this.open('notes', note.id); return this.result('Note saved.', note);
      }),
      tool('search_notes', 'search_notes(query?:string)', a => optional(a.query), a => { const query = String(a.query ?? '').toLowerCase(); const notes = store.notes.value.filter(n => `${n.title ?? ''} ${n.text} ${n.topic ?? ''}`.toLowerCase().includes(query)); this.open('notes', undefined, query); return this.result(notes.length ? 'Here are your notes.' : 'No matching notes.', notes); }),
      tool('update_note', 'update_note(id:string,text?:string,title?:string,topic?:string,pinned?:boolean)', a => str(a.id, 80) && (a.text === undefined || str(a.text, 20000)) && optional(a.title) && optional(a.topic, 100) && (a.pinned === undefined || typeof a.pinned === 'boolean'), async a => {
        const notes = store.notes.value; const note = notes.find(n => n.id === a.id); if (!note) return { ok: false, message: 'Note not found.' };
        Object.assign(note, pick(a, ['text', 'title', 'topic', 'pinned']), { updatedAt: stamp() }); if (!validNote(note)) throw new Error('Invalid note');
        await store.notes.save(notes); return this.result('Note saved.', note);
      }),
      tool('delete_note', 'delete_note(id:string) permanently removes a note; confirm', a => str(a.id, 80), async a => { await store.notes.save(store.notes.value.filter(n => n.id !== a.id)); return this.result('Note deleted.'); }, true),
      tool('start_focus', 'start_focus(minutes?:number,kind?:focus|break)', a => (a.minutes === undefined || minutes(a.minutes)) && (a.kind === undefined || ['focus', 'break'].includes(a.kind as string)), a => this.startFocus(a)),
      ...['pause', 'resume', 'stop', 'status'].map(action => tool(action === 'status' ? 'focus_status' : `${action}_focus`, `${action} focus timer`, () => true, () => this.focusAction(action))),
      tool('delete_all_tasks', 'Delete all tasks; confirm', () => true, async () => { await store.tasks.save([]); return this.result('All tasks deleted.'); }, true),
      tool('delete_all_reminders', 'Delete all reminders; confirm', () => true, async () => { await store.reminders.save([]); this.queue = []; this.card = null; return this.result('All reminders deleted.'); }, true),
      tool('delete_all_notes', 'Delete all notes; confirm', () => true, async () => { await store.notes.save([]); return this.result('All notes deleted.'); }, true),
    ];
    this.registry = new ToolRegistry(this.tools);
    this.message = [store.tasks, store.reminders, store.notes, store.focus].some(s => s.recovered) ? 'A damaged data file was preserved as a .corrupt backup. Its list started empty.' : '';
  }
  private serial<T>(fn: () => T | Promise<T>): Promise<T> { const next = this.chain.then(() => { if (this.stopped) throw new Error('Productivity is shutting down'); return fn(); }); this.chain = next.catch(() => {}); return next; }
  private newReminder(a: Record<string, unknown>): Reminder {
    return { id: randomUUID(), text: a.text as string, at: a.at as string, recurrence: a.recurrence as Reminder['recurrence'], state: 'scheduled', createdAt: stamp(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, ...(iso(a.at) ? { wallTime: localTime(new Date(a.at)) } : {}) };
  }
  get view(): ProductivityView { return { revision: this.revision, card: this.card, selected: this.selected, filter: this.filter, tasks: this.store.tasks.value, reminders: this.store.reminders.value, notes: this.store.notes.value, settings: this.store.focus.value.settings, focus: this.focus && { ...this.focus }, breakMinutes: this.breakMinutes, queue: Math.max(0, this.queue.length - 1), message: this.message, undoUntil: this.undo?.until }; }
  private publish(): void { if (this.stopped) return; this.revision++; this.hooks.changed(this.view); }
  private result(message: string, data?: unknown): ToolResult { this.message = message; this.publish(); return { ok: true, message, data }; }
  open(card: Card, id?: string, filter?: string): void { this.card = card; this.selected = id; this.filter = filter; this.publish(); }
  private created(kind: 'task' | 'reminder', id: string): void { this.undo = { kind, id, until: Date.now() + 10000 }; this.open(kind === 'task' ? 'task-created' : 'reminder-created', id); }
  private resolve(call: ToolCall): { id?: string; result?: ToolResult } {
    if (str(call.args.id, 80)) return { id: call.args.id };
    const name = call.name; const query = String(call.args.query ?? '').toLowerCase().trim();
    const rows = name.includes('reminder') ? this.store.reminders.value.map(r => ({ id: r.id, title: r.text })) : name.includes('note') ? this.store.notes.value.map(n => ({ id: n.id, title: n.title || n.text })) : this.store.tasks.value;
    if (!query && name === 'snooze_reminder' && this.queue[0]) return { id: this.queue[0].id };
    const exact = rows.filter(t => t.title.toLowerCase() === query);
    const matches = exact.length ? exact : query ? rows.filter(t => query.split(/\s+/).every(w => t.title.toLowerCase().includes(w))) : [];
    if (matches.length === 1) return { id: matches[0].id };
    if (!matches.length) return { result: { ok: false, message: 'No matching item. Try its title.' } };
    this.choices = { call, ids: matches.slice(0, 8).map(t => t.id) };
    return { result: { ok: false, message: `Which one? Reply with a number, or cancel.\n${matches.slice(0, 8).map((t, i) => `${i + 1}. ${t.title}`).join('\n')}` } };
  }
  private async changeTask(a: Record<string, unknown>, complete: boolean): Promise<ToolResult> {
    const match = this.resolve({ name: complete ? 'complete_task' : 'update_task', args: a }); if (match.result) return match.result;
    const tasks = this.store.tasks.value; const task = tasks.find(t => t.id === match.id); if (!task) return { ok: false, message: 'Task not found.' };
    const wasDone = task.done;
    if (typeof a.dueInput === 'string') { const d = a.dueInput ? parseDate(a.dueInput) : undefined; if (a.dueInput && !d) return { ok: false, message: 'I could not read that date. Try tomorrow 9am.' }; task.due = d?.due; task.dueTime = d?.dueTime; }
    Object.assign(task, pick(a, ['title', 'due', 'dueTime', 'priority', 'notes', 'category', 'subtasks', 'done']), { updatedAt: stamp() });
    if (!task.due) delete task.due; if (!task.dueTime) delete task.dueTime;
    if (complete) task.done = true; task.doneAt = task.done ? task.doneAt ?? stamp() : undefined;
    if (!validTask(task)) throw new Error('Invalid task'); await this.store.tasks.save(tasks);
    if (task.done && !wasDone) this.hooks.attention('celebrate', 'task_done');
    return this.result(`${task.done ? 'Completed' : 'Updated'}: ${task.title}`, task);
  }
  private async changeReminder(a: Record<string, unknown>, mode: string): Promise<ToolResult> {
    const match = this.resolve({ name: `${mode === 'snooze' ? 'snooze' : 'update'}_reminder`, args: a }); if (match.result) return match.result;
    const reminders = this.store.reminders.value; const r = reminders.find(r => r.id === match.id); if (!r) return { ok: false, message: 'Reminder not found.' };
    if (mode === 'snooze') { r.snoozedUntil = new Date(Date.now() + Number(a.minutes) * 60000).toISOString(); r.state = 'scheduled'; }
    else if (mode === 'update') {
      const at = typeof a.when === 'string' ? parseDate(a.when)?.at : a.at;
      if ((a.when !== undefined || a.at !== undefined) && (!iso(at) || Date.parse(at) <= Date.now())) return { ok: false, message: 'Choose a future time, for example tomorrow 9am.' };
      if (at) { r.at = at as string; r.wallTime = localTime(new Date(r.at)); r.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone; r.lastFiredAt = undefined; r.snoozedUntil = undefined; r.state = 'scheduled'; }
      if (str(a.text)) r.text = a.text;
    } else { r.state = r.recurrence ? 'scheduled' : mode === 'done' ? 'done' : 'dismissed'; r.snoozedUntil = undefined; }
    await this.store.reminders.save(reminders); this.dequeue(r.id); return this.result(`Reminder ${mode === 'snooze' ? 'snoozed' : mode === 'update' ? 'updated' : mode === 'done' ? 'completed' : 'dismissed'}.`, r);
  }
  async local(text: string): Promise<ToolResult | undefined> {
    let call: ToolCall | undefined;
    if (this.waiting) {
      if (/^(cancel|never mind)$/i.test(text)) { this.waiting = undefined; return { ok: true, message: 'Cancelled.' }; }
      const parsed = parseDate(text); if (!parsed) return { ok: false, message: 'When? Try tomorrow 9am, or cancel.' };
      call = { name: 'add_reminder', args: { text: this.waiting.text, at: parsed.at } }; this.waiting = undefined;
    } else if (this.choices && /^(\d+|cancel)$/i.test(text)) {
      if (/cancel/i.test(text)) { this.choices = undefined; return { ok: true, message: 'Cancelled.' }; }
      const id = this.choices.ids[Number(text) - 1]; if (!id) return { ok: false, message: 'Choose one of those numbers.' };
      call = { ...this.choices.call, args: { ...this.choices.call.args, id } }; this.choices = undefined;
    } else {
      this.choices = undefined;
      const intent = parseProductivity(text); if (!intent) return;
      if ('when' in intent) { this.waiting = intent.when; return { ok: false, message: 'When?' }; } call = intent.call;
    }
    if (['delete_task', 'cancel_reminder', 'delete_note'].includes(call.name) && !call.args.id) { const match = this.resolve(call); if (match.result) return match.result; call.args = { id: match.id }; }
    return this.registry.run(call, 0);
  }
  async action(action: ProductivityAction): Promise<ProductivityResult> {
    if (action.token) {
      const confirmation = this.confirmations.get(action.token); this.confirmations.delete(action.token);
      if (!confirmation || confirmation.until < Date.now()) return { ok: false, message: 'Confirmation expired. Try again.' };
      return this.registry.run(confirmation.call, 0, true);
    }
    if (action.name === 'close') { const due = this.card === 'reminder-due' ? this.selected : undefined; this.open(null); if (due) this.dequeue(due); return { ok: true, message: '' }; }
    if (action.name === 'skip_break') { this.breakMinutes = undefined; this.publish(); return { ok: true, message: '' }; }
    if (action.name === 'open') { if (![null, 'tasks', 'notes', 'reminders', 'add-task', 'add-reminder', 'reminder-due'].includes(action.args.card as never) || !optional(action.args.id, 80) || !optional(action.args.filter)) return { ok: false, message: 'Unknown card.' }; this.open(action.args.card as Card, action.args.id as string, action.args.filter as string); return { ok: true, message: '' }; }
    if (action.name === 'undo') {
      if (!this.undo || this.undo.until < Date.now()) return { ok: false, message: 'Undo expired.' };
      action = { name: this.undo.kind === 'task' ? 'delete_task' : 'cancel_reminder', args: { id: this.undo.id } };
    }
    if (action.name === 'settings') return this.serial(async () => {
      const data = this.store.focus.value; Object.assign(data.settings, pick(action.args, Object.keys(data.settings))); if (!data.settings.keepHistory) data.history = [];
      if (!validFocus(data)) return { ok: false, message: 'Invalid productivity settings.' }; await this.store.focus.save(data); return this.result('Productivity settings saved.');
    });
    if (action.name === 'export') {
      const kind = action.args.kind; const format = action.args.format;
      if (!['tasks', 'reminders', 'notes'].includes(String(kind)) || !['json', 'txt'].includes(String(format))) return { ok: false, message: 'Invalid export.' };
      const k = kind as 'tasks' | 'reminders' | 'notes'; const saved = await this.hooks.export(k, this.store[k].value, format as 'json' | 'txt'); return { ok: saved, message: saved ? 'Export saved.' : 'Export cancelled.' };
    }
    if (action.name === 'copy_note') { const note = this.store.notes.value.find(n => n.id === action.args.id); if (!note || !this.hooks.copy) return { ok: false, message: 'Note unavailable.' }; this.hooks.copy(note.text); return { ok: true, message: 'Copied.' }; }
    const result = action.name === 'text' && str(action.args.text) ? await this.local(action.args.text) ?? { ok: false, message: 'Try add task, remind me to, or note:.' } : await this.registry.run(action, 0);
    if (result.confirmation) { const token = randomUUID(); for (const [key, c] of this.confirmations) if (c.until < Date.now()) this.confirmations.delete(key); this.confirmations.set(token, { call: structuredClone(result.confirmation), until: Date.now() + 60000 }); return { ok: false, message: `Confirm ${result.confirmation.name.replaceAll('_', ' ')}?`, token }; }
    return result;
  }
  private async startFocus(a: Record<string, unknown>): Promise<ToolResult> {
    await this.store.focus.save(this.store.focus.value);
    const minutes = Number(a.minutes ?? this.store.focus.value.settings.focusMinutes); const now = Date.now();
    this.breakMinutes = undefined;
    this.focus = { endAt: now + minutes * 60000, remaining: minutes * 60000, paused: false, kind: a.kind === 'break' ? 'break' : 'focus', startedAt: now, minutes };
    this.armFocus(); this.hooks.attention('focus'); return this.result(`${this.focus.kind === 'break' ? 'Break' : 'Focus'} started: ${minutes} minutes.`);
  }
  private focusAction(action: string): ToolResult {
    if (!this.focus) return { ok: false, message: 'No timer is running.' };
    if (action === 'pause' && !this.focus.paused) { this.focus.remaining = Math.max(0, this.focus.endAt - Date.now()); this.focus.paused = true; clearTimeout(this.focusTimer); }
    if (action === 'resume' && this.focus.paused) { this.focus.endAt = Date.now() + this.focus.remaining; this.focus.paused = false; this.armFocus(); }
    if (action === 'stop') { clearTimeout(this.focusTimer); this.focus = undefined; return this.result('Timer stopped.'); }
    const left = Math.ceil((this.focus.paused ? this.focus.remaining : Math.max(0, this.focus.endAt - Date.now())) / 1000);
    return this.result(`${this.focus.paused ? 'Paused. ' : ''}${Math.floor(left / 60)}m ${left % 60}s left.`);
  }
  private armFocus(): void {
    clearTimeout(this.focusTimer); const session = this.focus;
    if (session && !session.paused) this.focusTimer = setTimeout(() => { void this.serial(() => this.finishFocus(session)).catch(() => { this.message = 'Could not save focus history.'; this.publish(); }); }, Math.max(0, session.endAt - Date.now()));
  }
  private async finishFocus(expected = this.focus): Promise<void> {
    const session = this.focus; if (!session || session !== expected || session.paused || session.endAt > Date.now()) return; this.focus = undefined;
    const data = this.store.focus.value;
    if (session.kind === 'focus') {
      this.sessions++;
      if (data.settings.keepHistory) { data.history = [...data.history, { startedAt: new Date(session.startedAt).toISOString(), endedAt: stamp(), minutes: session.minutes }].slice(-1000); await this.store.focus.save(data); }
      this.hooks.attention('celebrate', 'focus_done'); this.message = 'Focus complete. Time for a break?';
      this.breakMinutes = this.sessions % 4 === 0 ? data.settings.longMinutes : data.settings.shortMinutes;
      if (data.settings.autoBreak) await this.startFocus({ minutes: this.breakMinutes, kind: 'break' });
    } else this.message = 'Break complete.';
    this.publish();
  }
  start(): void {
    this.queue = this.store.reminders.value.filter(r => r.state === 'due').map(r => ({ id: r.id, missed: false }));
    for (const r of this.store.reminders.value) if (r.lastFiredAt) { this.notified.add(`${r.id}:${r.lastFiredAt}`); this.presented.add(`${r.id}:${r.lastFiredAt}`); }
    void this.tick(true); this.interval = setInterval(() => { void this.tick(); }, CHECK_MS); this.publish();
  }
  tick(recovery = false): Promise<void> { return this.serial(() => {
    if (this.stopped) return;
    const original = this.store.reminders.value; const result = this.scheduler.evaluate(original, recovery);
    const changed = JSON.stringify(original) !== JSON.stringify(result.reminders);
    if (changed) this.store.reminders.commit(result.reminders);
    // Persisted fired marker is now durable; only then may UI/OS observe delivery.
    for (const delivery of result.deliveries) {
      const queued = this.queue.find(q => q.id === delivery.reminder.id);
      if (queued) queued.missed = delivery.missed; else this.queue.push({ id: delivery.reminder.id, missed: delivery.missed });
    }
    if (!this.hooks.doNotDisturb() && this.queue.length && (this.card !== 'reminder-due' || result.deliveries.some(d => d.reminder.id === this.selected))) this.showDue();
    else if (changed) this.publish();
    if (this.focus && !this.focus.paused && this.focus.endAt <= Date.now()) { clearTimeout(this.focusTimer); return this.finishFocus(); }
  }).catch(() => { this.message = 'Could not save reminder delivery. Will retry on the next check.'; this.publish(); }); }
  private showDue(): void {
    const next = this.queue[0]; if (!next || this.hooks.doNotDisturb()) return;
    const r = this.store.reminders.value.find(r => r.id === next.id); if (!r) return;
    this.message = next.missed ? `You missed this while I was asleep: ${r.text}` : 'reminder_due';
    this.card = 'reminder-due'; this.selected = r.id;
    const key = `${r.id}:${r.lastFiredAt}`;
    if (!this.presented.has(key)) { this.presented.add(key); this.hooks.attention('alarm', this.message); }
    this.publish();
    // Each queued occurrence is notified once per process; recovered due cards are silent.
    if (this.store.focus.value.settings.notifications && next.missed !== undefined && !this.notified.has(`${r.id}:${r.lastFiredAt}`)) {
      this.notified.add(`${r.id}:${r.lastFiredAt}`);
      try { this.hooks.notify(r, () => this.open('reminder-due', r.id)); } catch { this.message = 'Reminder is due; the Windows notification was unavailable.'; this.publish(); }
    }
  }
  private notified = new Set<string>();
  private presented = new Set<string>();
  private dequeue(id: string): void { this.queue = this.queue.filter(q => q.id !== id); if (this.card === 'reminder-due' && this.selected === id) { this.card = null; this.selected = undefined; this.showDue(); } }
  dispose(): void { this.stopped = true; clearInterval(this.interval); clearTimeout(this.focusTimer); this.store.dispose(); }
}
