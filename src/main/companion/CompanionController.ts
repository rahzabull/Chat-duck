import { app, BrowserWindow, powerMonitor, screen, systemPreferences } from 'electron';
import { BehaviourScheduler } from '../../core/behaviour';
import { DialogueDirector, thoughtDelay, thoughtSituation, type DialogueContext, type DirectedSpeech, type Situation } from '../../core/dialogue';
import { InteractionContext, landingSituation, type SituationEvent } from '../../core/dialogue/context';
import { AppSessionTracker } from '../../core/awareness';
import { EventBus } from '../../core/events';
import { SpeechQueue } from '../../core/interruptions';
import { clampPosition, contains, createBody, groundY, moving, nearestArea, recover, release, resetPosition, step, VelocityHistory, walk, windowOrigin, type Body } from '../../core/physics';
import { CHANNELS, WINDOW } from '../../shared/constants';
import type { CompanionState, EditableSettings, Point } from '../../shared/types';
import { CursorPoller } from '../platform/cursor';
import { primaryArea, workAreas } from '../platform/displays';
import type { SettingsStore } from '../settings/store';
import { AppAwareness } from '../platform/awareness';
import { HybridBrain, initialBrainState } from '../ai/HybridBrain';

export class CompanionController {
  readonly events = new EventBus();
  private body: Body;
  private scheduler = new BehaviourScheduler();
  private dialogue = new DialogueDirector();
  private brain: HybridBrain;
  private lastSpoken?: object;
  private privateApp = false;
  private context = new InteractionContext();
  private sessions = new AppSessionTracker();
  private awareness: AppAwareness;
  private nextThought = 0;
  private nextLate = 0;
  private fall?: { height: number; hitWall: boolean };
  private speech = new SpeechQueue();
  private velocity = new VelocityHistory();
  private cursor: CursorPoller;
  private motionTimer?: ReturnType<typeof setInterval>;
  private behaviourTimer?: ReturnType<typeof setInterval>;
  private idleTimer?: ReturnType<typeof setInterval>;
  private reactionTimer?: ReturnType<typeof setTimeout>;
  private bubbleTimer?: ReturnType<typeof setTimeout>;
  private clickTimer?: ReturnType<typeof setTimeout>;
  private hoverTimer?: ReturnType<typeof setTimeout>;
  private pendingClick: SituationEvent | null = null;
  private hovered = false;
  private grab?: { cursor: Point; offset: Point; moved: boolean };
  private reducedMotion = systemPreferences.getAnimationSettings().prefersReducedMotion;
  private lastMotion = 0;
  private ready = false;
  private disposed = false;
  state: CompanionState;
  onChanged: () => void = () => {};

  constructor(readonly window: BrowserWindow, readonly store: SettingsStore, private broadcast: (state: CompanionState) => void) {
    this.state = { visible: true, paused: false, sleeping: false, dragging: false, awarenessActive: false, animation: 'idle', animationRevision: 0, emotion: 'neutral',
      direction: 'right', movementSpeed: 0, bubble: null, settings: store.value, brain: initialBrainState(),
      debugHitbox: process.argv.includes('--debug-hitbox'), version: app.getVersion() };
    this.brain = new HybridBrain(brain => { this.state.brain = brain; this.publish(); }, undefined, aiModel => {
      this.store.update({ aiModel }); this.state.settings = this.store.value; this.publish();
    });
    const saved = store.value.position;
    this.body = saved && workAreas().some(area => contains(saved, area))
      ? createBody(clampPosition(saved, workAreas(), this.size())) : resetPosition(primaryArea(), this.size());
    this.body.grounded = this.body.y === groundY(nearestArea(this.body, workAreas()));
    this.cursor = new CursorPoller(point => {
      if (this.ready && !window.isDestroyed()) window.webContents.send(CHANNELS.cursor, { cursor: point, origin: this.windowOrigin() });
    }, point => this.dragSample(point), () => ({ ...this.windowOrigin(), ...this.size() }));
    this.nextThought = Date.now() + thoughtDelay(store.value.talkativeness);
    this.awareness = new AppAwareness(sample => {
      const previous = this.sessions.current?.name;
      if (!sample.app || previous !== sample.app.name || sample.fullscreen) this.brain.invalidate();
      this.privateApp = sample.private === true;
      if (!sample.app) this.brain.clearHistory();
      const events = this.sessions.observe(sample);
      this.configureBrain();
      // No stale app punchlines after a switch, private app, or fullscreen entry.
      if ((!sample.app || previous !== sample.app.name || sample.fullscreen) && this.speech.current?.priority === 'low') this.dismissBubble();
      if ((sample.fullscreen || sample.private) && this.speech.current?.priority === 'medium') this.dismissBubble();
      for (const event of events) this.respond(event);
    }, active => {
      if (!active && this.state.awarenessActive) { this.brain.invalidate(); this.brain.clearHistory(); this.sessions.clear(); this.privateApp = false; if (this.speech.current?.priority === 'low') this.dismissBubble(); }
      if (this.state.awarenessActive !== active) { this.state.awarenessActive = active; this.publish(); }
      if (!active) this.configureBrain();
    }, () => app.getAppMetrics().map(metric => metric.pid));
    this.events.on('CHARACTER_CLICKED', ({ count }) => this.react(count >= 5 ? 'angry' : 'startled', count >= 3 ? 'angry' : 'startled'));
    this.events.on('CHARACTER_PICKED_UP', () => this.setAnimation('picked_up'));
    this.events.on('CHARACTER_LANDED', () => this.react('landing', 'neutral', 430));
    this.events.on('USER_BECAME_IDLE', () => {
      this.context.idle(powerMonitor.getSystemIdleTime()); this.context.hover(false);
      this.state.sleeping = true; this.body.walking = false; this.body.vx = 0; this.sessions.clear();
      this.setAnimation('sleeping'); this.dismissBubble();
    });
    this.events.on('USER_RETURNED', () => {
      this.state.sleeping = false; this.react('waking_up', 'happy', 900); this.respond(this.context.wake()); this.configureTimers();
    });
    window.once('ready-to-show', () => {
      this.ready = true; this.applyWindowSettings(); this.moveWindow();
      if (this.state.visible) window.showInactive();
      this.publish(); this.configureTimers(); this.events.emit('APP_STARTED', undefined);
      if (!this.store.value.firstLaunchDone) {
        this.saySituation('first_launch'); this.store.update({ firstLaunchDone: true }); this.state.settings = this.store.value;
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
      this.reactionTimer = undefined;
      if (!this.speech.current) this.state.emotion = this.hovered ? 'suspicious' : 'neutral';
      this.setAnimation(this.baseAnimation());
    }, duration);
  }
  animationComplete(animation: string): void { this.events.emit('ANIMATION_COMPLETED', { animation }); }
  private respond(event: SituationEvent | null): void {
    if (!event) return;
    // A sustained hold is a new interaction, not a queued continuation of pickup.
    if (event.situation === 'drag_long') { this.speech.interrupt(); this.dismissBubble(); }
    this.saySituation(event.situation, event.context);
  }
  private saySituation(situation: Situation, context: DialogueContext = {}): void {
    this.brain.invalidate();
    const app = this.sessions.current?.name;
    this.dialogue.decide(situation, { ...context, talkativeness: this.store.value.talkativeness, fullscreen: this.sessions.fullscreen }, speech => {
      if (!this.speech.canOffer(speech.priority, this.speechOptions(speech))) return false;
      this.brain.route(situation, context, speech, () =>
        !this.disposed && this.state.visible && !this.state.paused && !this.state.sleeping && !this.sessions.fullscreen &&
        (!situation.startsWith('drag_') || this.state.dragging) &&
        (!situation.startsWith('hover_') || this.hovered) &&
        (!(situation.startsWith('app_') || situation === 'late_night_working') || app === this.sessions.current?.name),
      line => this.say(line));
      return true;
    });
  }
  private speechOptions(line: DirectedSpeech) {
    const area = nearestArea(this.body, workAreas());
    const tooHigh = this.windowOrigin().y <= area.y + 20;
    return { muted: this.store.value.mute, then: line.then, followUpDelayMs: 1500 + Math.random() * 1000,
      fullscreen: this.sessions.fullscreen,
      blocked: !this.state.visible || this.state.paused || this.state.sleeping || tooHigh,
      cooldownMs: this.store.value.talkativeness === 'quiet' ? 15000 : this.store.value.talkativeness === 'chatty' ? 2500 : 6500 };
  }
  private say(line: DirectedSpeech): boolean {
    if (!this.speech.offer(line.text, line.priority, this.speechOptions(line))) return false;
    this.react(line.animation, line.emotion, line.animation === 'landing' ? 430 : 900);
    this.syncSpeech(); return true;
  }
  private syncSpeech(): void {
    if (this.speech.current && this.speech.current !== this.lastSpoken) this.brain.record(this.speech.current.text);
    this.lastSpoken = this.speech.current ?? undefined;
    this.state.bubble = this.speech.current?.text ?? null; this.publish();
    if (this.bubbleTimer) clearTimeout(this.bubbleTimer);
    this.bubbleTimer = undefined;
    const next = this.speech.nextChangeAt;
    if (next !== undefined) this.bubbleTimer = setTimeout(() => {
      this.speech.tick();
      if (!this.speech.current) this.dismissBubble(); else this.syncSpeech();
    }, Math.max(1, next - Date.now()));
  }
  dismissBubble(): void {
    this.brain.invalidate();
    if (this.bubbleTimer) clearTimeout(this.bubbleTimer); this.bubbleTimer = undefined;
    this.speech.dismiss(); this.state.bubble = null;
    if (!this.reactionTimer) this.state.emotion = this.hovered ? 'suspicious' : 'neutral';
    this.publish();
  }
  hover(active: boolean): void {
    this.brain.invalidate();
    this.hovered = active;
    if (this.hoverTimer) clearTimeout(this.hoverTimer); this.hoverTimer = undefined;
    if (!active) this.context.hover(false);
    if (this.state.paused || !this.state.visible || this.state.sleeping || this.state.dragging) return;
    this.respond(this.context.hover(active));
    if (active) this.hoverTimer = setTimeout(() => {
      this.hoverTimer = undefined; for (const event of this.context.tick()) this.respond(event);
    }, 2501);
    this.events.emit('CHARACTER_HOVERED', { active });
    if (!this.reactionTimer && !this.speech.current) this.state.emotion = active ? 'suspicious' : 'neutral';
    this.publish();
  }
  setInteractive(interactive: boolean): void {
    if (!this.window.isDestroyed()) this.window.setIgnoreMouseEvents(!(interactive || !!this.grab), { forward: true });
  }
  startDrag(local: Point): void {
    if (!this.ready || this.state.paused || !this.state.visible || this.grab) return;
    this.brain.invalidate();
    const size = this.size();
    if (local.x < 0 || local.y < 0 || local.x > size.width || local.y > size.height) throw new Error('Invalid grab offset');
    const offset = { x: local.x - size.width / 2, y: local.y - size.height };
    this.speech.interrupt(); this.dismissBubble();
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
      // Pickup is the immediate reaction; still close the previous away session.
      if (this.state.sleeping) this.context.wake();
      this.grab.moved = true; this.state.dragging = true; this.state.sleeping = false;
      this.cancelReaction(); this.cancelClicks(); pickedUp = true;
      this.fall = undefined;
    }
    if (!this.grab.moved) return;
    const target = clampPosition({ x: point.x - this.grab.offset.x, y: point.y - this.grab.offset.y }, workAreas(), this.size());
    Object.assign(this.body, target); this.body.grounded = false;
    this.velocity.add(target, Date.now()); this.moveWindow();
    if (pickedUp) {
      this.events.emit('CHARACTER_PICKED_UP', { x: this.body.x, y: this.body.y });
      this.respond(this.context.pickup(point));
      console.log('[ducky] Drag started');
    }
    this.respond(this.context.drag(point));
    for (const event of this.context.tick()) this.respond(event);
  }
  endDrag(allowClick = true): void {
    if (!this.grab) return;
    this.dragSample(screen.getCursorScreenPoint());
    const moved = this.grab.moved; this.grab = undefined; this.state.dragging = false;
    this.brain.invalidate();
    this.context.release();
    if (moved) {
      this.speech.interrupt(); this.dismissBubble(); this.cancelReaction();
      this.fall = { height: Math.max(0, groundY(nearestArea(this.body, workAreas())) - this.body.y), hitWall: false };
      const velocity = this.velocity.velocity(); this.body = release(this.body, velocity);
      this.events.emit('CHARACTER_DROPPED', { position: { x: this.body.x, y: this.body.y }, velocity });
      this.setAnimation('falling'); console.log('[ducky] Drag released', velocity);
    } else if (allowClick) this.queueClick();
    // Re-enter click-through until the renderer tests the latest pointer location.
    this.setInteractive(false); this.savePosition(); this.configureTimers(); this.publish();
  }
  private queueClick(): void {
    if (this.clickTimer) clearTimeout(this.clickTimer);
    const event = this.context.click();
    if (event && this.pendingClick?.situation !== 'click_angry') this.pendingClick = event;
    // Reactions are immediate; native double-click still opens Settings and cancels later beats.
    this.clickTimer = setTimeout(() => {
      this.clickTimer = undefined;
      const pending = this.pendingClick; this.pendingClick = null;
      if (this.state.paused || !this.state.visible || !pending) return;
      if (this.state.sleeping) this.events.emit('USER_RETURNED', undefined);
      this.events.emit('CHARACTER_CLICKED', { count: pending.context?.count ?? 1 });
      this.respond(pending);
    }, 0);
  }
  cancelClicks(): void { if (this.clickTimer) clearTimeout(this.clickTimer); this.clickTimer = undefined; this.pendingClick = null; }
  private cancelReaction(): void { if (this.reactionTimer) clearTimeout(this.reactionTimer); this.reactionTimer = undefined; this.state.emotion = 'neutral'; }
  private configureTimers(): void {
    const active = this.ready && this.state.visible && !this.state.paused && !this.disposed;
    this.awareness.configure(active && !this.state.sleeping && this.store.value.appAwareness);
    this.configureBrain();
    if (!active) {
      this.context.suspend(); this.hovered = false;
      if (this.hoverTimer) clearTimeout(this.hoverTimer); this.hoverTimer = undefined;
    }
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
  private configureBrain(): void {
    this.brain.configure(this.store.value, !this.ready || this.disposed || !this.state.visible || this.state.paused ||
      this.state.sleeping || this.sessions.fullscreen || this.privateApp);
  }
  testAI(): Promise<void> { return this.brain.connect(); }
  private motionTick(): void {
    const now = performance.now(); const result = step(this.body, (now - this.lastMotion) / 1000, workAreas(), this.size(), this.store.value.reducedMotion || this.reducedMotion);
    this.lastMotion = now; this.body = result.body; this.moveWindow();
    if (this.fall && result.hitWall) this.fall.hitWall = true;
    if (!this.reactionTimer) this.setAnimation(this.baseAnimation());
    if (!moving(this.body)) {
      if (this.fall) {
        const fall = this.fall; this.fall = undefined;
        this.events.emit('CHARACTER_LANDED', { x: this.body.x, y: this.body.y });
        this.saySituation(landingSituation(fall.height, fall.hitWall));
      }
      this.savePosition(); this.configureTimers(); console.log('[ducky] Motion settled');
    }
  }
  private behaviourTick(): void {
    this.reducedMotion = systemPreferences.getAnimationSettings().prefersReducedMotion;
    if (!this.state.sleeping) for (const event of this.context.tick()) this.respond(event);
    this.ambientTick();
    const behaviour = this.scheduler.tick({ paused: this.state.paused, sleeping: this.state.sleeping,
      walkingEnabled: this.store.value.walking, busy: !!this.grab || moving(this.body) || !!this.reactionTimer || !!this.speech.current });
    if (!behaviour) return;
    if (behaviour === 'walk_left' || behaviour === 'walk_right') {
      this.body = walk(this.body, behaviour === 'walk_left' ? 'left' : 'right', this.scheduler.walkDistance());
      this.setAnimation('walking'); this.configureTimers();
      this.saySituation('walk_mutter');
    } else this.setAnimation(behaviour);
  }
  private ambientTick(): void {
    const now = Date.now();
    const blocked = this.state.paused || !this.state.visible || this.state.sleeping || !!this.grab || this.sessions.fullscreen;
    if (now >= this.nextThought) {
      this.nextThought = now + thoughtDelay(this.store.value.talkativeness);
      if (!blocked) this.saySituation(thoughtSituation(new Date(now)));
    }
    if (!blocked && new Date(now).getHours() < 4 && now >= this.nextLate && powerMonitor.getSystemIdleTime() < 60) {
      this.nextLate = now + 45 * 60000;
      this.saySituation(this.state.awarenessActive && this.sessions.current ? 'late_night_working' : 'sleepy_late');
    }
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
    if (patch.aiEnabled === false) this.dismissBubble();
    if (patch.appAwareness === false) this.brain.revokeContext();
    if (patch.mute === true) this.brain.invalidate();
    const sizeChanged = patch.characterSize !== undefined && patch.characterSize !== this.store.value.characterSize;
    if (sizeChanged) this.endDrag(false);
    if (patch.launchAtStartup !== undefined) {
      app.setLoginItemSettings({ openAtLogin: patch.launchAtStartup, path: process.execPath, args: app.isPackaged ? [] : [app.getAppPath()] });
      console.log('[ducky] Launch at startup:', patch.launchAtStartup);
    }
    this.store.update(patch); this.state.settings = this.store.value;
    if (patch.talkativeness) this.nextThought = Date.now() + thoughtDelay(patch.talkativeness);
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
    this.fall = undefined;
    this.body = reset ? resetPosition(primaryArea(), this.size()) : recover(this.body, workAreas(), this.size());
    this.moveWindow(); this.savePosition(); this.setAnimation(this.state.paused ? 'idle' : this.baseAnimation());
    this.configureTimers(); this.publish(); console.log('[ducky] Position recovered:', reason, this.windowOrigin());
  }
  resume(): void { this.events.emit('APP_RESUMED', undefined); this.recover('system resume'); this.checkIdle(); }
  dispose(): void {
    this.brain.dispose();
    this.disposed = true; this.cursor.stop(); this.awareness.dispose(); this.context.suspend();
    if (this.hoverTimer) clearTimeout(this.hoverTimer);
    if (this.motionTimer) clearInterval(this.motionTimer);
    if (this.behaviourTimer) clearInterval(this.behaviourTimer);
    if (this.idleTimer) clearInterval(this.idleTimer);
    this.cancelReaction(); this.cancelClicks(); if (this.bubbleTimer) clearTimeout(this.bubbleTimer);
    this.savePosition(); this.store.flush();
  }
}
