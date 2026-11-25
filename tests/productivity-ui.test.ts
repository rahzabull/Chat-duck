import { ProactiveUI } from '../src/renderer/companion/proactive';
import { DEFAULT_SETTINGS } from '../src/shared/schemas/settings';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProductivityUI, reminderLabel } from '../src/renderer/companion/productivity';
import { FOCUS_DEFAULTS, type ProductivityView } from '../src/core/productivity/types';
import type { CompanionState } from '../src/shared/types';
import { ConversationUI } from '../src/renderer/companion/conversation';
import type { CharacterSurface } from '../src/animation/adapter';
// Deliberately no HTML parser: assigning to an unsafe sink fails the test immediately.
class Node {
  tag: string; children: Node[] = []; attrs = new Map<string, string>(); textContent = ''; value = ''; hidden = false; disabled = false; type = ''; checked = false;
  style = { setProperty: vi.fn() }; classList = { toggle: vi.fn(), remove: vi.fn(), contains: vi.fn() }; onclick?: () => void; oninput?: () => void;
  addEventListener = vi.fn(); removeAttribute = vi.fn();
  constructor(tag = 'div') { this.tag = tag; }
  set innerHTML(_value: string) { throw new Error('HTML sink is forbidden'); }
  append(...nodes: Node[]) { this.children.push(...nodes); }
  prepend(...nodes: Node[]) { this.children.unshift(...nodes); }
  replaceChildren(...nodes: Node[]) { this.children = nodes; }
  setAttribute(k: string, v: string) { this.attrs.set(k, v); }
  getAttribute(k: string) { return this.attrs.get(k); }
  querySelectorAll(tag: string): Node[] { return this.children.flatMap(n => [...(n.tag === tag ? [n] : []), ...n.querySelectorAll(tag)]); }
  querySelector(tag: string) { return this.querySelectorAll(tag)[0]; }
  contains(node: Node): boolean { return node === this || this.children.some(n => n.contains(node)); }
  focus() {}
}
const malicious = '<img src=x onerror="globalThis.hacked=true">';
function setup(card: ProductivityView['card']) {
  const listeners: { name: string; fn: (e: any) => void; capture?: boolean }[] = [];
  vi.stubGlobal('document', { activeElement: null, createElement: (tag: string) => new Node(tag), createTextNode: (s: string) => Object.assign(new Node('text'), { textContent: s }), body: new Node(), addEventListener: (name: string, fn: (e: any) => void, capture?: boolean) => listeners.push({ name, fn, capture }) });
  vi.stubGlobal('HTMLInputElement', Node);
  const api = vi.fn(async () => ({ ok: true, message: '' })); vi.stubGlobal('window', { ducky: { productivity: api } });
  const now = new Date().toISOString();
  const view: ProductivityView = { revision: 1, card, tasks: [{ id: 't', title: malicious, due: now.slice(0, 10), priority: 'normal', done: false, subtasks: [], createdAt: now, updatedAt: now }], reminders: [{ id: 'r', text: malicious, at: now, state: 'due', createdAt: now, timezone: 'UTC' }], notes: [{ id: 'n', text: malicious, title: malicious, pinned: false, createdAt: now, updatedAt: now }], settings: { ...FOCUS_DEFAULTS }, queue: 0, message: malicious, selected: card === 'notes' ? 'n' : card?.includes('reminder') ? 'r' : 't' };
  const ui = new ProductivityUI(new Node() as unknown as HTMLElement); const state = { visible: true, productivity: view } as CompanionState; ui.render(state); return { ui, api, view, state, listeners };
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('temporary productivity cards', () => {
  it('keeps input, reading-panel and card close buttons in hit testing and routes each close correctly', async () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn()); const { ui, state, api } = setup('tasks');
    const end = vi.fn(); const panel = vi.fn(); Object.assign(window.ducky, { talkEnd: end, talkPanel: panel });
    const conversation = new ConversationUI(new Node() as unknown as HTMLElement, new Node() as unknown as HTMLButtonElement, { setConversationState: vi.fn(), setTalking: vi.fn() } as unknown as CharacterSurface);
    state.conversation = { active: true, inputReady: true, state: 'listening', reply: '', revision: 1, panel: false, shortcutError: '' };
    conversation.render(state);
    const inputClose = (conversation.inputShell as unknown as Node).querySelector('button')!;
    expect(inputClose.attrs.get('aria-label')).toBe('Close'); expect(inputClose.textContent).toBe('×');
    expect(conversation.hit(inputClose as unknown as Element)).toBe(true); inputClose.onclick!(); expect(end).toHaveBeenCalledOnce();
    const cardClose = (ui.card as unknown as Node).querySelectorAll('button').find(b => b.attrs.get('aria-label') === 'Close')!;
    expect(ui.hit(cardClose as unknown as Element)).toBe(true); cardClose.onclick!(); await Promise.resolve();
    expect(api).toHaveBeenCalledWith({ name: 'close', args: {} }); expect(end).toHaveBeenCalledOnce();
    conversation.panel.hidden = false; const panelClose = (conversation.panel as unknown as Node).querySelectorAll('button').find(b => b.attrs.get('aria-label') === 'Close')!;
    expect(conversation.hit(panelClose as unknown as Element)).toBe(true); panelClose.onclick!();
    expect(conversation.panel.hidden).toBe(true); expect(panel).toHaveBeenCalledWith(false); expect(end).toHaveBeenCalledOnce();
    state.conversation.active = false; conversation.render(state); expect(conversation.hit(inputClose as unknown as Element)).toBe(false);
    conversation.dispose(); ui.dispose();
  });
  it('shows interval schedules and occurrence actions, with Stop series only on repeating reminders', () => {
    const { ui, view, state, api } = setup('reminder-due');
    view.reminders[0].recurrence = { kind: 'interval', intervalMinutes: 30, window: { start: '09:00', end: '18:00' } }; view.revision++; ui.render(state);
    expect(reminderLabel(view.reminders[0])).toBe('Every 30 minutes, 9:00 AM–6:00 PM');
    const buttons = (ui.card as unknown as Node).querySelectorAll('button');
    expect(buttons.map(b => b.textContent)).toEqual(['×', 'Done', 'Snooze 10 min', 'Stop series']);
    buttons[3].onclick!(); expect(api).toHaveBeenCalledWith({ name: 'cancel_reminder', args: { id: 'r' } });
    view.reminders[0].recurrence = undefined; view.revision++; ui.render(state);
    expect((ui.card as unknown as Node).querySelectorAll('button').map(b => b.textContent)).not.toContain('Stop series'); ui.dispose();
  });
  it('shows today and overdue open tasks, then undated tasks under No date, respecting search', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 10, 25, 12));
    const { ui, view, state } = setup('tasks'); const base = view.tasks[0];
    view.tasks = [
      { ...base, id: 'u', title: 'buy dog food', due: undefined },
      { ...base, id: 't', title: 'today', due: '2026-11-25' },
      { ...base, id: 'o', title: 'late', due: '2026-11-24' },
      { ...base, id: 'f', title: 'future', due: '2026-11-26' },
      { ...base, id: 'd', title: 'done', done: true, due: undefined },
    ]; view.revision++; ui.render(state);
    const card = ui.card as unknown as Node;
    const titles = () => card.querySelectorAll('input').filter(n => n.attrs.get('aria-label')?.startsWith('Title:')).map(n => n.value);
    expect(titles()).toEqual(['today', 'late', 'buy dog food']);
    expect(card.querySelectorAll('small').map(n => n.textContent)).toContain('Overdue');
    expect(card.querySelectorAll('h3').map(n => n.textContent)).toContain('No date');
    const heading = card.children.findIndex(n => n.textContent === 'No date');
    expect(card.children[heading + 1].querySelectorAll('input').some(n => n.value === 'buy dog food')).toBe(true);
    const search = card.querySelectorAll('input').find(n => n.attrs.get('aria-label') === 'Search tasks')!;
    search.value = 'dog'; search.oninput!(); expect(titles()).toEqual(['buy dog food']); ui.dispose();
  });
  it('formats reminder dates in plain words, with no seconds and stable AM/PM', () => {
    const { ui, view } = setup('reminders'); const now = new Date(2025, 10, 25, 12);
    const r = { ...view.reminders[0], state: 'scheduled' as const };
    expect(reminderLabel({ ...r, at: new Date(2025, 10, 25, 16, 17, 59).toISOString() }, now)).toBe('Today, 4:17 PM');
    expect(reminderLabel({ ...r, at: new Date(2025, 10, 26, 9).toISOString() }, now)).toBe('Tomorrow, 9:00 AM');
    expect(reminderLabel({ ...r, at: new Date(2025, 11, 2, 18).toISOString() }, now)).toBe('Tue 2 Dec, 6:00 PM');
    expect(reminderLabel({ ...r, at: new Date(2025, 11, 2, 9).toISOString(), recurrence: { kind: 'weekly', weekdays: [2] } }, now)).toBe('Every Tuesday, 9:00 AM');
    ui.dispose();
  });
  it('handles first Escape for the card and second for the conversation before target bubbling, in either listener order', async () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn());
    const { ui, view, state, listeners, api } = setup('notes');
    const end = vi.fn(); Object.assign(window.ducky, { talkEnd: end });
    const conversation = new ConversationUI(new Node() as unknown as HTMLElement, new Node() as unknown as HTMLButtonElement,
      { setConversationState: vi.fn(), setTalking: vi.fn() } as unknown as CharacterSurface);
    state.conversation = { active: true, inputReady: false, state: 'listening', reply: '', revision: 1, panel: false, shortcutError: '' };
    const keyboard = listeners.filter(l => l.name === 'keydown'); expect(keyboard.every(l => l.capture === true)).toBe(true);
    for (const ordered of [keyboard, [...keyboard].reverse()]) {
      view.card = 'notes'; view.revision++; ui.render(state); conversation.render(state); end.mockClear(); api.mockClear();
      const dispatch = () => {
        let stopped = false;
        const event = { key: 'Escape', preventDefault: vi.fn(), stopImmediatePropagation: () => { stopped = true; } };
        for (const listener of ordered) { listener.fn(event); if (stopped) break; }
        // A textarea stopping propagation at the target cannot prevent these capture listeners.
        stopped = true;
      };
      dispatch(); await Promise.resolve(); expect(api).toHaveBeenCalledWith({ name: 'close', args: {} }); expect(end).not.toHaveBeenCalled();
      view.card = null; view.revision++; ui.render(state); conversation.render(state);
      dispatch(); expect(end).toHaveBeenCalledOnce();
    }
    conversation.dispose(); ui.dispose();
  });
  it.each(['tasks', 'task-created', 'reminders', 'reminder-created', 'reminder-due', 'notes', 'add-task', 'add-reminder'] as const)('renders %s entirely through safe DOM text/value nodes', card => {
    const { ui } = setup(card); expect(ui.card.hidden).toBe(false); expect(ui.card.querySelectorAll('img')).toHaveLength(0);
    const nodes = ui.card as unknown as Node; const all = (n: Node): Node[] => [n, ...n.children.flatMap(all)];
    expect(all(nodes).some(n => n.textContent.includes(malicious) || n.value.includes(malicious))).toBe(true);
    expect(all(nodes).filter(n => n.tag === 'button').every(n => n.type === 'button' || n.type === 'submit')).toBe(true); ui.dispose();
  });
  it('Escape closes just the current card before conversation Escape handling', async () => {
    const { ui, listeners, api } = setup('tasks'); const event = { key: 'Escape', preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() };
    const listener = listeners.find(l => l.name === 'keydown' && l.capture); listener!.fn(event); await Promise.resolve();
    expect(event.stopImmediatePropagation).toHaveBeenCalledOnce(); expect(api).toHaveBeenCalledWith({ name: 'close', args: {} }); ui.dispose();
  });
  it('has no idle countdown timer and stops updates when a focus timer pauses', () => {
    vi.useFakeTimers(); const { ui, view, state } = setup(null); expect(vi.getTimerCount()).toBe(0);
    view.focus = { kind: 'focus', paused: false, endAt: Date.now() + 60000, remaining: 60000, startedAt: Date.now(), minutes: 1 }; view.revision++; ui.render(state);
    expect(vi.getTimerCount()).toBe(1); expect(ui.badge.hidden).toBe(false); expect((ui.badge as unknown as Node).children[0].textContent).toBe('Focus 01:00');
    vi.advanceTimersByTime(1000); expect((ui.badge as unknown as Node).children[0].textContent).toBe('Focus 00:59');
    view.focus.paused = true; view.revision++; ui.render(state); expect(vi.getTimerCount()).toBe(0); ui.dispose();
  });
  it('labels a recurring due occurrence using its fired time, not tomorrow’s next occurrence', () => {
    const { ui, view } = setup('reminder-due'); const r = view.reminders[0]; const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1); r.lastFiredAt = yesterday.toISOString(); const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); r.at = tomorrow.toISOString();
    expect(reminderLabel(r)).not.toContain('Tomorrow'); ui.dispose();
  });
});


describe('Phase C companion affordances', () => {
  it('shows accessible mode badges and safely renders actionable suggestions', () => {
    const { state } = setup(null); state.settings = { ...DEFAULT_SETTINGS, privacyMode: true }; state.dnd = true;
    const command = vi.fn(async () => {}); window.ducky.command = command;
    const ui = new ProactiveUI(); ui.render(state);
    const body = document.body as unknown as Node;
    const badge = body.children.find(n => n.attrs.get('role') === 'status')!;
    expect(badge.hidden).toBe(false); expect(badge.attrs.get('aria-label')).toContain('Privacy mode');
    expect(badge.attrs.get('aria-label')).toContain('Do not disturb');
    state.dnd = false; state.proactive = { label: 'Plan it', detail: malicious, dismissLabel: 'Later' }; state.bubble = 'A deadline'; ui.render(state);
    const card = body.children.find(n => n.attrs.get('aria-label') === 'Ducky suggestion')!;
    expect(card.hidden).toBe(false); expect(card.querySelector('p')?.textContent).toBe(malicious);
    const buttons = card.querySelectorAll('button').filter(b => b.attrs.get('aria-label') !== 'Close'); buttons[0].onclick!(); buttons[1].onclick!();
    expect(command.mock.calls).toEqual([['proactive-accept'], ['proactive-later']]);
    state.gaming = true; ui.render(state); expect(card.hidden).toBe(true); expect(badge.hidden).toBe(true);
  });
  it('stops focus countdown work during gaming and resumes from the clock on return', () => {
    vi.useFakeTimers(); const { ui, view, state } = setup(null);
    view.focus = { kind: 'focus', paused: false, endAt: Date.now() + 60000, remaining: 60000, startedAt: Date.now(), minutes: 1 }; view.revision++; ui.render(state);
    expect(vi.getTimerCount()).toBe(1); state.gaming = true; ui.render(state); expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(10000); state.gaming = false; ui.render(state);
    expect(vi.getTimerCount()).toBe(1); expect((ui.badge as unknown as Node).querySelector('span')?.textContent).toContain('00:50'); ui.dispose();
  });
});
