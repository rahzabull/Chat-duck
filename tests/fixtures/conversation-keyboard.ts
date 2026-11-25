import { ConversationUI } from '../../src/renderer/companion/conversation';
import { ProductivityUI } from '../../src/renderer/companion/productivity';
import type { CharacterSurface } from '../../src/animation/adapter';
import type { CompanionState } from '../../src/shared/types';
import { FOCUS_DEFAULTS } from '../../src/core/productivity/types';
import '../../src/renderer/companion/style.css';

const calls: string[] = [];
const state = {
  visible: true,
  conversation: { active: true, inputReady: false, state: 'listening', reply: '', revision: 1, panel: false, shortcutError: '', layout: { x: 0, y: 300, width: 320, height: 300, contentX: 20, contentBottom: 300, contentWidth: 380, contentHeight: 280 } },
  productivity: { revision: 1, card: 'add-task', tasks: [], reminders: [], notes: [], settings: FOCUS_DEFAULTS, queue: 0, message: '' },
} as unknown as CompanionState;
window.ducky = {
  productivity: async () => { calls.push('close-card'); state.productivity!.card = null; state.productivity!.revision++; state.conversation!.inputReady = true; render(); return { ok: true, message: '' }; },
  talkEnd: async () => { calls.push('end-conversation'); state.conversation!.active = false; render(); },
  talkPanel: () => { calls.push('close-panel'); },
} as unknown as Window['ducky'];
const host = document.createElement('div'); const bubble = document.createElement('button'); document.body.append(host, bubble);
// Same construction order as the companion entry point.
const conversation = new ConversationUI(host, bubble, { setConversationState() {}, setTalking() {} } as unknown as CharacterSurface);
const productivity = new ProductivityUI(host);
state.productivity!.layout = state.conversation!.layout;
function render() { conversation.render(state); productivity.render(state); }
render();
const textarea = document.createElement('textarea'); productivity.card.append(textarea); textarea.focus();
textarea.addEventListener('keydown', event => event.stopImmediatePropagation());
conversation.input.addEventListener('keydown', event => event.stopImmediatePropagation());
Object.assign(window, { keyboardFixture: {
  calls,
  focusConversation: () => conversation.input.focus(),
  activeTag: () => document.activeElement?.tagName,
  activeOwner: () => document.activeElement === textarea ? 'card' : document.activeElement === conversation.input ? 'conversation' : 'other',
  showReminder: () => {
    const v = state.productivity!; const date = new Date().toISOString();
    v.card = 'reminder-due'; v.selected = 'water'; v.revision++;
    v.reminders = [{ id: 'water', text: 'Drink water', at: date, createdAt: date, timezone: 'UTC', state: 'due', recurrence: { kind: 'interval', intervalMinutes: 30, window: { start: '09:00', end: '18:00' } } }];
    state.conversation!.active = true; state.conversation!.inputReady = true;
    render();
  },
  showReading: () => {
    state.productivity!.card = null; state.productivity!.revision++;
    state.conversation!.reply = '- A longer reply for your reading panel.\n- Everything stays close at hand.'; state.conversation!.revision++;
    render();
  },
  closeInfo: (selector: string) => {
    const button = document.querySelector(`${selector} .close-button`) as HTMLButtonElement;
    const rect = button.getBoundingClientRect(); const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    return { x, y, width: rect.width, height: rect.height, hit: (conversation.hit(hit) || productivity.hit(hit)) && hit === button, label: button.getAttribute('aria-label'), tabIndex: button.tabIndex };
  },
} });
