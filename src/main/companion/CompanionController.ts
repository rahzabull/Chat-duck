import { conversationLayout } from '../../core/conversation/layout';
import type { ProductivityView } from '../../core/productivity/types';
import { PRODUCTIVITY_LINES } from '../../core/productivity/lines';
import type { ConversationView } from '../../core/conversation/types';
import { app, BrowserWindow, powerMonitor, screen, systemPreferences } from 'electron';
import { MemoryStore } from '../memory/store';
import { freshMemory, memorySummary, remember, visit, type Memory } from '../../core/memory';
import { dailyMood, EmotionEngine, localDay } from '../../core/emotions';
import { ACTIVITIES, ACTIVITY_DURATION, type Behaviour, BehaviourScheduler } from '../../core/behaviour';
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
  private conversationActive = false;
  private productivityTimer?: ReturnType<typeof setTimeout>;
  private conversationQuietUntil = 0;
  private conversationQuietTimer?: ReturnType<typeof setTimeout>;
  private releasingConversationFocus = false;
  private conversationHwnd?: string;
  private conversationInference = false;
  private conversationBounds?: { x: number; y: number; width: number; height: number };
  private muteUntil = 0;
  private muteTimer?: ReturnType<typeof setTimeout>;
  onConversationClose: () => void = () => {};
  readonly events = new EventBus();
  private emotions: EmotionEngine;
  private memory: Memory;
  private savedMemory = '';
  private anniversaryDay = '';
  private emotionTimer?: ReturnType<typeof setInterval>;
  private activityTimer?: ReturnType<typeof setTimeout>;
  private activity?: Behaviour;
  private sunglassesUntil = 0;
  private debugActivity?: Behaviour;
  private body: Body;
  private scheduler = new BehaviourScheduler();
  private dialogue = new DialogueDirector();
  private brain: HybridBrain;
  private lastSpoken?: object;
  private privateApp = false;
  private fullscreenKnown = false;
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
  private hoveredBefore = false;
  private grab?: { cursor: Point; offset: Point; moved: boolean };
  private reducedMotion = systemPreferences.getAnimationSettings().prefersReducedMotion;
  private lastMotion = 0;
  private ready = false;
  private disposed = false;
  state: CompanionState;
  onChanged: () => void = () => {};

  constructor(readonly window: BrowserWindow, readonly store: SettingsStore, private broadcast: (state: CompanionState) => void, private memoryStore?: MemoryStore) {
    if (!store.value.installSeed) store.update({ installSeed: 1 + Math.floor(Math.random() * 4294967294) });
    const date = localDay(Date.now());
    const mood = store.value.dailyMood?.date === date ? store.value.dailyMood.mood : dailyMood(date, store.value.installSeed, store.value.personality);
    store.update({ dailyMood: { date, mood } });
    this.emotions = new EmotionEngine(mood);
    this.memory = memoryStore?.value ?? freshMemory(Date.now());
    if (store.value.memoryEnabled) { visit(this.memory, Date.now()); this.emotions.restorePokes(this.memory.dailyPokes); this.saveMemory(); }
    const debugIndex = process.argv.indexOf('--debug-activity');
    if (!app.isPackaged && debugIndex >= 0 && (ACTIVITIES as readonly string[]).includes(process.argv[debugIndex + 1])) this.debugActivity = process.argv[debugIndex + 1] as Behaviour;
    this.state = { sunglasses: false, mood, memory: store.value.memoryEnabled ? memorySummary(this.memory) : [], visible: true, paused: false, sleeping: false, dragging: false, awarenessActive: false, animation: 'idle', animationRevision: 0, emotion: 'neutral',
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
    this.nextThought = Date.now() + thoughtDelay(store.value.talkativeness) / this.emotions.speechScale();
    this.awareness = new AppAwareness(sample => {
      this.fullscreenKnown = true;
      const previous = this.sessions.current?.name;
      const changed = (this.store.value.appAwareness && (!sample.app || previous !== sample.app.name)) || sample.fullscreen !== this.sessions.fullscreen;
      if (changed) this.brain.invalidate();
      if (sample.fullscreen) { this.cancelActivity(); this.cancelReaction(); if (this.body.walking) { this.body.walking = false; this.body.vx = 0; } this.setAnimation(this.baseAnimation()); }
      this.privateApp = sample.private === true;
      if (this.store.value.appAwareness && !sample.app) this.brain.clearHistory();
      const events = this.sessions.observe(sample);
      this.configureBrain();
      // No stale app punchlines after a switch, private app, or fullscreen entry.
      if ((changed || sample.fullscreen) && this.speech.current?.priority === 'low') this.dismissBubble();
      if ((sample.fullscreen || sample.private) && this.speech.current?.priority === 'medium') this.dismissBubble();
      for (const event of events) this.respond(event);
      if (this.debugActivity && !sample.fullscreen) { const activity = this.debugActivity; this.debugActivity = undefined; this.dismissBubble(); this.cancelReaction(); this.performActivity(activity); }
    }, active => {
      if (!active) { this.fullscreenKnown = false; this.cancelActivity(); if (this.body.walking) { this.body.walking = false; this.body.vx = 0; } this.setAnimation(this.state.paused ? 'idle' : this.baseAnimation()); }
      active = active && this.store.value.appAwareness;
      if (!active && this.state.awarenessActive) { this.brain.invalidate(); this.brain.clearHistory(); this.sessions.clear(); this.privateApp = false; if (this.speech.current?.priority === 'low') this.dismissBubble(); }
      if (this.state.awarenessActive !== active) { this.state.awarenessActive = active; this.publish(); }
      if (!active) this.configureBrain();
    }, () => app.getAppMetrics().map(metric => metric.pid));
    this.events.on('CHARACTER_CLICKED', ({ count }) => this.react(count >= 5 ? 'angry' : 'startled', count >= 3 ? 'angry' : 'startled'));
    this.events.on('CHARACTER_PICKED_UP', () => this.setAnimation('picked_up'));
    this.events.on('CHARACTER_LANDED', () => this.react('landing', 'neutral', 430));
    this.events.on('USER_BECAME_IDLE', () => {
      if (this.conversationQuiet()) return;
      this.cancelActivity(); this.emotions.suspend();
      this.context.idle(powerMonitor.getSystemIdleTime()); this.context.hover(false);
      this.state.sleeping = true; this.body.walking = false; this.body.vx = 0; this.sessions.clear();
      this.setAnimation('sleeping'); this.dismissBubble();
    });
    this.events.on('USER_RETURNED', () => {
      this.emotions.input('return'); this.emotions.suspend();
      this.state.sleeping = false; this.react('waking_up', 'happy', 900);
      const wake = this.context.wake();
      if (this.store.value.memoryEnabled && this.store.value.preferredName && Math.random() < .2) this.saySituation('memory_name'); else this.respond(wake);
      this.configureTimers();
    });
    window.once('ready-to-show', () => {
      this.ready = true; this.applyWindowSettings(); this.moveWindow();
      if (this.state.visible) window.showInactive();
      this.publish(); this.configureTimers(); this.events.emit('APP_STARTED', undefined); this.events.emit('MOOD_CHANGED', { mood: this.emotions.mood });
      if (!this.store.value.firstLaunchDone) {
        this.saySituation('first_launch'); this.store.update({ firstLaunchDone: true }); this.state.settings = this.store.value;
      }
      console.log('[ducky] Companion ready', this.windowOrigin());
    });
    window.on('blur', () => this.endDrag(false));
    window.on('hide', () => { if (!this.releasingConversationFocus && this.state.visible && !this.disposed) this.setVisible(false); });
    window.webContents.on('render-process-gone', (_event, details) => {
      console.error('[ducky] Companion renderer exited', details.reason);
      this.setVisible(false);
    });
  }
  setConversationInference(active: boolean): void { this.conversationInference = active; this.configureBrain(); }
  private conversationQuiet(): boolean { return this.surfaceOpen() || Date.now() < this.conversationQuietUntil; }
  private surfaceOpen(): boolean { return this.conversationActive || !!this.state.productivity?.card || !!this.state.productivity?.focus || !!this.state.productivity?.breakMinutes; }
  presentProductivity(view: ProductivityView): void {
    const wasBusy = !!this.state.productivity?.focus || !!this.state.productivity?.card || !!this.state.productivity?.breakMinutes;
    this.state.productivity = view;
    if (view.focus || view.card || view.breakMinutes) {
      this.endDrag(false); this.cancelClicks(); this.cancelActivity(); this.body.walking = false; this.body.vx = 0; this.body.vy = 0;
      if (!wasBusy) { this.cancelReaction(); this.dismissBubble(); }
      this.state.sleeping = false;
      this.window.setFocusable(true);
    }
    if (!this.reactionTimer) this.setAnimation(this.baseAnimation());
    this.presentConversation(this.state.conversation ?? { active: false, state: null, reply: '', panel: false, revision: 0, shortcutError: '' });
    this.configureTimers();
  }
  productivityAttention(kind: 'alarm' | 'celebrate' | 'focus', text?: string): void {
    this.cancelActivity(); this.cancelReaction(); this.body.walking = false; this.body.vx = 0; this.state.sleeping = false;
    if (kind === 'alarm') {
      const area = nearestArea(this.body, workAreas()); this.body.direction = this.body.x > area.x + area.width / 2 ? 'left' : 'right';
      this.setVisible(true); this.window.showInactive();
    }
    if (text) {
      const key = text === 'task_done' && this.store.value.profanity ? 'task_done_profane' : text;
      const pool = PRODUCTIVITY_LINES[key as keyof typeof PRODUCTIVITY_LINES];
      this.state.productivitySpeech = pool ? pool[Math.floor(Math.random() * pool.length)] : text;
      clearTimeout(this.productivityTimer); this.productivityTimer = setTimeout(() => { this.state.productivitySpeech = undefined; this.publish(); }, 8000);
    }
    if (kind !== 'focus') this.react(kind, 'happy', kind === 'alarm' ? 3000 : 1200);
    else this.setAnimation('focus');
  }
  captureConversationFocus(ready: () => void): void {
    this.awareness.captureForeground(hwnd => { this.conversationHwnd = hwnd; ready(); });
  }
  releaseConversationFocus(): void {
    if (this.state.productivity?.card) return;
    // This hide only yields native focus; it must not invoke the user-hide path.
    this.releasingConversationFocus = true;
    try {
      const known = this.conversationHwnd !== undefined;
      if (this.conversationHwnd !== undefined) this.awareness.restoreForeground(this.conversationHwnd);
      this.conversationHwnd = undefined;
      this.window.setFocusable(false);
      if (!known) { this.window.hide(); this.window.showInactive(); }
      this.window.setAlwaysOnTop(this.store.value.alwaysOnTop && !this.store.value.desktopOnly, 'screen-saver');
    } finally { this.releasingConversationFocus = false; }
  }
  beginConversation(): void {
    clearTimeout(this.conversationQuietTimer); this.conversationQuietTimer = undefined;
    this.endDrag(false); this.cancelClicks(); this.cancelReaction(); this.cancelActivity(); this.dismissBubble();
    this.conversationActive = true; this.state.sleeping = false;
    this.body.walking = false; this.body.vx = 0; this.body.vy = 0;
    this.setVisible(true); this.setAnimation('idle'); this.configureTimers();
  }
  presentConversation(view: ConversationView): void {
    if (this.window.isDestroyed()) return;
    if (view.active || view.reply || this.state.productivity?.card || this.state.productivity?.focus || this.state.productivity?.breakMinutes) {
      const base = { ...windowOrigin(this.body, this.size()), ...this.size() };
      const result = conversationLayout(base, nearestArea(this.body, workAreas()), view.panel || !!this.state.productivity?.card);
      this.conversationBounds = result.bounds; view.layout = result.layout;
      if (this.state.productivity) this.state.productivity.layout = result.layout;
    } else this.conversationBounds = undefined;
    this.state.conversation = view; this.moveWindow(); this.publish();
  }
  finishConversation(): void {
    if (!this.conversationActive) return;
    this.conversationActive = false; this.conversationBounds = undefined;
    if (this.state.productivity?.card || this.state.productivity?.focus || this.state.productivity?.breakMinutes) this.presentConversation(this.state.conversation!);
    else this.moveWindow();
    this.conversationQuietUntil = Date.now() + 60000;
    clearTimeout(this.conversationQuietTimer);
    this.conversationQuietTimer = setTimeout(() => { this.conversationQuietTimer = undefined; this.configureTimers(); }, 60000);
    this.setAnimation(this.baseAnimation()); this.configureTimers();
  }
  muteFor(minutes: number): void {
    this.muteUntil = Date.now() + minutes * 60000; clearTimeout(this.muteTimer);
    this.muteTimer = setTimeout(() => { this.muteUntil = 0; this.muteTimer = undefined; }, minutes * 60000);
    if (this.speech.current?.priority === 'low') this.dismissBubble();
  }
  private saveMemory(): void {
    if (!this.store.value.memoryEnabled) { if (this.state) this.state.memory = []; return; }
    this.memory.preferredName = this.store.value.preferredName;
    this.memory.dailyPokes = this.emotions.dailyPokes;
    const snapshot = JSON.stringify(this.memory);
    if (this.memoryStore && snapshot !== this.savedMemory) { this.memoryStore.value = this.memory; this.memoryStore.changed(); }
    this.savedMemory = snapshot;
    if (this.state) this.state.memory = memorySummary(this.memory);
  }
  private rememberEvent(event: 'pickup' | 'throw' | 'angry'): void {
    if (!this.store.value.memoryEnabled) return;
    remember(this.memory, event, Date.now()); this.saveMemory();
  }
  forgetMemory(): void {
    this.memoryStore?.forget(); this.savedMemory = ''; this.memory = freshMemory(Date.now());
    this.store.update({ preferredName: '' }); this.store.flush(); this.anniversaryDay = ''; this.state.settings = this.store.value;
    this.savedMemory = JSON.stringify(this.memory);
    this.emotions.restorePokes(0); this.brain.revokeContext(); this.dismissBubble();
    this.state.memory = this.store.value.memoryEnabled ? memorySummary(this.memory) : [];
    this.configureBrain(); this.publish();
  }
  private emotionTick(): void {
    const date = localDay(Date.now());
    if (this.store.value.dailyMood?.date !== date) {
      const mood = dailyMood(date, this.store.value.installSeed, this.store.value.personality);
      this.store.update({ dailyMood: { date, mood } }); this.state.settings = this.store.value;
      this.emotions.mood = mood; this.state.mood = mood; this.events.emit('MOOD_CHANGED', { mood });
    }
    this.emotions.tick(true, this.state.sleeping);
    if (this.store.value.memoryEnabled) { visit(this.memory, Date.now()); this.saveMemory(); }
    if (!this.reactionTimer && !this.speech.current) this.state.emotion = this.emotions.face();
    if (!this.activity && this.state.animation === 'sunglasses' && Date.now() >= this.sunglassesUntil) this.setAnimation(this.baseAnimation());
    this.publish();
  }
  private cancelActivity(): void {
    if (this.activityTimer) clearTimeout(this.activityTimer); this.activityTimer = undefined; this.activity = undefined;
  }
  private size() { return { width: Math.round(WINDOW.width * this.store.value.characterSize), height: Math.round(WINDOW.height * this.store.value.characterSize) }; }
  private windowOrigin(): Point { return this.conversationBounds ?? windowOrigin(this.body, this.size()); }
  private moveWindow(): void {
    if (this.window.isDestroyed()) return;
    this.window.setBounds(this.conversationBounds ?? { ...this.windowOrigin(), ...this.size() }, false);
    if (this.ready) this.window.webContents.send(CHANNELS.position, this.windowOrigin());
  }
  private savePosition(): void { this.store.update({ position: { x: this.body.x, y: this.body.y } }); this.state.settings = this.store.value; }
  private publish(): void { this.state.sunglasses = Date.now() < this.sunglassesUntil && this.state.visible && !this.state.paused && !this.sessions.fullscreen; if (this.ready && !this.disposed) { this.broadcast(this.state); this.onChanged(); } }
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
  private baseAnimation(): string { return this.state.sleeping ? 'sleeping' : this.state.dragging ? 'picked_up' : this.state.productivity?.focus ? 'focus' : !this.body.grounded ? 'falling' : this.body.walking ? 'walking' : this.activity ?? 'idle'; }
  private react(animation: string, emotion: string, duration = 750): void {
    if (this.reactionTimer) clearTimeout(this.reactionTimer);
    this.state.emotion = emotion; this.setAnimation(animation, true);
    this.reactionTimer = setTimeout(() => {
      this.reactionTimer = undefined;
      if (!this.speech.current) this.state.emotion = this.emotions.face();
      this.setAnimation(this.baseAnimation());
    }, duration);
  }
  animationComplete(animation: string): void { this.events.emit('ANIMATION_COMPLETED', { animation }); }
  private respond(event: SituationEvent | null): void {
    if (!event) return;
    if (event.situation === 'drag_shaken') { this.emotions.input('shake'); this.saveMemory(); }
    if (event.situation === 'click_angry') this.rememberEvent('angry');
    // A sustained hold is a new interaction, not a queued continuation of pickup.
    if (event.situation === 'drag_long') { this.speech.interrupt(); this.dismissBubble(); }
    this.saySituation(event.situation, event.context);
  }
  private saySituation(situation: Situation, context: DialogueContext = {}): boolean {
    if (this.conversationQuiet()) return false;
    this.brain.invalidate();
    context = { ...context, personality: this.store.value.personality, profanity: this.store.value.profanity,
      mood: this.emotions.mood, emotions: this.emotions.words(), speechScale: this.emotions.speechScale(),
      memoryEnabled: this.store.value.memoryEnabled,
      name: this.store.value.memoryEnabled ? this.store.value.preferredName : undefined,
      memoryFact: this.store.value.memoryEnabled ? this.memory.daysTogether + ' days together' : undefined };
    const app = this.sessions.current?.name;
    return !!this.dialogue.decide(situation, { ...context, talkativeness: this.store.value.talkativeness, fullscreen: this.sessions.fullscreen }, speech => {
      if (!this.speech.canOffer(speech.priority, this.speechOptions(speech))) return false;
      this.brain.route(situation, context, speech, () =>
        !this.conversationQuiet() && !this.disposed && this.state.visible && !this.state.paused && !this.state.sleeping && !this.sessions.fullscreen &&
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
    return { muted: this.store.value.mute || Date.now() < this.muteUntil, then: line.then, followUpDelayMs: 1500 + Math.random() * 1000,
      fullscreen: this.sessions.fullscreen,
      blocked: this.conversationQuiet() || !this.state.visible || this.state.paused || this.state.sleeping || tooHigh,
      cooldownMs: this.store.value.talkativeness === 'quiet' ? 15000 : this.store.value.talkativeness === 'chatty' ? 2500 : 6500 };
  }
  private say(line: DirectedSpeech): boolean {
    if (!this.speech.offer(line.text, line.priority, this.speechOptions(line))) return false;
    if (!this.activity) this.react(line.animation, line.emotion, line.animation === 'landing' ? 430 : 900);
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
    if (this.surfaceOpen()) return;
    this.brain.invalidate();
    this.hovered = active;
    if (this.hoverTimer) clearTimeout(this.hoverTimer); this.hoverTimer = undefined;
    if (!active) { this.context.hover(false); this.hoveredBefore = false; }
    if (this.state.paused || !this.state.visible || this.state.sleeping || this.state.dragging) return;
    if (active && !this.hoveredBefore) this.emotions.input('hover');
    this.hoveredBefore = active;
    this.respond(this.context.hover(active));
    if (active) this.hoverTimer = setTimeout(() => {
      this.hoverTimer = undefined; for (const event of this.context.tick()) this.respond(event);
    }, 2501);
    this.events.emit('CHARACTER_HOVERED', { active });
    if (!this.reactionTimer && !this.speech.current) this.state.emotion = this.emotions.face();
    this.publish();
  }
  setInteractive(interactive: boolean): void {
    if (!this.window.isDestroyed()) this.window.setIgnoreMouseEvents(!(interactive || !!this.grab), { forward: true });
  }
  startDrag(local: Point): void {
    if (this.surfaceOpen() || !this.ready || this.state.paused || !this.state.visible || this.grab) return;
    this.brain.invalidate(); this.cancelActivity();
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
      this.emotions.input('drag'); this.rememberEvent('pickup');
      this.respond(this.context.pickup(point, this.emotions.patience));
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
    const event = this.context.click(this.emotions.patience);
    this.emotions.input('click', event?.context?.count ?? 5); this.saveMemory();
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
  private cancelReaction(): void { if (this.reactionTimer) clearTimeout(this.reactionTimer); this.reactionTimer = undefined; this.state.emotion = this.emotions.face(); }
  private configureTimers(): void {
    const active = this.ready && this.state.visible && !this.state.paused && !this.disposed;
    this.awareness.configure(active && !this.state.sleeping, this.store.value.appAwareness);
    this.configureBrain();
    if (!active) {
      this.cancelActivity(); this.emotions.suspend();
      this.context.suspend(); this.hovered = false; this.hoveredBefore = false;
      if (this.hoverTimer) clearTimeout(this.hoverTimer); this.hoverTimer = undefined;
    }
    if (active && !this.emotionTimer) { this.emotions.suspend(); this.emotionTimer = setInterval(() => this.emotionTick(), 30000); }
    if (!active && this.emotionTimer) { clearInterval(this.emotionTimer); this.emotionTimer = undefined; }
    this.cursor.configure(active, !!this.grab);
    const needMotion = active && !this.surfaceOpen() && !this.grab && moving(this.body);
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
    this.brain.configure(this.store.value, this.conversationInference || this.conversationQuiet() || !this.ready || this.disposed || !this.state.visible || this.state.paused ||
      this.state.sleeping || this.sessions.fullscreen || this.privateApp);
  }
  testAI(): Promise<void> { return this.conversationActive ? Promise.resolve() : this.brain.connect(); }
  private motionTick(): void {
    const now = performance.now(); const result = step(this.body, (now - this.lastMotion) / 1000, workAreas(), this.size(), this.store.value.reducedMotion || this.reducedMotion);
    this.lastMotion = now; this.body = result.body; this.moveWindow();
    if (this.fall && result.hitWall) this.fall.hitWall = true;
    if (!this.reactionTimer) this.setAnimation(this.baseAnimation());
    if (!moving(this.body)) {
      if (this.fall) {
        const fall = this.fall; this.fall = undefined;
        this.events.emit('CHARACTER_LANDED', { x: this.body.x, y: this.body.y });
        if (fall.height > 500) this.rememberEvent('throw');
        this.saySituation(landingSituation(fall.height, fall.hitWall));
      }
      this.savePosition(); this.configureTimers(); console.log('[ducky] Motion settled');
    }
  }
  private behaviourTick(): void {
    if (this.conversationQuiet()) return;
    this.reducedMotion = systemPreferences.getAnimationSettings().prefersReducedMotion;
    if (!this.state.sleeping) for (const event of this.context.tick()) this.respond(event);
    this.ambientTick();
    const behaviour = this.scheduler.tick({ paused: this.state.paused, sleeping: this.state.sleeping,
      hidden: !this.state.visible, fullscreen: this.sessions.fullscreen || !this.fullscreenKnown, dragging: this.state.dragging,
      mood: this.emotions.mood, emotions: this.emotions.values, activityLevel: this.store.value.activityLevel,
      walkingEnabled: this.store.value.walking, busy: !!this.activity || !!this.grab || moving(this.body) || !!this.reactionTimer || !!this.speech.current });
    if (!behaviour) return;
    this.performActivity(behaviour);
  }
  private performActivity(behaviour: Behaviour): void {
    if (this.conversationQuiet() || !this.state.visible || this.state.paused || this.state.dragging || this.sessions.fullscreen || !this.fullscreenKnown) return;
    if (behaviour === 'walk_left' || behaviour === 'walk_right') {
      this.body = walk(this.body, behaviour === 'walk_left' ? 'left' : 'right', this.scheduler.walkDistance());
      this.setAnimation('walking'); this.configureTimers();
      this.saySituation('walk_mutter');
    } else if (ACTIVITY_DURATION[behaviour]) {
      this.cancelActivity(); this.cancelReaction(); this.activity = behaviour;
      if (behaviour === 'sunglasses') this.sunglassesUntil = Date.now() + 120000;
      this.setAnimation(behaviour, true);
      const situation = ({ yawn: 'activity_yawn', stretch: 'activity_stretch', dance: 'activity_dance', strike: 'event_strike', sunglasses: 'event_sunglasses', bread_snack: 'event_bread', visitor: 'event_visitor' } as Partial<Record<Behaviour, Situation>>)[behaviour];
      if (situation) this.saySituation(situation);
      // Glasses remain a static accessory between activities for two minutes.
      this.activityTimer = setTimeout(() => { this.activity = undefined; this.activityTimer = undefined; this.setAnimation(this.baseAnimation()); }, behaviour === 'sunglasses' ? 2000 : ACTIVITY_DURATION[behaviour]);
    } else this.setAnimation(behaviour);
  }
  private ambientTick(): void {
    const now = Date.now();
    const blocked = this.state.paused || !this.state.visible || this.state.sleeping || !!this.grab || !!this.activity || this.sessions.fullscreen || !this.fullscreenKnown;
    if (now >= this.nextThought) {
      this.nextThought = now + thoughtDelay(this.store.value.talkativeness) / this.emotions.speechScale();
      if (!blocked) {
        visit(this.memory, now);
        const count = this.memory.pickupsByDay.reduce((n, d) => n + d.count, 0);
        if (this.store.value.memoryEnabled && count >= 5 && Math.random() < .15) this.saySituation('memory_pickups', { count });
        else if (this.store.value.memoryEnabled && [7, 30, 100].includes(this.memory.daysTogether) && this.anniversaryDay !== localDay(now) && this.saySituation('memory_anniversary', { count: this.memory.daysTogether })) this.anniversaryDay = localDay(now);
        else this.saySituation(thoughtSituation(new Date(now)));
      }
    }
    if (!blocked && new Date(now).getHours() < 4 && now >= this.nextLate && powerMonitor.getSystemIdleTime() < 60) {
      this.nextLate = now + 45 * 60000;
      this.saySituation(this.state.awarenessActive && this.sessions.current ? 'late_night_working' : 'sleepy_late');
    }
  }
  checkIdle(): void {
    if (this.conversationQuiet() || this.grab || this.state.paused || !this.state.visible) return;
    const sleeping = powerMonitor.getSystemIdleTime() >= this.store.value.idleToSleepMinutes * 60;
    if (sleeping !== this.state.sleeping) {
      this.cancelReaction(); this.events.emit(sleeping ? 'USER_BECAME_IDLE' : 'USER_RETURNED', undefined);
      console.log('[ducky] User', sleeping ? 'idle' : 'returned'); this.configureTimers(); this.publish();
    }
  }
  setVisible(visible: boolean): void {
    if (visible === this.state.visible) return;
    if (!visible) this.onConversationClose();
    this.endDrag(false); this.state.visible = visible; this.cancelReaction(); this.cancelClicks();
    if (!visible) { this.dismissBubble(); this.window.hide(); }
    else { this.setInteractive(false); this.window.showInactive(); this.setAnimation(this.baseAnimation()); }
    this.configureTimers(); this.publish(); console.log('[ducky] Visible:', visible);
  }
  togglePause(): void {
    this.onConversationClose();
    this.endDrag(false); this.state.paused = !this.state.paused; this.cancelReaction(); this.cancelClicks(); this.dismissBubble();
    this.setAnimation(this.state.paused ? 'idle' : this.baseAnimation()); this.configureTimers(); this.publish();
    console.log('[ducky] Paused:', this.state.paused);
  }
  updateSettings(patch: Partial<EditableSettings>): void {
    if (patch.personality !== undefined || patch.profanity !== undefined || patch.memoryEnabled !== undefined || patch.preferredName !== undefined) { this.brain.revokeContext(); this.dismissBubble(); }
    if (patch.memoryEnabled === false) { this.memoryStore?.configure(false); this.memory = freshMemory(Date.now()); patch.preferredName = ''; this.savedMemory = ''; }
    if (patch.memoryEnabled === true && !this.store.value.memoryEnabled) { this.memoryStore?.configure(true); this.memory = freshMemory(Date.now()); this.emotions.restorePokes(0); this.savedMemory = ''; }
    if (patch.aiEnabled === false) this.dismissBubble();
    if (patch.appAwareness === false) { this.brain.revokeContext(); this.sessions.clear(); this.privateApp = false; this.state.awarenessActive = false; }
    if (patch.mute === true) this.brain.invalidate();
    const sizeChanged = patch.characterSize !== undefined && patch.characterSize !== this.store.value.characterSize;
    if (sizeChanged) this.endDrag(false);
    if (patch.launchAtStartup !== undefined) {
      app.setLoginItemSettings({ openAtLogin: patch.launchAtStartup, path: process.execPath, args: app.isPackaged ? [] : [app.getAppPath()] });
      console.log('[ducky] Launch at startup:', patch.launchAtStartup);
    }
    this.store.update(patch); if (patch.memoryEnabled === false) this.store.flush(); this.state.settings = this.store.value;
    this.saveMemory();
    if (patch.talkativeness) this.nextThought = Date.now() + thoughtDelay(patch.talkativeness) / this.emotions.speechScale();
    if (!this.store.value.walking && this.body.walking) { this.body.walking = false; this.body.vx = 0; this.setAnimation(this.baseAnimation()); }
    if (patch.mute && this.speech.current?.priority === 'low') this.dismissBubble();
    this.applyWindowSettings(); if (sizeChanged) this.recover('character size');
    this.checkIdle(); this.configureTimers(); this.publish(); console.log('[ducky] Settings updated:', Object.keys(patch).join(', '));
  }
  private applyWindowSettings(): void {
    this.window.setAlwaysOnTop(this.store.value.alwaysOnTop && !this.store.value.desktopOnly, 'screen-saver');
  }
  recover(reason: string, reset = false): void {
    if (this.conversationActive) { this.onConversationClose(); this.finishConversation(); }
    this.endDrag(false); this.cancelActivity(); this.cancelReaction();
    this.fall = undefined;
    this.body = reset ? resetPosition(primaryArea(), this.size()) : recover(this.body, workAreas(), this.size());
    if (this.state.productivity?.card || this.state.productivity?.focus || this.state.productivity?.breakMinutes) this.presentConversation(this.state.conversation!);
    this.moveWindow(); this.savePosition(); this.setAnimation(this.state.paused ? 'idle' : this.baseAnimation());
    this.configureTimers(); this.publish(); console.log('[ducky] Position recovered:', reason, this.windowOrigin());
  }
  resume(): void { this.events.emit('APP_RESUMED', undefined); this.recover('system resume'); this.checkIdle(); }
  dispose(): void {
    clearTimeout(this.productivityTimer);
    clearTimeout(this.conversationQuietTimer);
    clearTimeout(this.muteTimer);
    this.memoryStore?.flush();
    this.brain.dispose();
    this.disposed = true; this.cursor.stop(); this.awareness.dispose(); this.context.suspend();
    if (this.hoverTimer) clearTimeout(this.hoverTimer);
    if (this.motionTimer) clearInterval(this.motionTimer);
    if (this.behaviourTimer) clearInterval(this.behaviourTimer);
    if (this.idleTimer) clearInterval(this.idleTimer);
    if (this.emotionTimer) clearInterval(this.emotionTimer);
    this.cancelActivity();
    this.cancelReaction(); this.cancelClicks(); if (this.bubbleTimer) clearTimeout(this.bubbleTimer);
    this.savePosition(); this.store.flush();
  }
}
