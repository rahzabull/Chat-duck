import { app, BrowserWindow, powerMonitor, screen, systemPreferences } from 'electron';
import { BehaviourScheduler } from '../../core/behaviour';
import { DialoguePool, type DialogueCategory } from '../../core/dialogue';
import { EventBus } from '../../core/events';
import { SpeechQueue, type Priority } from '../../core/interruptions';
import { clampPosition, contains, createBody, groundY, moving, nearestArea, recover, release, resetPosition, step, VelocityHistory, walk, windowOrigin, type Body } from '../../core/physics';
import { CHANNELS, WINDOW } from '../../shared/constants';
import type { CompanionState, EditableSettings, Point } from '../../shared/types';
import { CursorPoller } from '../platform/cursor';
import { primaryArea, workAreas } from '../platform/displays';
import type { SettingsStore } from '../settings/store';

export class CompanionController {
  readonly events = new EventBus();
  private body: Body;
  private scheduler = new BehaviourScheduler();
  private dialogue = new DialoguePool();
  private speech = new SpeechQueue();
  private velocity = new VelocityHistory();
  private cursor: CursorPoller;
  private motionTimer?: ReturnType<typeof setInterval>;
  private behaviourTimer?: ReturnType<typeof setInterval>;
  private idleTimer?: ReturnType<typeof setInterval>;
  private reactionTimer?: ReturnType<typeof setTimeout>;
  private bubbleTimer?: ReturnType<typeof setTimeout>;
  private clickTimer?: ReturnType<typeof setTimeout>;
  private clickTimes: number[] = [];
  private pendingClicks = 0;
  private hovered = false;
  private grab?: { cursor: Point; offset: Point; moved: boolean };
  private reducedMotion = systemPreferences.getAnimationSettings().prefersReducedMotion;
  private lastMotion = 0;
  private ready = false;
  private disposed = false;
  state: CompanionState;
  onChanged: () => void = () => {};

  constructor(readonly window: BrowserWindow, readonly store: SettingsStore, private broadcast: (state: CompanionState) => void) {
    this.state = { visible: true, paused: false, sleeping: false, dragging: false, animation: 'idle', animationRevision: 0, emotion: 'neutral',
      direction: 'right', movementSpeed: 0, bubble: null, settings: store.value,
      debugHitbox: process.argv.includes('--debug-hitbox'), version: app.getVersion() };
    const saved = store.value.position;
    this.body = saved && workAreas().some(area => contains(saved, area))
      ? createBody(clampPosition(saved, workAreas(), this.size())) : resetPosition(primaryArea(), this.size());
    this.body.grounded = this.body.y === groundY(nearestArea(this.body, workAreas()));
    this.cursor = new CursorPoller(point => {
      if (this.ready && !window.isDestroyed()) window.webContents.send(CHANNELS.cursor, { cursor: point, origin: this.windowOrigin() });
    }, point => this.dragSample(point), () => ({ ...this.windowOrigin(), ...this.size() }));
    this.events.on('CHARACTER_CLICKED', ({ count }) => {
      console.log('[ducky] Click count in four seconds:', count);
      this.react(count >= 5 ? 'angry' : 'startled', count >= 3 ? 'angry' : 'startled');
      if (count >= 5) this.sayCategory('annoyed', 'medium');
      else if (Math.random() < this.speechChance()) this.sayCategory('click', 'medium');
    });
    this.events.on('CHARACTER_PICKED_UP', () => {
      this.setAnimation('picked_up');
      if (Math.random() < this.speechChance()) this.sayCategory('dragged', 'medium');
    });
    this.events.on('CHARACTER_LANDED', () => {
      this.react('landing', 'neutral', 430);
      if (Math.random() < this.speechChance() * 0.5) this.sayCategory('landing', 'low');
    });
    this.events.on('USER_BECAME_IDLE', () => { this.state.sleeping = true; this.body.walking = false; this.body.vx = 0; this.setAnimation('sleeping'); this.dismissBubble(); });
    this.events.on('USER_RETURNED', () => { this.state.sleeping = false; this.react('waking_up', 'happy', 900); if (Math.random() < 0.5) this.sayCategory('greeting', 'low'); });
    window.once('ready-to-show', () => {
      this.ready = true; this.applyWindowSettings(); this.moveWindow();
      if (this.state.visible) window.showInactive();
      this.publish(); this.configureTimers(); this.events.emit('APP_STARTED', undefined);
      if (!this.store.value.firstLaunchDone) {
        this.say('Hello. I live here now.', 'high'); this.store.update({ firstLaunchDone: true }); this.state.settings = this.store.value;
      }
      console.log('[ducky] Companion ready', this.windowOrigin());
    });
    window.on('blur', () => this.endDrag(false));
    window.on('hide', () => { if (this.state.visible && !this.disposed) this.setVisible(false); });
    window.webContents.on('render-process-gone', (_event, details) => {
      console.error('[ducky] Companion renderer exited', details.reason);
      this.setVisible(false);
    });
  }
  private size() { return { width: Math.round(WINDOW.width * this.store.value.characterSize), height: Math.round(WINDOW.height * this.store.value.characterSize) }; }
  private windowOrigin(): Point { return windowOrigin(this.body, this.size()); }
  private moveWindow(): void {
    if (this.window.isDestroyed()) return;
    this.window.setBounds({ ...this.windowOrigin(), ...this.size() }, false);
    if (this.ready) this.window.webContents.send(CHANNELS.position, this.windowOrigin());
  }
  private savePosition(): void { this.store.update({ position: { x: this.body.x, y: this.body.y } }); this.state.settings = this.store.value; }
  private publish(): void { if (this.ready && !this.disposed) { this.broadcast(this.state); this.onChanged(); } }
  private setAnimation(animation: string, restart = false): void {
    const speed = this.body.walking ? Math.abs(this.body.vx) : 0;
    if (!restart && this.state.animation === animation && this.state.direction === this.body.direction && this.state.movementSpeed === speed) return;
    const changed = this.state.animation !== animation;
    this.state.animation = animation; this.state.direction = this.body.direction;
    if (changed || restart) this.state.animationRevision++;
    this.state.movementSpeed = speed;
    if (changed) console.log('[ducky] Animation:', animation);
    this.publish();
  }
  private baseAnimation(): string { return this.state.sleeping ? 'sleeping' : this.state.dragging ? 'picked_up' : !this.body.grounded ? 'falling' : this.body.walking ? 'walking' : 'idle'; }
  private react(animation: string, emotion: string, duration = 750): void {
    if (this.reactionTimer) clearTimeout(this.reactionTimer);
    this.state.emotion = emotion; this.setAnimation(animation, true);
    this.reactionTimer = setTimeout(() => {
      this.reactionTimer = undefined; this.state.emotion = this.hovered ? 'suspicious' : 'neutral'; this.setAnimation(this.baseAnimation());
    }, duration);
  }
  animationComplete(animation: string): void { this.events.emit('ANIMATION_COMPLETED', { animation }); }
  private speechChance(): number { return this.store.value.talkativeness === 'quiet' ? 0.12 : this.store.value.talkativeness === 'chatty' ? 0.65 : 0.35; }
  private sayCategory(category: DialogueCategory, priority: Priority): void { this.say(this.dialogue.pick(category), priority); }
  private say(text: string, priority: Priority): void {
    const area = nearestArea(this.body, workAreas());
    const tooHigh = this.windowOrigin().y <= area.y + 20;
    if (!this.speech.offer(text, priority, { muted: this.store.value.mute,
      blocked: !this.state.visible || this.state.paused || this.state.sleeping || tooHigh,
      cooldownMs: this.store.value.talkativeness === 'quiet' ? 15000 : this.store.value.talkativeness === 'chatty' ? 2500 : 6500 })) return;
    this.state.bubble = this.speech.current!.text; this.publish();
    if (this.bubbleTimer) clearTimeout(this.bubbleTimer);
    this.bubbleTimer = setTimeout(() => this.dismissBubble(), this.speech.current!.expiresAt - Date.now());
  }
  dismissBubble(): void {
    if (this.bubbleTimer) clearTimeout(this.bubbleTimer); this.bubbleTimer = undefined;
    this.speech.dismiss(); this.state.bubble = null; this.publish();
  }
  hover(active: boolean): void {
    this.hovered = active;
    if (this.state.paused || this.state.sleeping || this.state.dragging || this.reactionTimer) return;
    this.events.emit('CHARACTER_HOVERED', { active }); this.state.emotion = active ? 'suspicious' : 'neutral'; this.publish();
  }
  setInteractive(interactive: boolean): void {
    if (!this.window.isDestroyed()) this.window.setIgnoreMouseEvents(!(interactive || !!this.grab), { forward: true });
  }
  startDrag(local: Point): void {
    if (!this.ready || this.state.paused || !this.state.visible || this.grab) return;
    const size = this.size();
    if (local.x < 0 || local.y < 0 || local.x > size.width || local.y > size.height) throw new Error('Invalid grab offset');
    const offset = { x: local.x - size.width / 2, y: local.y - size.height };
    this.grab = { cursor: { x: this.body.x + offset.x, y: this.body.y + offset.y }, offset, moved: false };
    this.body.walking = false; this.body.vx = 0; this.body.vy = 0;
    if (!this.reactionTimer) this.setAnimation(this.baseAnimation());
    this.velocity.clear(); this.velocity.add(this.body, Date.now());
    this.setInteractive(true); this.configureTimers();
  }
  private dragSample(point: Point): void {
    if (!this.grab) return;
    let pickedUp = false;
    if (!this.grab.moved && Math.hypot(point.x - this.grab.cursor.x, point.y - this.grab.cursor.y) >= 4) {
      this.grab.moved = true; this.state.dragging = true; this.state.sleeping = false;
      this.cancelReaction(); this.cancelClicks(); pickedUp = true;
    }
    if (!this.grab.moved) return;
    const target = clampPosition({ x: point.x - this.grab.offset.x, y: point.y - this.grab.offset.y }, workAreas(), this.size());
    Object.assign(this.body, target); this.body.grounded = false;
    this.velocity.add(target, Date.now()); this.moveWindow();
    if (pickedUp) {
      this.events.emit('CHARACTER_PICKED_UP', { x: this.body.x, y: this.body.y });
      console.log('[ducky] Drag started');
    }
  }
  endDrag(allowClick = true): void {
    if (!this.grab) return;
    this.dragSample(screen.getCursorScreenPoint());
    const moved = this.grab.moved; this.grab = undefined; this.state.dragging = false;
    if (moved) {
      const velocity = this.velocity.velocity(); this.body = release(this.body, velocity);
      this.events.emit('CHARACTER_DROPPED', { position: { x: this.body.x, y: this.body.y }, velocity });
      this.setAnimation('falling'); console.log('[ducky] Drag released', velocity);
    } else if (allowClick) this.queueClick();
    // Re-enter click-through until the renderer tests the latest pointer location.
    this.setInteractive(false); this.savePosition(); this.configureTimers(); this.publish();
  }
  private queueClick(): void {
    if (this.clickTimer) clearTimeout(this.clickTimer);
    this.pendingClicks++;
    this.clickTimer = setTimeout(() => {
      this.clickTimer = undefined;
      if (this.state.paused || !this.state.visible) { this.pendingClicks = 0; return; }
      const now = Date.now(); this.clickTimes = this.clickTimes.filter(time => now - time < 4000);
      for (let i = 0; i < this.pendingClicks; i++) this.clickTimes.push(now);
      this.pendingClicks = 0;
      if (this.state.sleeping) this.events.emit('USER_RETURNED', undefined);
      this.events.emit('CHARACTER_CLICKED', { count: this.clickTimes.length });
    }, 500);
  }
  cancelClicks(): void { if (this.clickTimer) clearTimeout(this.clickTimer); this.clickTimer = undefined; this.pendingClicks = 0; }
  private cancelReaction(): void { if (this.reactionTimer) clearTimeout(this.reactionTimer); this.reactionTimer = undefined; this.state.emotion = 'neutral'; }
  private configureTimers(): void {
    const active = this.ready && this.state.visible && !this.state.paused && !this.disposed;
    this.cursor.configure(active, !!this.grab);
    const needMotion = active && !this.grab && moving(this.body);
    if (needMotion && !this.motionTimer) {
      this.lastMotion = performance.now();
      this.motionTimer = setInterval(() => this.motionTick(), 1000 / 60);
    } else if (!needMotion && this.motionTimer) { clearInterval(this.motionTimer); this.motionTimer = undefined; }
    if (active && !this.behaviourTimer) this.behaviourTimer = setInterval(() => this.behaviourTick(), 2000);
    if (!active && this.behaviourTimer) { clearInterval(this.behaviourTimer); this.behaviourTimer = undefined; }
    if (active && !this.idleTimer) { this.idleTimer = setInterval(() => this.checkIdle(), 30000); }
    if (!active && this.idleTimer) { clearInterval(this.idleTimer); this.idleTimer = undefined; }
  }
  private motionTick(): void {
    const now = performance.now(); const result = step(this.body, (now - this.lastMotion) / 1000, workAreas(), this.size(), this.store.value.reducedMotion || this.reducedMotion);
    this.lastMotion = now; this.body = result.body; this.moveWindow();
    if (result.landed) { this.events.emit('CHARACTER_LANDED', { x: this.body.x, y: this.body.y }); console.log('[ducky] Landed; bounce', this.body.bounces); }
    if (!this.reactionTimer) this.setAnimation(this.baseAnimation());
    if (!moving(this.body)) { this.savePosition(); this.configureTimers(); console.log('[ducky] Motion settled'); }
  }
  private behaviourTick(): void {
    this.reducedMotion = systemPreferences.getAnimationSettings().prefersReducedMotion;
    const behaviour = this.scheduler.tick({ paused: this.state.paused, sleeping: this.state.sleeping,
      walkingEnabled: this.store.value.walking, busy: !!this.grab || moving(this.body) || !!this.reactionTimer });
    if (!behaviour) return;
    if (behaviour === 'walk_left' || behaviour === 'walk_right') {
      this.body = walk(this.body, behaviour === 'walk_left' ? 'left' : 'right', this.scheduler.walkDistance());
      this.setAnimation('walking'); this.configureTimers();
    } else this.setAnimation(behaviour);
  }
  checkIdle(): void {
    if (this.grab || this.state.paused || !this.state.visible) return;
    const sleeping = powerMonitor.getSystemIdleTime() >= this.store.value.idleToSleepMinutes * 60;
    if (sleeping !== this.state.sleeping) {
      this.cancelReaction(); this.events.emit(sleeping ? 'USER_BECAME_IDLE' : 'USER_RETURNED', undefined);
      console.log('[ducky] User', sleeping ? 'idle' : 'returned'); this.configureTimers(); this.publish();
    }
  }
  setVisible(visible: boolean): void {
    if (visible === this.state.visible) return;
    this.endDrag(false); this.state.visible = visible; this.cancelReaction(); this.cancelClicks();
    if (!visible) { this.dismissBubble(); this.window.hide(); }
    else { this.setInteractive(false); this.window.showInactive(); this.setAnimation(this.baseAnimation()); }
    this.configureTimers(); this.publish(); console.log('[ducky] Visible:', visible);
  }
  togglePause(): void {
    this.endDrag(false); this.state.paused = !this.state.paused; this.cancelReaction(); this.cancelClicks(); this.dismissBubble();
    this.setAnimation(this.state.paused ? 'idle' : this.baseAnimation()); this.configureTimers(); this.publish();
    console.log('[ducky] Paused:', this.state.paused);
  }
  updateSettings(patch: Partial<EditableSettings>): void {
    const sizeChanged = patch.characterSize !== undefined && patch.characterSize !== this.store.value.characterSize;
    if (sizeChanged) this.endDrag(false);
    if (patch.launchAtStartup !== undefined) {
      app.setLoginItemSettings({ openAtLogin: patch.launchAtStartup, path: process.execPath, args: app.isPackaged ? [] : [app.getAppPath()] });
      console.log('[ducky] Launch at startup:', patch.launchAtStartup);
    }
    this.store.update(patch); this.state.settings = this.store.value;
    if (!this.store.value.walking && this.body.walking) { this.body.walking = false; this.body.vx = 0; this.setAnimation(this.baseAnimation()); }
    if (patch.mute && this.speech.current?.priority === 'low') this.dismissBubble();
    this.applyWindowSettings(); if (sizeChanged) this.recover('character size');
    this.checkIdle(); this.configureTimers(); this.publish(); console.log('[ducky] Settings updated:', Object.keys(patch).join(', '));
  }
  private applyWindowSettings(): void {
    this.window.setAlwaysOnTop(this.store.value.alwaysOnTop && !this.store.value.desktopOnly, 'screen-saver');
  }
  recover(reason: string, reset = false): void {
    this.endDrag(false); this.cancelReaction();
    this.body = reset ? resetPosition(primaryArea(), this.size()) : recover(this.body, workAreas(), this.size());
    this.moveWindow(); this.savePosition(); this.setAnimation(this.state.paused ? 'idle' : this.baseAnimation());
    this.configureTimers(); this.publish(); console.log('[ducky] Position recovered:', reason, this.windowOrigin());
  }
  resume(): void { this.events.emit('APP_RESUMED', undefined); this.recover('system resume'); this.checkIdle(); }
  dispose(): void {
    this.disposed = true; this.cursor.stop();
    if (this.motionTimer) clearInterval(this.motionTimer);
    if (this.behaviourTimer) clearInterval(this.behaviourTimer);
    if (this.idleTimer) clearInterval(this.idleTimer);
    this.cancelReaction(); this.cancelClicks(); if (this.bubbleTimer) clearTimeout(this.bubbleTimer);
    this.savePosition(); this.store.flush();
  }
}
