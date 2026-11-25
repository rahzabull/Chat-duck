import { ANIMATION_IDS, EMOTION_IDS, type CharacterSurface } from '../adapter';
import './style.css';

/** SVG DOM, timers and hit-shape knowledge are confined to this adapter. */
export class PlaceholderDuck implements CharacterSurface {
  private root: SVGSVGElement;
  private pupils: NodeListOf<SVGCircleElement>;
  private listeners = new Set<(animation: string) => void>();
  private blinkTimer?: ReturnType<typeof setTimeout>;
  private blinkEnd?: ReturnType<typeof setTimeout>;
  private completion?: ReturnType<typeof setTimeout>;
  private breathTimer?: ReturnType<typeof setTimeout>;
  private breathPose = 0;
  private visible = true;
  private paused = false;
  private sleeping = false;
  private reduced = false;
  private disposed = false;
  private animation = 'idle';
  private direction: 'left' | 'right' = 'right';
  constructor(private host: HTMLElement) {
    host.innerHTML = `<svg class="duck" viewBox="0 0 320 300" xmlns="http://www.w3.org/2000/svg" aria-label="Ducky, a yellow duck in a green hat" role="img">
      <g class="direction"><g class="body-motion">
        <g class="feet"><ellipse data-duck-hit class="foot left-foot" cx="135" cy="290" rx="21" ry="9" fill="#f3932b"/><ellipse data-duck-hit class="foot right-foot" cx="183" cy="290" rx="21" ry="9" fill="#f3932b"/></g>
        <ellipse data-duck-hit class="body" cx="158" cy="250" rx="60" ry="41" fill="#ffd544"/>
        <g transform="rotate(-20 113 246)"><ellipse data-duck-hit class="wing wing-left" cx="113" cy="246" rx="15" ry="28" fill="#efb930"/></g>
        <g transform="rotate(20 201 245)"><ellipse data-duck-hit class="wing wing-right" cx="201" cy="245" rx="15" ry="26" fill="#efb930"/></g>
        <g class="head"><ellipse data-duck-hit cx="159" cy="204" rx="47" ry="42" fill="#ffdf54"/>
          <g class="eyes"><ellipse cx="144" cy="199" rx="14" ry="18" fill="#fffdf2"/><ellipse cx="177" cy="199" rx="14" ry="18" fill="#fffdf2"/>
            <circle class="pupil" cx="145" cy="201" r="6" fill="#282b25"/><circle class="pupil" cx="178" cy="201" r="6" fill="#282b25"/>
            <circle cx="147" cy="198" r="2" fill="white"/><circle cx="180" cy="198" r="2" fill="white"/>
          </g>
          <g class="closed-eyes" fill="none" stroke="#383a2c" stroke-width="3" stroke-linecap="round"><path d="M132 201q12 9 24 0"/><path d="M165 201q12 9 24 0"/></g>
          <g class="brows" stroke="#65531b" stroke-width="3" stroke-linecap="round"><path class="brow-left" d="M134 180l19 0"/><path class="brow-right" d="M167 180l19 0"/></g>
          <ellipse data-duck-hit class="beak-bottom" cx="168" cy="224" rx="23" ry="8" fill="#d87524"/>
          <ellipse data-duck-hit cx="168" cy="217" rx="25" ry="9" fill="#ff9a32"/>
          <g class="hat" fill="#318453"><path data-duck-hit d="M130 172l7-29q22-12 43 0l7 29Z"/><ellipse data-duck-hit cx="158" cy="172" rx="43" ry="8" fill="#246c44"/><path d="M135 158q23 7 47 0" fill="none" stroke="#9ac675" stroke-width="5"/></g>
        </g>
      </g></g>
      <g class="zzz" fill="#385d4b" font-family="sans-serif" font-weight="bold"><text x="218" y="170" font-size="18">z</text><text x="238" y="148" font-size="23">z</text></g>
    </svg>`;
    this.root = host.querySelector('svg')!; this.pupils = this.root.querySelectorAll('.pupil');
    this.root.dataset.animation = 'idle'; this.scheduleBlink(); this.scheduleBreath();
  }
  play(animation: string): void {
    if (!(ANIMATION_IDS as readonly string[]).includes(animation)) return;
    if (this.animation === animation) {
      this.root.dataset.animation = '';
      // A repeated discrete reaction should restart without resetting on every state update.
      void this.root.getBoundingClientRect();
    }
    this.animation = animation; this.root.dataset.animation = animation;
    this.stopBreath(); this.scheduleBreath();
    if (this.completion) clearTimeout(this.completion); this.completion = undefined;
    const durations: Record<string, number> = { blink: 150, startled: 650, landing: 430, waking_up: 900, angry: 750, happy: 750, look_left: 1500, look_right: 1500 };
    if (durations[animation] && this.visible && !this.paused) this.completion = setTimeout(() => {
      this.completion = undefined; this.listeners.forEach(callback => callback(animation));
    }, durations[animation]);
  }
  setEmotion(emotion: string): void { if ((EMOTION_IDS as readonly string[]).includes(emotion)) this.root.dataset.emotion = emotion; }
  setEyeTarget(x: number, y: number): void {
    if (this.sleeping || this.paused) return;
    const rect = this.host.getBoundingClientRect(); const scale = rect.width / 320;
    let dx = (x - rect.left) / scale - 160; const dy = (y - rect.top) / scale - 199;
    if (this.direction === 'left') dx = -dx;
    const magnitude = Math.max(1, Math.hypot(dx, dy)); const distance = Math.min(5, magnitude / 45);
    this.pupils.forEach(pupil => pupil.setAttribute('transform', `translate(${dx / magnitude * distance} ${dy / magnitude * distance})`));
  }
  setDirection(direction: 'left' | 'right'): void { this.direction = direction; this.root.dataset.direction = direction; }
  setMovementSpeed(speed: number): void { this.root.style.setProperty('--step-time', `${Math.max(0.25, 0.55 * 42 / Math.max(1, speed))}s`); }
  setDragging(active: boolean): void { this.root.classList.toggle('dragging', active); }
  setSleeping(active: boolean): void {
    if (this.sleeping === active) return;
    this.sleeping = active; this.root.classList.toggle('sleeping', active);
    if (active) this.stopBlink(); else this.scheduleBlink();
  }
  setVisible(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible; this.root.classList.toggle('hidden', !visible);
    if (visible) { this.scheduleBlink(); this.scheduleBreath(); } else this.stopTimers();
  }
  setPaused(active: boolean): void {
    if (this.paused === active) return;
    this.paused = active; this.root.classList.toggle('paused', active);
    if (active) this.stopTimers(); else { this.scheduleBlink(); this.scheduleBreath(); }
  }
  setReducedMotion(active: boolean): void {
    if (this.reduced === active) return;
    this.reduced = active; this.root.classList.toggle('reduced', active);
    if (active) this.stopBreath(); else this.scheduleBreath();
  }
  setTalking(active: boolean): void { this.root.classList.toggle('talking', active); }
  setDebugHitbox(active: boolean): void { this.root.classList.toggle('debug-hitbox', active); }
  hitTest(x: number, y: number): boolean {
    const element = document.elementFromPoint(x, y);
    return !!element && this.root.contains(element) && !!element.closest('[data-duck-hit]');
  }
  onAnimationComplete(cb: (animation: string) => void): () => void { this.listeners.add(cb); return () => { this.listeners.delete(cb); }; }
  private scheduleBreath(): void {
    if (this.breathTimer || this.disposed || !this.visible || this.paused || this.reduced ||
      !['idle', 'look_left', 'look_right', 'sleeping'].includes(this.animation)) return;
    // Four discrete poses per cycle, then eight seconds with no ambient updates.
    // No CSS animation/transition keeps Chromium compositing between these poses.
    this.breathTimer = setTimeout(() => {
      this.breathTimer = undefined; this.breathPose = (this.breathPose + 1) % 4;
      this.root.dataset.breath = String([0, 1, 2, 1][this.breathPose]);
      this.scheduleBreath();
    }, this.breathPose === 0 ? 8000 : 400);
  }
  private stopBreath(): void {
    if (this.breathTimer) clearTimeout(this.breathTimer);
    this.breathTimer = undefined; this.breathPose = 0; delete this.root.dataset.breath;
  }
  private scheduleBlink(): void {
    if (this.blinkTimer || this.disposed || !this.visible || this.paused || this.sleeping) return;
    this.blinkTimer = setTimeout(() => {
      this.blinkTimer = undefined; this.root.classList.add('blinking');
      this.blinkEnd = setTimeout(() => {
        this.root.classList.remove('blinking'); this.blinkEnd = undefined;
        if (!this.reduced && Math.random() < 0.18) {
          this.blinkEnd = setTimeout(() => {
            this.root.classList.add('blinking');
            this.blinkEnd = setTimeout(() => { this.root.classList.remove('blinking'); this.blinkEnd = undefined; this.scheduleBlink(); }, 120);
          }, 130);
        } else this.scheduleBlink();
      }, 130);
    }, 2000 + Math.random() * 4000);
  }
  private stopBlink(): void {
    if (this.blinkTimer) clearTimeout(this.blinkTimer); if (this.blinkEnd) clearTimeout(this.blinkEnd);
    this.blinkTimer = undefined; this.blinkEnd = undefined; this.root.classList.remove('blinking');
  }
  private stopTimers(): void { this.stopBlink(); this.stopBreath(); if (this.completion) clearTimeout(this.completion); this.completion = undefined; }
  dispose(): void { this.disposed = true; this.stopTimers(); this.listeners.clear(); this.host.replaceChildren(); }
}
