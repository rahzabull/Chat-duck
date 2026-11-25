import type { CompanionState } from '../../shared/types';
import { localDate, type ProductivityView, type Reminder, type Task } from '../../core/productivity/types';

/** All data enters textContent/value. No HTML interpretation of user or model text. */
export function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = ''): HTMLElementTagNameMap[K] { const node = document.createElement(tag); node.textContent = text; return node; }
function button(label: string, fn: () => void): HTMLButtonElement { const b = element('button', label); b.type = 'button'; b.onclick = fn; return b; }
function field(label: string, value = '', multiline = false): HTMLInputElement | HTMLTextAreaElement {
  const input = multiline ? element('textarea') : element('input'); input.value = value; input.setAttribute('aria-label', label); input.placeholder = label; input.maxLength = multiline ? 20000 : 4000; return input;
}
export function reminderLabel(r: Reminder): string {
  const date = new Date(r.state === 'due' && r.lastFiredAt ? r.lastFiredAt : r.snoozedUntil ?? r.at); const today = localDate(new Date()); const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const when = localDate(date) === today ? 'Today' : localDate(date) === localDate(tomorrow) ? 'Tomorrow' : date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); const rule = r.recurrence;
  const repeat = rule?.kind === 'daily' ? 'Every day' : rule?.kind === 'weekly' ? `Every ${rule.weekdays!.map(n => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][n]).join(', ')}` : rule?.kind === 'monthly' ? `Every month, day ${rule.dayOfMonth} (last day if shorter)` : rule?.kind === 'custom' ? `Every ${rule.intervalDays} days` : '';
  return `${r.snoozedUntil ? 'Snoozed until ' : ''}${when}, ${time}${repeat ? ` · ${repeat}` : ''}`;
}
export class ProductivityUI {
  readonly card = element('section'); readonly badge = element('section');
  private status = element('p'); private view?: ProductivityView; private revision = -1;
  private toast = element('p');
  private search = ''; private tab = 'today'; private note?: string; private lastCard?: string | null;
  private expanded = new Set<string>();
  private countdown?: ReturnType<typeof setInterval>; private clock = element('span');
  private undoTimer?: ReturnType<typeof setTimeout>;
  constructor(private host: HTMLElement) {
    this.card.id = 'productivity-card'; this.card.setAttribute('aria-label', 'Ducky productivity card'); this.card.setAttribute('role', 'region'); this.card.tabIndex = -1;
    this.badge.id = 'focus-badge'; this.badge.setAttribute('aria-label', 'Focus timer'); this.status.setAttribute('role', 'status');
    this.card.hidden = true; this.badge.hidden = true; document.body.append(this.card, this.badge);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !this.card.hidden) { e.preventDefault(); e.stopImmediatePropagation(); void this.run('close'); }
    }, true);
  }
  hit(node: Element | null): boolean { return !!node && ((!this.card.hidden && this.card.contains(node)) || (!this.badge.hidden && this.badge.contains(node))); }
  private async run(name: string, args: Record<string, unknown> = {}, token?: string): Promise<void> {
    try {
      const result = await window.ducky.productivity({ name, args, ...(token ? { token } : {}) });
      this.status.replaceChildren(document.createTextNode(result.message));
      if (result.token) {
        this.status.append(button('Confirm', () => { void this.run(name, args, result.token); }), button('Cancel', () => { this.status.textContent = 'Cancelled.'; }));
        this.status.querySelector('button')?.focus();
      }
    } catch { this.status.textContent = 'Could not save that change. Please try again.'; }
  }
  private form(parent: HTMLElement, label: string, submit: (value: string) => Promise<void>, multiline = false): void {
    const f = element('form'); const input = field(label, '', multiline); const add = element('button', 'Add'); add.type = 'submit';
    f.onsubmit = e => { e.preventDefault(); const text = input.value.trim(); if (!text) return; add.disabled = true; void submit(text).finally(() => { add.disabled = false; }); };
    f.append(input, add); parent.append(f);
  }
  render(state: CompanionState): void {
    const view = state.productivity; this.view = view; if (!view) return;
    this.toast.textContent = state.productivitySpeech ?? ''; this.toast.hidden = !state.productivitySpeech;
    const active = !!view.card || !!view.focus || !!view.breakMinutes;
    if (active && view.layout) {
      const l = view.layout;
      Object.assign(this.host.style, { inset: 'auto', left: `${l.x}px`, top: `${l.y}px`, width: `${l.width}px`, height: `${l.height}px` });
      Object.assign(this.card.style, { left: `${l.contentX}px`, bottom: `${l.contentBottom}px`, width: `${l.contentWidth}px`, maxHeight: `${Math.min(420, l.contentHeight)}px` });
      Object.assign(this.badge.style, { left: `${l.contentX}px`, bottom: `${l.contentBottom - 38}px`, maxWidth: `${l.contentWidth}px` });
    }
    this.card.hidden = !view.card; this.badge.hidden = !view.focus && !view.breakMinutes;
    document.body.classList.toggle('productivity-open', !!view.card);
    if (view.revision === this.revision) return; this.revision = view.revision;
    const identity = `${view.card}:${view.selected ?? ''}:${view.filter ?? ''}`;
    if (identity !== this.lastCard) { this.search = view.filter && view.card === 'notes' ? view.filter : ''; this.note = view.card === 'notes' ? view.selected : undefined; this.tab = view.filter || 'today'; this.lastCard = identity; }
    if (view.card) this.renderCard();
    this.renderFocus();
  }
  private renderCard(): void {
    clearTimeout(this.undoTimer);
    const v = this.view!;
    const focused = document.activeElement instanceof HTMLInputElement ? document.activeElement : undefined;
    const focusLabel = focused?.getAttribute('aria-label'); const caret = focused?.selectionStart;
    this.card.replaceChildren(); const heading = element('header');
    heading.append(element('strong', v.card?.includes('reminder') ? 'Reminders' : v.card === 'notes' ? 'Notes' : 'Tasks'), button('Close', () => { void this.run('close'); })); this.card.append(heading, this.toast);
    if (v.card === 'tasks') this.tasks();
    if (v.card === 'task-created') {
      const task = v.tasks.find(t => t.id === v.selected); if (task) { this.card.append(element('p', `Added: ${task.title}`), element('p', task.due ? `Due ${task.due}${task.dueTime ? ` at ${task.dueTime}` : ''}` : 'No due date')); }
      this.undo(); this.card.append(button('Open tasks', () => { void this.run('open', { card: 'tasks' }); }));
    }
    if (v.card === 'add-task') this.form(this.card, 'Task, e.g. buy dog food tomorrow', text => this.run('text', { text: `add ${text}` }));
    if (v.card === 'add-reminder') this.form(this.card, 'Reminder, e.g. call Mum tomorrow at 6', text => this.run('text', { text: `remind me to ${text}` }));
    if (v.card === 'reminders') {
      for (const r of v.reminders) { const row = element('article'); row.append(element('strong', r.text), element('p', `${reminderLabel(r)} · ${r.state}`)); this.reminderControls(row, r); this.card.append(row); }
      this.form(this.card, 'Remind me to…', text => this.run('text', { text: `remind me to ${text}` }));
    }
    if (v.card === 'reminder-created' || v.card === 'reminder-due') {
      const r = v.reminders.find(r => r.id === v.selected);
      if (r) { this.card.append(element('p', r.text), element('p', reminderLabel(r))); if (v.card === 'reminder-due') {
        if (v.message.startsWith('You missed')) this.card.append(element('p', v.message));
        if (v.queue) this.card.append(element('small', `+${v.queue} more`));
      } this.reminderControls(this.card, r); }
      if (v.card === 'reminder-created') this.undo();
    }
    if (v.card === 'notes') this.notes();
    this.status.textContent = v.message === 'reminder_due' ? '' : v.message; this.card.append(this.status);
    if (focusLabel) { const input = [...this.card.querySelectorAll('input')].find(i => i.getAttribute('aria-label') === focusLabel); input?.focus(); if (input && caret !== null && caret !== undefined && input.type === 'text') input.setSelectionRange(caret, caret); }
  }
  private undo(): void {
    const remaining = (this.view!.undoUntil ?? 0) - Date.now(); if (remaining <= 0) return;
    const undo = button('Undo', () => { void this.run('undo'); }); this.card.append(undo);
    this.undoTimer = setTimeout(() => undo.remove(), remaining);
  }
  private tasks(): void {
    const tabs = element('nav'); tabs.setAttribute('aria-label', 'Task views');
    for (const tab of ['today', 'upcoming', 'overdue', 'done']) { const b = button(tab[0].toUpperCase() + tab.slice(1), () => { this.tab = tab; this.renderCard(); }); b.setAttribute('aria-pressed', String(this.tab === tab)); tabs.append(b); }
    this.card.append(tabs); const search = field('Search tasks', this.search); search.oninput = () => { this.search = search.value; this.renderCard(); }; this.card.append(search);
    const today = localDate(new Date()); const end = new Date(); end.setDate(end.getDate() + 7); const week = localDate(end);
    const tasks = this.view!.tasks.filter(t => t.title.toLowerCase().includes(this.search.toLowerCase())).filter(t => this.tab === 'done' ? t.done : !t.done && (this.tab === 'today' ? t.due === today : this.tab === 'overdue' ? !!t.due && t.due < today : this.tab === 'week' ? !!t.due && t.due >= today && t.due <= week : !t.due || t.due >= today));
    for (const task of tasks) this.taskRow(task);
    if (!tasks.length) this.card.append(element('p', 'Nothing here. A rare moment of peace.'));
    this.form(this.card, '+ Add task', text => this.run('text', { text: `add ${text}` }));
    if (this.tab === 'done') this.card.append(button('Clear completed', () => { void this.run('clear_completed'); }));
  }
  private taskRow(task: Task): void {
    const row = element('article'); const line = element('div'); const done = element('input'); done.type = 'checkbox'; done.checked = task.done; done.setAttribute('aria-label', `Complete ${task.title}`);
    done.onchange = () => { void this.run('update_task', { id: task.id, done: done.checked }); };
    const title = field(`Title: ${task.title}`, task.title); title.onchange = () => { void this.run('update_task', { id: task.id, title: title.value }); };
    line.append(done, title); line.className = 'task-title'; row.append(line);
    const due = field(`Due: ${task.title}`, task.due ? `${task.due}${task.dueTime ? ` ${task.dueTime}` : ''}` : ''); due.placeholder = 'Due: tomorrow 9am'; due.onchange = () => { void this.run('update_task', { id: task.id, dueInput: due.value }); };
    const priority = button(`Priority: ${task.priority}`, () => { void this.run('update_task', { id: task.id, priority: task.priority === 'normal' ? 'high' : task.priority === 'high' ? 'low' : 'normal' }); });
    row.append(due, priority);
    const details = element('details'); details.append(element('summary', `Details & subtasks (${task.subtasks.filter(s => s.done).length}/${task.subtasks.length})`));
    details.open = this.expanded.has(task.id); details.ontoggle = () => { if (details.open) this.expanded.add(task.id); else this.expanded.delete(task.id); };
    const notes = field('Task notes', task.notes ?? '', true); notes.onchange = () => { void this.run('update_task', { id: task.id, notes: notes.value }); };
    const category = field('Category', task.category ?? ''); category.maxLength = 100; category.onchange = () => { void this.run('update_task', { id: task.id, category: category.value }); }; details.append(notes, category);
    for (const sub of task.subtasks) { const label = element('label', sub.title); const check = element('input'); check.type = 'checkbox'; check.checked = sub.done; check.onchange = () => { void this.run('update_task', { id: task.id, subtasks: task.subtasks.map(s => s.id === sub.id ? { ...s, done: check.checked } : s) }); }; label.prepend(check); details.append(label); }
    this.form(details, 'Add subtask', title => this.run('update_task', { id: task.id, subtasks: [...task.subtasks, { id: crypto.randomUUID(), title, done: false }] }));
    row.append(details, button('Delete', () => { void this.run('delete_task', { id: task.id }); })); this.card.append(row);
  }
  private reminderControls(parent: HTMLElement, reminder: Reminder): void {
    const id = reminder.id;
    parent.append(button('Done', () => { void this.run('done_reminder', { id }); }));
    const snooze = element('select'); snooze.setAttribute('aria-label', 'Snooze duration');
    for (const n of [5, 10, 30, 60]) { const o = element('option', `${n} min`); o.value = String(n); snooze.append(o); } snooze.value = String(this.view!.settings.defaultSnooze);
    const custom = element('option', 'Custom'); custom.value = 'custom'; snooze.append(custom); if (!snooze.value) snooze.value = 'custom';
    const duration = field('Custom snooze minutes', String(this.view!.settings.defaultSnooze)) as HTMLInputElement; duration.type = 'number'; duration.min = '1'; duration.max = '1440'; duration.hidden = snooze.value !== 'custom'; snooze.onchange = () => { duration.hidden = snooze.value !== 'custom'; };
    parent.append(snooze, duration, button('Snooze', () => { void this.run('snooze_reminder', { id, minutes: Number(snooze.value === 'custom' ? duration.value : snooze.value) }); }));
    const edit = element('details'); edit.append(element('summary', 'Edit / Reschedule'));
    const text = field('Reminder text', reminder.text); const when = field('New date/time, e.g. tomorrow 9am');
    edit.append(text, when, button('Save changes', () => { void this.run('update_reminder', { id, text: text.value, ...(when.value ? { when: when.value } : {}) }); }));
    parent.append(edit, button('Dismiss', () => { void this.run('dismiss_reminder', { id }); }), button('Delete', () => { void this.run('cancel_reminder', { id }); }));
  }
  private notes(): void {
    const note = this.view!.notes.find(n => n.id === this.note);
    if (note) {
      const title = field('Note title', note.title ?? ''); const topic = field('Topic', note.topic ?? ''); topic.maxLength = 100; const text = field('Note text', note.text, true);
      this.card.append(button('Back to notes', () => { this.note = undefined; this.renderCard(); }), title, topic, text,
        button('Save', () => { void this.run('update_note', { id: note.id, title: title.value, topic: topic.value, text: text.value }); }),
        button('Copy', () => { void this.run('copy_note', { id: note.id }); }),
        button(note.pinned ? 'Unpin' : 'Pin', () => { void this.run('update_note', { id: note.id, pinned: !note.pinned }); }),
        button('Delete', () => { void this.run('delete_note', { id: note.id }); })); return;
    }
    const search = field('Search notes', this.search); search.oninput = () => { this.search = search.value; this.renderCard(); }; this.card.append(search);
    const notes = [...this.view!.notes].sort((a, b) => Number(b.pinned) - Number(a.pinned)).filter(n => `${n.title ?? ''} ${n.text} ${n.topic ?? ''}`.toLowerCase().includes(this.search.toLowerCase()));
    for (const n of notes) this.card.append(button(`${n.pinned ? '★ ' : ''}${n.title || n.text.slice(0, 100)}`, () => { this.note = n.id; this.renderCard(); }));
    if (!notes.length) this.card.append(element('p', 'No notes here yet.'));
    this.form(this.card, 'New note', text => this.run('add_note', { text }), true);
  }
  private renderFocus(): void {
    clearInterval(this.countdown); this.countdown = undefined; this.badge.replaceChildren(); const focus = this.view?.focus;
    if (!focus) { if (this.view?.breakMinutes) this.badge.append(button(`Start ${this.view.breakMinutes} min break`, () => { void this.run('start_focus', { minutes: this.view!.breakMinutes, kind: 'break' }); }), button('Skip', () => { void this.run('skip_break'); })); return; }
    const update = () => { const seconds = Math.max(0, Math.ceil((focus.paused ? focus.remaining : focus.endAt - Date.now()) / 1000)); this.clock.textContent = `${focus.kind === 'break' ? 'Break' : 'Focus'} ${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; };
    update(); if (!focus.paused) this.countdown = setInterval(update, 1000);
    this.badge.append(this.clock, button(focus.paused ? 'Resume' : 'Pause', () => { void this.run(focus.paused ? 'resume_focus' : 'pause_focus'); }), button('Stop', () => { void this.run('stop_focus'); }));
  }
  dispose(): void { clearInterval(this.countdown); clearTimeout(this.undoTimer); }
}
