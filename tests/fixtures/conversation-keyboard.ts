import { ConversationUI } from '../../src/renderer/companion/conversation';
import { ProductivityUI } from '../../src/renderer/companion/productivity';
import type { CharacterSurface } from '../../src/animation/adapter';
import type { CompanionState } from '../../src/shared/types';
import { FOCUS_DEFAULTS } from '../../src/core/productivity/types';

const calls: string[] = [];
const state = {
  conversation: { active: true, inputReady: false, state: 'listening', reply: '', revision: 1, panel: false, shortcutError: '' },
  productivity: { revision: 1, card: 'add-task', tasks: [], reminders: [], notes: [], settings: FOCUS_DEFAULTS, queue: 0, message: '' },
} as unknown as CompanionState;
window.ducky = {
  productivity: async () => { calls.push('close-card'); state.productivity!.card = null; state.productivity!.revision++; state.conversation!.inputReady = true; render(); return { ok: true, message: '' }; },
  talkEnd: async () => { calls.push('end-conversation'); state.conversation!.active = false; render(); },
} as unknown as Window['ducky'];
const host = document.createElement('div'); const bubble = document.createElement('button'); document.body.append(host, bubble);
// Same construction order as the companion entry point.
const conversation = new ConversationUI(host, bubble, { setConversationState() {}, setTalking() {} } as unknown as CharacterSurface);
const productivity = new ProductivityUI(host);
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
} });
