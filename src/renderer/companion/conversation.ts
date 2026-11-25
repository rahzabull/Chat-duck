import type { CharacterSurface } from '../../animation/adapter';
import type { CompanionState } from '../../shared/types';
import { needsReadingPanel, readingTime, splitBeats } from '../../core/conversation/presentation';
import { renderMarkdown } from './markdown';
import { guardedReply } from '../../core/conversation/output';
export class ConversationUI {
  readonly input = document.createElement('textarea');
  readonly panel = document.createElement('section');
  private content = document.createElement('div');
  private controls = document.createElement('div');
  private timer?: ReturnType<typeof setTimeout>;
  private beats: string[] = []; private beat = 0; private revision = -1;
  private active = false; private speaking = false; private wasActive = false;
  private inputReady = false; private focusRequest = -1;
  private focusFailed = false;
  private copy: HTMLButtonElement;
  constructor(private host: HTMLElement, private bubble: HTMLButtonElement, private adapter: CharacterSurface) {
    this.input.id = 'talk-input'; this.input.rows = 1; this.input.maxLength = 4000;
    this.input.placeholder = 'Talk to Ducky…'; this.input.setAttribute('aria-label', 'Talk to Ducky. Enter sends, Shift Enter adds a line, Escape ends.');
    this.panel.id = 'reading-panel'; this.panel.setAttribute('aria-label', 'Current reply');
    this.content.className = 'reading-content'; this.controls.className = 'reading-controls';
    const button = (label: string, click: () => void) => { const b = document.createElement('button'); b.textContent = label; b.type = 'button'; b.onclick = click; this.controls.append(b); return b; };
    const expand = button('Expand', () => { this.panel.classList.toggle('expanded'); expand.textContent = this.panel.classList.contains('expanded') ? 'Collapse' : 'Expand'; });
    this.copy = button('Copy', () => { void window.ducky.talkCopy().then(() => { this.copy.textContent = 'Copied'; }).catch(() => { this.copy.textContent = 'Copy failed'; }); });
    button('Close', () => { this.panel.hidden = true; window.ducky.talkPanel(false); this.input.focus(); this.stopSpeaking(); });
    this.panel.append(this.controls, this.content); document.body.append(this.panel, this.input);
    this.panel.hidden = true; this.input.hidden = true;
    this.input.addEventListener('input', () => {
      this.input.style.height = 'auto'; this.input.style.height = `${Math.min(76, this.input.scrollHeight)}px`;
      this.stopSpeaking(); this.bubble.hidden = true; this.panel.hidden = true;
      window.ducky.talkTyping();
    });
    this.input.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault(); const text = this.input.value.trim(); if (!text) return;
        this.input.value = ''; this.input.style.height = ''; this.stopSpeaking(); this.bubble.hidden = true; this.panel.hidden = true;
        void window.ducky.talkSend(text).catch(() => { if (this.active) { this.bubble.textContent = 'Couldn’t send that. Try again?'; this.bubble.hidden = false; } });
      }
    });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && this.active) { event.preventDefault(); void window.ducky.talkEnd(); } });
  }
  hit(element: Element | null): boolean { return !!element && ((!this.input.hidden && this.input.contains(element)) || (!this.panel.hidden && this.panel.contains(element))); }
  clickToType(): boolean {
    if (!this.active || !this.focusFailed || this.inputReady) return false;
    window.ducky.doubleClick(); return true;
  }
  private stopSpeaking(): void { clearTimeout(this.timer); this.timer = undefined; this.speaking = false; this.adapter.setTalking(false); }
  private showBeat(): void {
    clearTimeout(this.timer);
    const text = this.beats[this.beat]; if (!text) { this.stopSpeaking(); return; }
    this.bubble.hidden = false; this.bubble.textContent = text + (this.beat < this.beats.length - 1 ? ' …' : '');
    this.speaking = true; this.adapter.setTalking(true);
    this.timer = setTimeout(() => { if (this.beat < this.beats.length - 1) { this.beat++; this.showBeat(); } else this.stopSpeaking(); }, readingTime(text));
  }
  advance(): boolean {
    if (!this.active && !this.wasActive) return false;
    if (this.beat < this.beats.length - 1) { this.beat++; this.showBeat(); }
    else { this.stopSpeaking(); this.bubble.hidden = true; }
    return true;
  }
  render(state: CompanionState): boolean {
    const view = state.conversation; this.active = view?.active ?? false;
    const owns = this.active || !!view?.reply || view?.state === 'conversation_end';
    this.adapter.setConversationState(view?.state ?? null);
    document.body.classList.toggle('conversing', owns);
    if (view?.layout && owns) {
      const l = view.layout;
      Object.assign(this.host.style, { inset: 'auto', left: `${l.x}px`, top: `${l.y}px`, width: `${l.width}px`, height: `${l.height}px` });
      document.body.style.setProperty('--response-left', `${l.contentX}px`);
      document.body.style.setProperty('--response-bottom', `${l.contentBottom}px`);
      document.body.style.setProperty('--response-width', `${l.contentWidth}px`);
      document.body.style.setProperty('--response-height', `${l.contentHeight}px`);
    } else this.host.removeAttribute('style');
    this.input.classList.toggle('ending', !this.active);
    const ready = this.active && view?.inputReady === true;
    const focusFailed = this.active && view?.focusFailed === true;
    if (focusFailed !== this.focusFailed) this.revision = -1;
    this.focusFailed = focusFailed;
    if (ready && !this.inputReady) this.revision = -1;
    this.inputReady = ready; this.input.disabled = !ready;
    if (this.active) {
      this.input.hidden = !ready;
      if (!this.wasActive) this.input.value = '';
      if (ready && this.focusRequest !== view?.focusRequest) {
        this.focusRequest = view?.focusRequest ?? 0;
        requestAnimationFrame(() => { if (this.inputReady) this.input.focus(); });
      }
    }
    else if (this.wasActive) { this.input.value = ''; setTimeout(() => { if (!this.active) this.input.hidden = true; }, 180); }
    if (view && view.revision !== this.revision) {
      this.revision = view.revision; this.stopSpeaking(); this.beats = []; this.beat = 0;
      this.bubble.hidden = true; this.panel.hidden = true;
      if (view.reply) {
        const reply = guardedReply(view.reply);
        if (!view.forceBubble && needsReadingPanel(reply)) {
          renderMarkdown(this.content, reply); this.content.scrollTop = 0; this.panel.hidden = false; this.panel.classList.remove('expanded'); this.copy.textContent = 'Copy';
        } else {
          this.beats = view.forceBubble ? [reply] : splitBeats(reply); this.showBeat();
          if (view.state === 'thinking' || view.state === 'listening') this.stopSpeaking();
        }
      }
    }
    if (!owns) { this.stopSpeaking(); this.panel.hidden = true; this.bubble.hidden = true; this.bubble.textContent = ''; }
    else this.adapter.setTalking(this.speaking);
    if (this.active && focusFailed && !ready) {
      this.stopSpeaking(); this.panel.hidden = true; this.bubble.hidden = false; this.bubble.textContent = 'Click me to type.';
    }
    this.wasActive = this.active; return owns;
  }
  dispose(): void { clearTimeout(this.timer); }
}
