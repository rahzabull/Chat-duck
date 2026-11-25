import { afterEach, describe, expect, it, vi } from 'vitest';
import { TALK_LINES } from '../src/core/dialogue/lines';
import { splitBeats } from '../src/core/conversation/presentation';
import { ConversationUI } from '../src/renderer/companion/conversation';
import type { CharacterSurface } from '../src/animation/adapter';
import type { CompanionState } from '../src/shared/types';

// Only the DOM surface used by ConversationUI; no browser dependency required.
class Element {
  hidden = false; disabled = false; value = ''; textContent = '';
  style = { setProperty: vi.fn() };
  classList = { toggle: vi.fn(), remove: vi.fn(), contains: vi.fn() };
  focus = vi.fn(); append = vi.fn(); setAttribute = vi.fn(); removeAttribute = vi.fn(); addEventListener = vi.fn();
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('conversation input focus presentation', () => {
  it('hides and disables the input until confirmed focus, and retries from a duck or bubble click', () => {
    vi.useFakeTimers();
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.push(callback); });
    vi.stubGlobal('document', { createElement: () => new Element(), body: new Element(), addEventListener: vi.fn() });
    const open = vi.fn(); const end = vi.fn(); vi.stubGlobal('window', { ducky: { doubleClick: open, talkEnd: end } });
    const bubble = new Element();
    const ui = new ConversationUI(new Element() as unknown as HTMLElement, bubble as unknown as HTMLButtonElement, { setConversationState: vi.fn(), setTalking: vi.fn() } as unknown as CharacterSurface);
    const state = { conversation: { active: true, inputReady: false, focusRequest: 0, state: 'listening', reply: "I'm listening.", revision: 1, panel: false, shortcutError: '' } } as CompanionState;
    ui.render(state);
    expect(ui.input.hidden).toBe(true); expect(ui.input.disabled).toBe(true); expect(ui.input.focus).not.toHaveBeenCalled();
    expect(bubble.textContent).not.toBe('Click me to type.');
    state.conversation!.focusFailed = true; ui.render(state);
    expect(bubble.textContent).toBe('Click me to type.'); expect(bubble.hidden).toBe(false);
    expect(ui.clickToType()).toBe(true); expect(open).toHaveBeenCalledOnce();
    expect(ui.input.hidden).toBe(true); // A click request alone is not proof of focus.
    state.conversation!.focusFailed = false; state.conversation!.inputReady = true; state.conversation!.focusRequest = 1; ui.render(state);
    frames.splice(0).forEach(frame => frame(0));
    expect(ui.input.hidden).toBe(false); expect(ui.input.disabled).toBe(false); expect(ui.input.focus).toHaveBeenCalledOnce();
    expect(bubble.textContent).toBe("I'm listening."); expect(ui.clickToType()).toBe(false);
    state.conversation!.focusRequest = 2; ui.render(state); // Shortcut while already conversing refocuses the textarea.
    frames.splice(0).forEach(frame => frame(0)); expect(ui.input.focus).toHaveBeenCalledTimes(2);
    state.conversation!.focusRequest = 3; ui.render(state);
    state.conversation!.inputReady = false; ui.render(state);
    frames.splice(0).forEach(frame => frame(0)); // A queued frame cannot focus a now-hidden input.
    expect(ui.input.focus).toHaveBeenCalledTimes(2); expect(ui.input.hidden).toBe(true); expect(bubble.textContent).not.toBe('Click me to type.');
    const registration = vi.mocked(document.addEventListener).mock.calls.find(([name]) => name === 'keydown')!;
    expect(registration[2]).toBe(true); // Capture runs before a focused textarea/card can stop bubbling.
    const keydown = registration[1] as (event: unknown) => void;
    keydown({ key: 'Escape', preventDefault: vi.fn() }); expect(end).toHaveBeenCalledOnce();
    state.conversation!.focusFailed = true; ui.render(state); expect(bubble.textContent).toBe('Click me to type.');
    state.conversation!.active = false; state.conversation!.reply = ''; state.conversation!.state = null; ui.render(state);
    expect(bubble.hidden).toBe(true); expect(bubble.textContent).toBe('');
    state.conversation!.active = true; state.conversation!.inputReady = true; state.conversation!.focusFailed = false;
    for (const reply of ['Here is JSON: {"query":"tea"}', '- recall_memories\n- recall_conversations']) {
      state.conversation!.reply = reply; state.conversation!.revision++; ui.render(state);
      expect(bubble.textContent).toBe(splitBeats(TALK_LINES.talk_error[0])[0] + ' …'); expect(ui.panel.hidden).toBe(true);
    }
    ui.dispose();
  });
});
