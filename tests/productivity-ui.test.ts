import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProductivityUI, reminderLabel } from '../src/renderer/companion/productivity';
import { FOCUS_DEFAULTS, type ProductivityView } from '../src/core/productivity/types';
import type { CompanionState } from '../src/shared/types';
// Deliberately no HTML parser: assigning to an unsafe sink fails the test immediately.
class Node {
  tag: string; children: Node[] = []; attrs = new Map<string, string>(); textContent = ''; value = ''; hidden = false; disabled = false; type = ''; checked = false;
  style = {}; classList = { toggle: vi.fn() }; onclick?: () => void; oninput?: () => void;
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
  const ui = new ProductivityUI(new Node() as unknown as HTMLElement); const state = { productivity: view } as CompanionState; ui.render(state); return { ui, api, view, state, listeners };
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('temporary productivity cards', () => {
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
