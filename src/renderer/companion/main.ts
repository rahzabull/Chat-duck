import { ProactiveUI } from './proactive';
import { ConversationUI } from './conversation';
import { ProductivityUI } from './productivity';
import { guardedReply } from '../../core/conversation/output';
import { PlaceholderDuck } from '../../animation/placeholder';
import { FigmaDuck } from '../../animation/figma';
import type { CharacterSurface } from '../../animation/adapter';
import type { CompanionState, CursorUpdate } from '../../shared/types';
import './style.css';

const host = document.getElementById('character')!;
const bubble = document.getElementById('bubble') as HTMLButtonElement;
const adapter: CharacterSurface = window.ducky.placeholderDuck ? new PlaceholderDuck(host) : new FigmaDuck(host);
const api = window.ducky;
const conversation = new ConversationUI(host, bubble, adapter);
const productivity = new ProductivityUI(host);
const proactive = new ProactiveUI();
const reducedPreference = matchMedia('(prefers-reduced-motion: reduce)');
let state: CompanionState | undefined;
let captured: number | undefined;
let interactive = false;
let hovering = false;
let lastPointer = { x: -1, y: -1 };
let lastCursor: CursorUpdate | undefined;
let finishing = false;

function reportHit(x: number, y: number, force = false): void {
  lastPointer = { x, y };
  const duck = adapter.hitTest(x, y);
  const element = document.elementFromPoint(x, y);
  const onBubble = !bubble.hidden && !!element && bubble.contains(element);
  const hit = captured !== undefined || duck || onBubble || conversation.hit(element) || productivity.hit(element) || proactive.hit(element);
  if (force || hit !== interactive) { interactive = hit; api.hitTest(hit); }
  if (hovering !== duck) { hovering = duck; api.hover(duck); }
}
function render(next: CompanionState): void {
  const previous = state;
  const wasDragging = state?.dragging;
  state = next;
  // Visible but in-character indicator (brief §9: no hidden capture): reading glasses while screen awareness is on.
  adapter.setSpecs(!!next.screenAwarenessActive);
  if (previous && previous.captureRevision !== next.captureRevision && !next.settings.reducedMotion && !reducedPreference.matches) adapter.glint();
  adapter.setReducedMotion(next.settings.reducedMotion || reducedPreference.matches);
  document.body.classList.toggle('reduced', next.settings.reducedMotion || reducedPreference.matches);
  adapter.setVisible(next.visible && !(next.gaming && next.settings.gamingBehaviour === 'hide')); adapter.setPaused(!!next.gaming || next.paused && !next.conversation?.active);
  document.body.classList.toggle('gaming', !!next.gaming);
  adapter.setSleeping(next.sleeping && !next.paused); adapter.setDragging(next.dragging);
  adapter.setEmotion(next.emotion); adapter.setDirection(next.direction);
  adapter.setMovementSpeed(next.movementSpeed); adapter.setDebugHitbox(next.debugHitbox);
  if (!previous || previous.animationRevision !== next.animationRevision) adapter.play(next.animation);
  const conversing = conversation.render(next);
  productivity.render(next); proactive.render(next);
  if (!conversing) adapter.setTalking(!!next.bubble); adapter.setSunglasses(next.sunglasses);
  if (!conversing) bubble.textContent = guardedReply(next.bubble ?? '');
  if (!conversing) bubble.hidden = !next.bubble; bubble.classList.toggle('debug', next.debugHitbox);
  if (next.dnd || next.gaming) bubble.hidden = true;
  if (next.productivitySpeech && !next.gaming && (!next.dnd || next.settings.dndReminders === 'bubble')) { bubble.textContent = next.productivitySpeech; bubble.hidden = false; }
  if (lastCursor) adapter.setEyeTarget(lastCursor.cursor.x - lastCursor.origin.x, lastCursor.cursor.y - lastCursor.origin.y);
  if (((wasDragging && !next.dragging) || !next.visible || next.paused) && captured !== undefined) releaseCapture();
  reportHit(lastPointer.x, lastPointer.y, wasDragging !== next.dragging);
}
function releaseCapture(): void {
  const pointer = captured; captured = undefined;
  if (pointer !== undefined && host.hasPointerCapture(pointer)) host.releasePointerCapture(pointer);
}
async function finishDrag(): Promise<void> {
  if (captured === undefined || finishing) return;
  finishing = true; releaseCapture();
  try { await api.dragEnd(); }
  catch (error) { console.error('Ducky drag end failed', error); }
  finally { finishing = false; reportHit(lastPointer.x, lastPointer.y, true); }
}
document.addEventListener('mousemove', event => reportHit(event.clientX, event.clientY));
document.addEventListener('mouseleave', () => { if (captured === undefined) reportHit(-1, -1); });
host.addEventListener('pointerdown', event => {
  if (event.button === 0 && adapter.hitTest(event.clientX, event.clientY) && conversation.clickToType()) { event.preventDefault(); return; }
  if (event.button !== 0 || captured !== undefined || state?.paused || state?.gaming || state?.dnd || !adapter.hitTest(event.clientX, event.clientY)) return;
  event.preventDefault(); captured = event.pointerId;
  host.setPointerCapture(event.pointerId); api.hitTest(true); interactive = true;
  void api.dragStart({ x: event.clientX, y: event.clientY }).catch(error => { console.error('Ducky drag start failed', error); releaseCapture(); });
});
host.addEventListener('pointerup', () => { void finishDrag(); });
host.addEventListener('pointercancel', () => { void finishDrag(); });
host.addEventListener('lostpointercapture', () => { void finishDrag(); });
window.addEventListener('blur', () => { void finishDrag(); });
host.addEventListener('dblclick', event => {
  if (!adapter.hitTest(event.clientX, event.clientY)) return;
  event.preventDefault(); api.doubleClick();
});
document.addEventListener('contextmenu', event => {
  event.preventDefault(); if (adapter.hitTest(event.clientX, event.clientY)) api.contextMenu();
});
bubble.addEventListener('pointerdown', event => event.stopPropagation());
bubble.addEventListener('click', () => { if (!conversation.clickToType() && !conversation.advance()) api.dismissBubble(); });
const unsubscribeState = api.onState(render);
const unsubscribeCursor = api.onCursor(update => {
  lastCursor = update;
  adapter.setMotionPosition?.(update.origin.x, update.origin.y);
  const x = update.cursor.x - update.origin.x; const y = update.cursor.y - update.origin.y;
  adapter.setEyeTarget(x, y); reportHit(x, y);
});
const unsubscribePosition = api.onPosition(origin => {
  adapter.setMotionPosition?.(origin.x, origin.y);
  if (!lastCursor) return;
  lastCursor = { ...lastCursor, origin };
  const x = lastCursor.cursor.x - origin.x; const y = lastCursor.cursor.y - origin.y;
  adapter.setEyeTarget(x, y); reportHit(x, y);
});
const unsubscribeCompletion = adapter.onAnimationComplete(animation => api.animationComplete(animation));
function preferenceChanged(): void { if (state) render(state); }
reducedPreference.addEventListener('change', preferenceChanged);
void api.getState().then(render).catch(error => console.error('Ducky initialization failed', error));
window.addEventListener('beforeunload', () => {
  unsubscribeState(); unsubscribeCursor(); unsubscribePosition(); unsubscribeCompletion();
  reducedPreference.removeEventListener('change', preferenceChanged); conversation.dispose(); productivity.dispose(); adapter.dispose();
});
