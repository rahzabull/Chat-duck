import { ACTIVITY_DURATION } from '../../core/behaviour';
import type { CharacterSurface, ConversationState } from '../adapter';
import { poseAssets } from '../../../assets/characters/ducky/assets.generated';
import parts from '../../../assets/characters/ducky/parts.json';
import { ACTIVITY_POSES, CONVERSATION_POSES, EMOTION_POSES, EXTRA_NAMES, dragPose } from './poses';
import { PROPS } from './props';
import './style.css';

const NS = 'http://www.w3.org/2000/svg';
const durations: Record<string, number | undefined> = { ...ACTIVITY_DURATION, sunglasses: 2000, alarm: 3000, celebrate: 1200,
  blink: 120, startled: 650, landing: 430, waking_up: 900, angry: 750, happy: 750, look_left: 1500, look_right: 1500,
  shrug: 1500, laughing: 1600, confused: 1800 };
const metadata = parts as Record<string, { blink: boolean }>;

/** The only owner of Rahul's character DOM. All timers are discrete and lifecycle-scoped. */
export class FigmaDuck implements CharacterSurface {
  private root: SVGSVGElement;
  private directionGroup: SVGGElement;
  private fit: SVGGElement;
  private propRoot: SVGSVGElement;
  private listeners = new Set<(animation: string) => void>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private animation = 'idle'; private emotion = 'neutral'; private conversation: ConversationState | null = null;
  private pose = ''; private direction: 'left' | 'right' = 'right';
  private visible = true; private paused = false; private reduced = false; private disposed = false;
  private sleeping = false; private dragging = false; private talking = false; private sunglasses = false;
  private sleepAt = 0; private dragAt = 0; private pickups: number[] = []; private dragVariant = 'dragged_up_down';
  private phase = 0; private breath = 0; private landing: 'fallen_a' | 'fallen_b' | null = null;
  private position?: { x: number; y: number }; private fallTop?: number; private fallDistance = 0;
  private eyeTarget?: { x: number; y: number };

  constructor(private host: HTMLElement) {
    // Only our own fixed markup and Vite ?raw build assets ever enter innerHTML.
    host.innerHTML = `<svg class="figma-duck" viewBox="0 0 320 300" xmlns="${NS}" role="img" aria-label="Ducky, Rahul's yellow duck"><g class="figma-direction"><g class="figma-motion"><g class="figma-fit"></g></g></g></svg>${PROPS}`;
    this.root = host.querySelector('.figma-duck')!; this.directionGroup = this.root.querySelector('.figma-direction')!;
    this.fit = this.root.querySelector('.figma-fit')!;
    this.propRoot = host.querySelector('.figma-props')!;
    this.refresh();
  }
  private get active(): boolean { return this.visible && !this.paused && !this.disposed; }
  private get asleep(): boolean { return this.sleeping || ['sleeping', 'nap'].includes(this.animation); }
  private get thinking(): boolean { return this.conversation === 'thinking' || ['thinking', 'thought'].includes(this.animation); }
  private get canBlink(): boolean { return metadata[this.pose]?.blink ?? this.fit.querySelectorAll('.eye-blink').length === 2; }
  private later(name: string, delay: number, fn: () => void): void {
    if (this.timers.has(name) || !this.active) return;
    this.timers.set(name, setTimeout(() => { this.timers.delete(name); if (this.active) fn(); }, delay));
  }
  private cancel(name: string): void { clearTimeout(this.timers.get(name)); this.timers.delete(name); }
  private stopTimers(): void {
    this.timers.forEach(clearTimeout); this.timers.clear(); this.breath = 0;
    this.root.classList.remove('blinking'); this.root.removeAttribute('data-breath');
  }
  private selection(): { pose: string; activity: string } {
    if (this.paused) return { pose: 'idle', activity: 'idle' };
    if (this.dragging) return { pose: Date.now() - this.dragAt >= 3000 || this.pickups.length >= 3 ? 'dragged_disgusted' : this.dragVariant, activity: 'picked_up' };
    if (this.landing) return { pose: this.landing, activity: 'landing' };
    if (this.animation === 'falling') return { pose: 'dragged_up_down', activity: 'falling' };
    if (this.asleep) return { pose: Date.now() - this.sleepAt >= 60000 ? (this.phase % 2 ? 'deep_sleep_b' : 'deep_sleep_a') : 'sleepy', activity: 'sleeping' };
    if (this.conversation) return { pose: this.thinking ? (this.phase % 2 ? 'thinking_b' : 'thinking_a') : CONVERSATION_POSES[this.conversation], activity: this.conversation };
    if (this.thinking) return { pose: this.phase % 2 ? 'thinking_b' : 'thinking_a', activity: this.animation };
    return { pose: this.animation === 'idle' ? EMOTION_POSES[this.emotion] : ACTIVITY_POSES[this.animation] ?? 'idle', activity: this.animation };
  }
  private refresh(): void {
    if (this.disposed) return;
    const selected = this.selection();
    const extraName = EXTRA_NAMES[selected.activity] ?? selected.activity;
    const extra = !this.paused && !this.dragging && !this.landing && !this.asleep && this.animation !== 'falling'
      ? (poseAssets[`extra:${selected.activity}`] ? `extra:${selected.activity}` : poseAssets[`extra:${extraName}`] ? `extra:${extraName}` : '') : '';
    const pose = extra || selected.pose;
    this.root.dataset.activity = selected.activity; this.root.dataset.emotion = this.emotion;
    this.root.dataset.conversation = selected.activity === this.conversation ? this.conversation : '';
    this.root.classList.toggle('talking', (this.talking || this.animation === 'talking') && !this.asleep && !['thinking', 'listening', 'interrupted'].includes(this.conversation ?? ''));
    this.root.classList.toggle('dragging', this.dragging);
    if (pose !== this.pose) { this.pose = pose; this.mountPose(pose); }
    this.propRoot.querySelectorAll<SVGGElement>('[data-prop]').forEach(g => {
      g.style.display = (g.dataset.prop === 'sunglasses' && this.sunglasses && !this.paused) || (!extra && g.dataset.prop === extraName && !this.paused) ? 'inline' : 'none';
    });
    this.propRoot.dataset.activity = selected.activity;
    this.syncTimers();
  }
  private mountPose(name: string): void {
    this.fit.innerHTML = poseAssets[name] ?? poseAssets.idle;
    const svg = this.fit.querySelector('svg')!;
    const vb = svg.viewBox.baseVal;
    svg.setAttribute('width', String(vb.width)); svg.setAttribute('height', String(vb.height));
    svg.style.overflow = 'visible';
    // Constant source scale across Rahul's poses: fallen ducks lie down, never grow to standing height.
    const scale = name.startsWith('extra:') ? Math.min(160 / Math.max(1, vb.height - 12), 245 / vb.width) : 160 / (parts.idle.viewBox[3] - 12);
    this.fit.setAttribute('transform', `translate(${160 - vb.width * scale / 2} ${300 - (vb.height - 6) * scale}) scale(${scale})`);
    this.root.dataset.pose = name;
    if (name.startsWith('extra:') && !svg.querySelector('[data-duck-hit]')) {
      // Plain future Figma exports work immediately. Palette-colored filled character
      // geometry gets painted hits; detailed part annotations enable motion and finer hits.
      svg.querySelectorAll<SVGGraphicsElement>('path, ellipse, circle, rect, polygon').forEach(shape => {
        const fill = shape.getAttribute('fill')?.toUpperCase();
        if (fill === '#FFC954' || fill === '#F7673B') shape.setAttribute('data-duck-hit', '');
      });
    }
    const head = svg.querySelector<SVGGElement>('g[data-part="head"]');
    const hb = head?.getBBox();
    const beak = svg.querySelector<SVGGElement>('g[data-part="beak"]')?.getBBox();
    // Shared head pivot with separate wrappers preserves the original painter order exactly.
    const cranial = new Set(['head', 'tuft', 'eye-left', 'eye-right', 'eye-arc', 'brow', 'beak', 'nostril', 'extra']);
    svg.querySelectorAll<SVGGElement>('g[data-part]').forEach(group => {
      const part = group.dataset.part!; const b = group.getBBox();
      if (hb && cranial.has(part)) {
        const wrapper = document.createElementNS(NS, 'g'); wrapper.classList.add('cranial');
        group.before(wrapper); wrapper.append(group);
        // This rig pivot must be independent of its child's animated bbox (gaze/mouth).
        // Part groups still use fill-box; only the untransformed rig wrapper uses view-box.
        wrapper.style.transformBox = 'view-box';
        wrapper.style.transformOrigin = `${hb.x + hb.width / 2}px ${hb.y + hb.height}px`;
      }
      if (beak && ['beak', 'nostril'].includes(part)) {
        group.classList.add('mouth'); group.style.transformOrigin = `${beak.x + beak.width / 2 - b.x}px ${beak.y - b.y}px`;
      }
      if (part.startsWith('wing-')) {
        const d = group.querySelector('path[stroke]')?.getAttribute('d') ?? '';
        const n = d.match(/-?\d*\.?\d+/g)?.map(Number);
        if (n && n.length >= 4) group.style.transformOrigin = `${(n[0] + n.at(-2)!) / 2 - b.x}px ${(n[1] + n.at(-1)!) / 2 - b.y}px`;
      }
    });
    this.cancel('blink'); this.cancel('blink-end'); this.root.classList.remove('blinking');
    if (this.eyeTarget) this.setEyeTarget(this.eyeTarget.x, this.eyeTarget.y);
  }
  private syncTimers(): void {
    if (!this.active) return;
    if (!this.asleep && this.canBlink) this.later('blink', 2000 + Math.random() * 4000, () => this.blink());
    else { this.cancel('blink'); this.cancel('blink-end'); this.root.classList.remove('blinking'); }
    const breathing = !this.reduced && !this.conversation && !this.dragging && !this.landing && ['idle', 'sleeping', 'look_left', 'look_right'].includes(this.animation);
    if (breathing) this.later('breath', this.breath === 0 ? 8000 : 400, () => {
      this.breath = (this.breath + 1) % 4; this.root.dataset.breath = String([0, 1, 2, 1][this.breath]); this.syncTimers();
    });
    else { this.cancel('breath'); this.breath = 0; this.root.removeAttribute('data-breath'); }
    // Don't reset this timer on a breath step or an unrelated state update.
    if (!this.asleep) this.cancel('sleep');
    else if (Date.now() - this.sleepAt < 60000) this.later('sleep', 60000 - (Date.now() - this.sleepAt), () => this.refresh());
    else if (this.reduced) this.cancel('sleep');
    else this.later('sleep', 8000, () => { this.phase++; this.refresh(); });
    if (this.thinking && !this.reduced && !this.asleep && !this.dragging) this.later('thinking', 3000, () => { this.phase++; this.refresh(); });
    else this.cancel('thinking');
    if (this.dragging && Date.now() - this.dragAt < 3000) this.later('drag', 3000 - (Date.now() - this.dragAt), () => this.refresh());
    else this.cancel('drag');
  }
  private blink(): void {
    if (!this.canBlink || this.asleep) return;
    this.cancel('blink'); this.root.classList.add('blinking');
    this.later('blink-end', 120, () => { this.root.classList.remove('blinking'); this.syncTimers(); });
  }
  play(animation: string): void {
    if (!Object.hasOwn(ACTIVITY_POSES, animation) && animation !== 'landing' && animation !== 'landing_big') return;
    if (animation === 'blink') {
      if (this.active) { this.blink(); this.cancel('blink-completion'); this.later('blink-completion', 120, () => this.listeners.forEach(cb => cb('blink'))); }
      return;
    }
    // Main's physical landing settles after 430ms. Retain the big-drop visual through get-up.
    if (this.landing && animation === 'idle') return;
    this.cancel('completion'); this.cancel('land-stage'); this.landing = null;
    if (animation === 'falling' && this.animation !== 'falling') { this.fallTop = this.position?.y; this.fallDistance = 0; }
    if (['nap', 'sleeping'].includes(animation) && !this.asleep) this.sleepAt = Date.now();
    this.animation = animation; this.phase = 0;
    this.root.dataset.activity = ''; void this.root.getBoundingClientRect();
    let duration = durations[animation];
    // Main decides the landing type from the real drop height. Big drop: lie flat at once, then get up. Small drop: land standing.
    if (animation === 'landing_big') {
      this.landing = 'fallen_a'; duration = 1600;
      this.later('land-stage', 700, () => { this.landing = 'fallen_b'; this.refresh(); });
    }
    this.refresh();
    if (duration) this.later('completion', duration, () => {
      this.landing = null; this.animation = 'idle'; this.refresh(); this.listeners.forEach(cb => cb(animation));
    });
  }
  setConversationState(state: ConversationState | null): void {
    if (state === this.conversation) return;
    this.conversation = state; this.phase = 0; this.cancel('thinking'); this.refresh();
  }
  setEmotion(emotion: string): void {
    if (!Object.hasOwn(EMOTION_POSES, emotion) || this.emotion === emotion) return;
    this.emotion = emotion; this.refresh();
  }
  setEyeTarget(x: number, y: number): void {
    this.eyeTarget = { x, y }; if (!this.active || this.asleep) return;
    this.fit.querySelectorAll<SVGGElement>('.eye-track').forEach(eye => {
      // Convert through the SVG's full CTM, including mirror, character size and conversation layout.
      const matrix = eye.parentElement && (eye.parentElement as unknown as SVGGraphicsElement).getScreenCTM();
      if (!matrix) return;
      const target = new DOMPoint(x, y).matrixTransform(matrix.inverse()); const b = eye.getBBox();
      const dx = target.x - b.x - b.width / 2, dy = target.y - b.y - b.height / 2;
      const length = Math.max(1, Math.hypot(dx, dy)); const distance = Math.min(3, length / 45);
      eye.style.transform = `translate(${(dx / length * distance).toFixed(2)}px, ${(dy / length * distance).toFixed(2)}px)`;
    });
  }
  setDirection(direction: 'left' | 'right'): void {
    if (direction === this.direction) return; this.direction = direction;
    this.directionGroup.setAttribute('transform', direction === 'left' ? 'translate(320 0) scale(-1 1)' : '');
    this.propRoot.querySelectorAll('.face-prop-direction').forEach(prop => {
      prop.setAttribute('transform', direction === 'left' ? 'translate(320 0) scale(-1 1)' : '');
    });
    if (this.eyeTarget) this.setEyeTarget(this.eyeTarget.x, this.eyeTarget.y);
  }
  setMovementSpeed(speed: number): void { this.root.style.setProperty('--step-time', `${Math.max(.25, .55 * 42 / Math.max(1, speed))}s`); }
  setMotionPosition(x: number, y: number): void {
    if (!Number.isFinite(x + y)) return;
    if (this.position && this.dragging && this.active) {
      const dx = x - this.position.x, dy = y - this.position.y;
      if (Math.hypot(dx, dy) > .5) { const variant = dragPose(dx, dy); if (variant !== this.dragVariant) { this.dragVariant = variant; this.refresh(); } }
    }
    this.position = { x, y };
    if (this.animation === 'falling') { this.fallTop = Math.min(this.fallTop ?? y, y); this.fallDistance = Math.max(this.fallDistance, y - this.fallTop); }
  }
  setDragging(active: boolean): void {
    if (this.dragging === active) return; this.dragging = active;
    if (active) {
      this.dragAt = Date.now(); this.pickups = this.pickups.filter(t => this.dragAt - t < 15000); this.pickups.push(this.dragAt);
      this.dragVariant = 'dragged_up_down'; this.landing = null; this.cancel('completion'); this.cancel('land-stage');
    } else this.cancel('drag');
    this.refresh();
  }
  setSleeping(active: boolean): void {
    if (this.sleeping === active) return;
    if (active && !this.asleep) this.sleepAt = Date.now();
    if (active) {
      this.cancel('completion'); this.cancel('blink-completion'); this.cancel('land-stage'); this.landing = null;
      if (durations[this.animation]) this.animation = 'idle';
    }
    this.sleeping = active; this.refresh();
  }
  setVisible(visible: boolean): void {
    if (this.visible === visible) return; this.visible = visible;
    this.host.classList.toggle('figma-hidden', !visible);
    if (!visible) { this.stopTimers(); this.landing = null; this.animation = 'idle'; }
    this.refresh();
  }
  setPaused(active: boolean): void {
    if (this.paused === active) return; this.paused = active; this.host.classList.toggle('figma-paused', active);
    if (active) { this.stopTimers(); this.landing = null; this.animation = 'idle'; }
    this.refresh();
  }
  setReducedMotion(active: boolean): void {
    if (this.reduced === active) return; this.reduced = active; this.host.classList.toggle('figma-reduced', active); this.syncTimers();
  }
  setTalking(active: boolean): void { if (this.talking !== active) { this.talking = active; this.refresh(); } }
  setSunglasses(active: boolean): void { if (this.sunglasses !== active) { this.sunglasses = active; this.refresh(); } }
  setDebugHitbox(active: boolean): void { this.root.classList.toggle('debug-hitbox', active); }
  hitTest(x: number, y: number): boolean {
    if (!this.visible || this.disposed) return false;
    const element = document.elementFromPoint(x, y);
    return !!element && this.root.contains(element) && !!element.closest('[data-duck-hit]');
  }
  onAnimationComplete(cb: (animation: string) => void): () => void { this.listeners.add(cb); return () => { this.listeners.delete(cb); }; }
  dispose(): void {
    this.disposed = true; this.stopTimers(); this.listeners.clear(); this.host.replaceChildren();
    this.host.classList.remove('figma-hidden', 'figma-paused', 'figma-reduced');
  }
}
