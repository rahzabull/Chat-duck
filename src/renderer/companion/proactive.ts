import type { CompanionState } from '../../shared/types';
import { closeButton } from '../shared/close';

export class ProactiveUI {
  private badge = document.createElement('span');
  private card = document.createElement('section');
  private detail = document.createElement('p');
  private accept = document.createElement('button');
  private later = document.createElement('button');
  constructor() {
    this.badge.id = 'mode-badge'; this.badge.setAttribute('role', 'status');
    this.card.id = 'proactive-actions'; this.card.setAttribute('aria-label', 'Ducky suggestion');
    this.accept.type = this.later.type = 'button';
    this.accept.onclick = () => { void window.ducky.command('proactive-accept'); };
    this.later.onclick = () => { void window.ducky.command('proactive-later'); };
    const header = document.createElement('header'); const title = document.createElement('strong'); title.textContent = 'Ducky';
    header.append(title, closeButton(() => { void window.ducky.command('proactive-later'); }));
    this.card.append(header, this.detail, this.accept, this.later); this.card.hidden = true; this.badge.hidden = true;
    document.body.append(this.badge, this.card);
  }
  render(state: CompanionState): void {
    this.badge.textContent = [state.dnd ? '☾ Do not disturb' : '', state.settings.privacyMode ? '◐ Privacy mode' : ''].filter(Boolean).join(' · ');
    this.badge.setAttribute('aria-label', [state.dnd ? 'Do not disturb' : '', state.settings.privacyMode ? 'Privacy mode' : ''].filter(Boolean).join(', '));
    this.badge.hidden = !this.badge.textContent || !state.visible || !!state.gaming;
    const view = state.proactive;
    this.card.hidden = !view || !state.bubble || !!state.dnd || !!state.gaming;
    if (!view) return;
    this.detail.textContent = view.detail ?? ''; this.detail.hidden = !view.detail;
    this.accept.textContent = view.label; this.later.textContent = view.dismissLabel;
  }
  hit(element: Element | null): boolean { return !this.card.hidden && !!element && this.card.contains(element); }
}
