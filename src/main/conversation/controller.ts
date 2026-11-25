import { clipboard, dialog, globalShortcut } from 'electron';
import { writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { OllamaError, OllamaProvider } from '../../ai/ollama';
import { parseIntent, flipPronouns } from '../../core/conversation/intents';
import { KeywordRetrieval, keywords } from '../../core/conversation/retrieval';
import { guardedReply } from '../../core/conversation/output';
import { needsReadingPanel } from '../../core/conversation/presentation';
import { CATEGORIES, cleanText, type Category, type Conversation, type ConversationView, type LibraryAction, type ToolCall, type Turn, type UserMemory } from '../../core/conversation/types';
import { TALK_LINES } from '../../core/dialogue/lines';
import type { CompanionController } from '../companion/CompanionController';
import { ToolRegistry } from '../tools';
import { needsClarification } from '../../core/conversation/validation';
import { ConversationEngine } from './engine';
import { ConversationStore } from './store';
import type { ProductivityService } from '../productivity/service';
const line = (kind: keyof typeof TALK_LINES): string => { const pool = TALK_LINES[kind]; return pool[Math.floor(Math.random() * pool.length)]; };
export class ConversationController {
  private view: ConversationView = { active: false, state: null, reply: '', revision: 0, panel: false, shortcutError: '' };
  private turns: Turn[] = []; private modelTurns: Turn[] = []; private startedAt = 0; private sessionId = '';
  private idle?: ReturnType<typeof setTimeout>; private blur?: ReturnType<typeof setTimeout>; private thinking?: ReturnType<typeof setTimeout>; private transition?: ReturnType<typeof setTimeout>;
  private focusTimer?: ReturnType<typeof setTimeout>;
  private focusBlocked = false; private activatingFocus = false; private disposed = false;
  private opening = false; private openRequest = 0;
  private engine?: ConversationEngine; private registry: ToolRegistry;
  private retrieval = new KeywordRetrieval(); private epoch = 0;
  private summaryEpoch = 0;
  private lastSaved?: string; private choices?: UserMemory[]; private confirmation?: ToolCall;
  private registered = ''; private config = '';
  private savedOutput?: { text: string; id: string };
  constructor(private companion: CompanionController, readonly store: ConversationStore, private productivity?: ProductivityService) {
    this.registry = new ToolRegistry([
      ...(productivity?.tools ?? []),
      { name: 'remember', description: 'remember(text:string, category:about_me|preference|project|idea|other), only with explicit user approval', permission: 'confirm', validate: a => typeof a.text === 'string' && a.text.length > 0 && a.text.length <= 4000 && (a.category === undefined || CATEGORIES.includes(a.category as Category)), execute: a => {
        const m = store.add(a.text as string, (a.category as Category) ?? 'other'); this.lastSaved = m.id; return { ok: true, message: `Saved: ${flipPronouns(m.text)}`, data: m };
      } },
      { name: 'forget', description: 'forget(query:string) deletes matching memories after confirmation', permission: 'confirm', validate: a => typeof a.query === 'string' && !!a.query.trim() && a.query.length <= 4000, execute: a => {
        const removed = store.remove(this.matches(a.query as string).map(m => m.id)); return { ok: true, message: removed.length ? `Forgot that ${removed.map(m => flipPronouns(m.text).replace(/[.!?]+$/, '')).join('; ')}.` : 'No matching memory was found. Nothing deleted.' };
      } },
      { name: 'recall_memories', description: 'recall_memories(query:string)', permission: 'safe', validate: a => typeof a.query === 'string', execute: a => { const values = this.retrieval.memories(a.query as string, store.memories, Date.now()); return { ok: true, message: values.length ? values.map(m => `- ${flipPronouns(m.text)}`).join('\n') : 'Nothing remembered yet.', data: values }; } },
      { name: 'recall_conversations', description: 'recall_conversations(query:string)', permission: 'safe', validate: a => typeof a.query === 'string', execute: a => { const values = this.retrieval.conversations(a.query as string, store.conversations, Date.now()).map(c => ({ summary: c.summary, topics: c.topics, endedAt: c.endedAt })); return { ok: true, message: values.length ? values.map(c => c.summary ?? c.topics?.join(', ') ?? 'No summary available.').join('\n') : 'No stored conversations.', data: values }; } },
    ]);
    store.onChanged = () => this.publish();
    companion.window.on('blur', this.onBlur); companion.window.on('focus', this.onFocus);
    this.configure();
  }
  private publish(): void {
    this.companion.state.library = { memories: this.store.memories, conversations: this.store.conversations };
    this.companion.presentConversation({ ...this.view });
  }
  configure(): void {
    const s = this.companion.state.settings;
    const config = JSON.stringify([s.aiEnabled, s.aiModel, s.ollamaPort, s.memoryEnabled, s.conversationRetention, s.personality, s.profanity, s.preferredName]);
    if (this.config !== config) {
      this.config = config; this.cancel(); this.engine = new ConversationEngine(new OllamaProvider(s.ollamaPort), this.registry);
      this.confirmation = undefined; this.choices = undefined;
      if (!s.memoryEnabled) { this.turns = []; this.modelTurns = []; }
      this.store.configure(s.memoryEnabled, s.conversationRetention);
      if (this.view.active) { this.view.state = 'listening'; this.view.reply = ''; this.view.revision++; }
    }
    if (this.registered !== s.conversationShortcut) {
      if (this.registered) globalShortcut.unregister(this.registered);
      this.registered = s.conversationShortcut;
      try { this.view.shortcutError = globalShortcut.register(this.registered, () => { void this.open(); }) ? '' : 'Shortcut unavailable. Choose another combination.'; }
      catch { this.view.shortcutError = 'Could not register this shortcut. Choose another combination.'; }
    }
    this.publish();
  }
  private cancel(): void { this.summaryEpoch++; this.epoch++; this.engine?.cancel(); this.companion.setConversationInference(false); clearTimeout(this.thinking); this.thinking = undefined; }
  private onBlur = (): void => { if (this.view.active) { this.view.inputReady = false; this.publish(); clearTimeout(this.blur); this.blur = setTimeout(() => this.end(), 20000); } };
  private onFocus = (): void => {
    clearTimeout(this.blur); this.blur = undefined;
    if (this.view.active && !this.companion.state.productivity?.card && !this.focusBlocked && !this.activatingFocus) this.focusInput();
  };
  private focusInput(): void {
    if (!this.companion.window.isFocused()) return;
    this.view.focusFailed = false; this.view.inputReady = true; this.view.focusRequest = (this.view.focusRequest ?? 0) + 1; this.publish();
  }
  private restoreTopmost(): void {
    const s = this.companion.state.settings;
    this.companion.window.setAlwaysOnTop(s.alwaysOnTop && !s.desktopOnly, 'screen-saver');
  }
  private touch(): void { clearTimeout(this.idle); this.idle = setTimeout(() => this.end(), 90000); }
  open(): void {
    if (this.disposed || this.opening) return;
    if (this.view.active) { this.activate(); return; }
    this.opening = true; const request = ++this.openRequest;
    this.companion.captureConversationFocus(() => {
      if (this.disposed || request !== this.openRequest) return;
      this.opening = false; this.activate();
    });
  }
  private activate(): void {
    this.productivity?.open(null);
    // Capture the previous foreground window before any activation calls.
    const window = this.companion.window;
    this.focusBlocked = false; this.view.focusFailed = false; clearTimeout(this.focusTimer);
    this.activatingFocus = true;
    window.setFocusable(true); window.show(); window.focus(); window.webContents.focus();
    this.activatingFocus = false;
    if (!this.view.active) {
      ++this.epoch;
      clearTimeout(this.transition); this.summaryEpoch++; this.engine?.cancel(); this.turns = []; this.modelTurns = []; this.lastSaved = undefined; this.choices = undefined; this.confirmation = undefined;
      this.startedAt = Date.now(); this.sessionId = randomUUID();
      this.companion.beginConversation(); this.companion.setConversationInference(false);
      this.view.active = true; this.view.state = 'listening'; this.view.panel = false;
      this.view.inputReady = false;
      this.show(line('talk_greeting'), 'listening', false);
    }
    this.focusInput(); this.touch();
    this.focusTimer = setTimeout(() => {
      if (!this.view.active || this.disposed) return;
      if (window.isFocused()) { this.focusInput(); return; }
      this.activatingFocus = true;
      window.setAlwaysOnTop(true, 'screen-saver'); window.moveTop(); window.focus(); window.webContents.focus();
      this.activatingFocus = false;
      this.focusInput();
      this.focusTimer = setTimeout(() => {
        if (!this.view.active || this.disposed) return;
        this.restoreTopmost();
        if (window.isFocused()) this.focusInput();
        else { this.focusBlocked = true; this.view.focusFailed = true; this.view.inputReady = false; this.publish(); }
      }, 300);
    }, 300);
  }
  typing(): void {
    if (!this.view.active || !this.view.inputReady) return;
    this.touch();
    if (this.view.state !== 'listening' && this.view.state !== 'interrupted') {
      this.cancel(); this.view.reply = ''; this.view.revision++; this.view.state = 'interrupted'; this.view.panel = false; this.publish();
      clearTimeout(this.transition); this.transition = setTimeout(() => { if (this.view.active) { this.view.state = 'listening'; this.publish(); } }, 350);
    }
  }
  copy(): void { clipboard.writeText(this.view.reply); }
  async saveOutput(pinned: boolean) {
    if (!this.view.reply || !this.productivity) return { ok: false, message: 'No reply to save.' };
    const text = this.view.reply;
    const existing = this.savedOutput?.text === text ? this.productivity.store.notes.value.find(n => n.id === this.savedOutput!.id && n.text === text) : undefined;
    if (existing) return pinned && !existing.pinned ? this.productivity.action({ name: 'update_note', args: { id: existing.id, pinned: true } }) : { ok: true, message: 'Already saved.' };
    const result = await this.productivity.action({ name: 'add_note', args: { text, topic: 'saved', pinned } });
    if (result.ok && result.data) this.savedOutput = { text, id: (result.data as { id: string }).id };
    return result;
  }
  panel(expanded: boolean): void { if (this.view.active) { this.view.panel = expanded; this.publish(); } }
  private show(text: string, state: ConversationView['state'] = 'responding', record = true, forceBubble = false): void {
    if (!this.view.active) return;
    text = guardedReply(text);
    this.view.reply = text; this.view.revision++; this.view.state = state; this.view.forceBubble = forceBubble; this.view.panel = !forceBubble && needsReadingPanel(text);
    if (record) this.turns.push({ role: 'assistant', text: this.view.reply.slice(0, 4000), at: Date.now() });
    this.turns = this.turns.slice(-200); this.publish();
  }
  private matches(query: string): UserMemory[] {
    const terms = keywords(query); return this.store.memories.filter(m => m.text.toLowerCase().includes(query.toLowerCase()) || (terms.length > 0 && terms.every(w => keywords(m.text).includes(w))));
  }
  private forget(query: string): void {
    const matches = query ? this.matches(query) : [this.store.memories.find(m => m.id === this.lastSaved) ?? this.store.memories.at(-1)].filter((m): m is UserMemory => !!m);
    if (!matches.length) { this.show('Nothing matching that in my notebook.'); return; }
    if (matches.length > 1) {
      this.choices = matches; this.show(`Which should I forget?\n${matches.map((m, i) => `${i + 1}. ${flipPronouns(m.text).slice(0, matches.length <= 3 ? 36 : 80)}`).join('\n').slice(0, 3500)}\nNumber, all, or none?`, 'unsure', true, matches.length <= 3); return;
    }
    const removed = this.store.remove([matches[0].id]); this.show(removed.length ? `Forgot that ${flipPronouns(removed[0].text).replace(/[.!?]+$/, '')}.` : 'That memory is already gone.');
  }
  async send(input: string): Promise<void> {
    if (!this.view.active || !this.view.inputReady) return;
    const text = cleanText(input); if (text.length > 4000) return;
    this.cancel(); clearTimeout(this.transition); this.touch(); const epoch = this.epoch;
    // A new request replaces the previous temporary card; local intents may open a new one.
    this.productivity?.open(null);
    this.view.reply = ''; this.view.panel = false; this.view.revision++; this.view.state = 'thinking'; this.publish();
    this.turns.push({ role: 'user', text, at: Date.now() }); this.turns = this.turns.slice(-200);
    try {
      if (this.choices && /^(?:\d+|all|none)$/i.test(text)) {
        const choices = this.choices;
        if (/^none$/i.test(text)) { this.choices = undefined; this.show('Nothing deleted.'); return; }
        const selected = /^all$/i.test(text) ? choices : choices[+text - 1] ? [choices[+text - 1]] : [];
        if (!selected.length) { this.show('Pick one of those numbers, all, or none.', 'unsure'); return; }
        const removed = this.store.remove(selected.map(m => m.id)); this.choices = undefined;
        this.show(removed.length ? `Forgot that:\n${removed.map(m => `- ${flipPronouns(m.text)}`).join('\n')}` : 'Those memories are already gone.'); return;
      }
      this.choices = undefined;
      if (this.confirmation && /^(?:yes|no)$/i.test(text)) {
        const call = this.confirmation; this.confirmation = undefined;
        if (/^no$/i.test(text)) { this.show('Cancelled. Nothing changed.'); return; }
        const result = await this.registry.run(call, 0, true);
        if (epoch !== this.epoch || !this.view.active) return;
        this.show(result.message, result.ok ? 'responding' : 'unsure');
        return;
      }
      this.confirmation = undefined;
      if (this.productivity) {
        const productivity = await this.productivity.local(text);
        if (epoch !== this.epoch || !this.view.active) return;
        if (productivity) { this.confirmation = productivity.confirmation; this.show(productivity.message, productivity.ok ? 'responding' : 'unsure'); return; }
      }
      // Numeric productivity choices are handled before the model's input gate.
      if (needsClarification(text)) { this.show(line('talk_huh'), 'confused'); return; }
      const intent = parseIntent(text);
      switch (intent.kind) {
        case 'remember': { const remembered = intent.text || this.turns.at(-2)?.text; if (!remembered) { this.show('What should I remember? Say remember that, then the thing.'); return; } const memory = this.store.add(remembered); this.lastSaved = memory.id; this.show(`Got it. I'll remember: ${flipPronouns(memory.text)}`); return; }
        case 'forget': this.forget(intent.query); return;
        case 'memories': this.show(this.store.memories.length ? this.store.memories.map(m => `- ${flipPronouns(m.text)}`).join('\n') : 'Nothing yet. Tell me something.'); return;
        case 'conversations': {
          let values = [...this.store.conversations].sort((a, b) => b.endedAt - a.endedAt);
          if (intent.when === 'yesterday') { const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1); values = values.filter(c => new Date(c.endedAt).toDateString() === yesterday.toDateString()); }
          values = values.slice(0, intent.when === 'last time' ? 1 : 3);
          this.show(values.length ? values.map(c => `${new Date(c.endedAt).toLocaleDateString()}: ${c.summary ?? c.topics?.join(', ') ?? 'No summary available.'}`).join('\n\n') : 'No saved conversation from then. My notebook has limits.'); return;
        }
        case 'mute': this.companion.muteFor(intent.minutes); this.show(`Quiet time. ${intent.minutes} minutes. Your questions still get answers.`); return;
        case 'end': this.end(); return;
      }
      const s = this.companion.state.settings;
      if (!s.aiEnabled || !s.aiModel) { this.show(line('talk_offline'), 'unsure'); return; }
      // Local commands are archived but never replayed as model requests.
      this.modelTurns.push({ role: 'user', text, at: Date.now() });
      this.modelTurns = this.modelTurns.slice(-200);
      this.thinking = setTimeout(() => { if (epoch === this.epoch && this.view.active) this.show(line('talk_still_thinking'), 'thinking', false); }, 8000);
      const result = await this.engine!.reply({ settings: s, turns: [...this.modelTurns], memories: s.memoryEnabled ? this.retrieval.memories(text, this.store.memories, Date.now()) : [], summaries: s.memoryEnabled ? this.retrieval.conversations(text, this.store.conversations, Date.now()).map(c => ({ summary: c.summary, topics: c.topics, endedAt: c.endedAt })) : [], now: Date.now() });
      if (epoch !== this.epoch || !this.view.active) return;
      this.confirmation = result.confirmation;
      this.show(result.reply, ['neutral', 'warm'].includes(result.tone) ? 'responding' : result.tone as ConversationView['state']);
      this.modelTurns.push({ role: 'assistant', text: this.view.reply, at: Date.now() });
    } catch (error) {
      if (epoch !== this.epoch || !this.view.active) return;
      this.show(!this.companion.state.settings.memoryEnabled && parseIntent(text).kind === 'remember' ? 'Memory is off. Turn it on in Settings before I can save that.' : error instanceof OllamaError && error.reason === 'Not running' ? line('talk_offline') : 'I couldn’t complete that. Nothing confirmed. ' + line('talk_error'), 'unsure');
    } finally { if (epoch === this.epoch) { clearTimeout(this.thinking); this.thinking = undefined; } }
  }
  end(save = true): void {
    this.openRequest++; this.opening = false;
    this.cancel(); if (!this.view.active) return;
    clearTimeout(this.idle); clearTimeout(this.blur); clearTimeout(this.transition); clearTimeout(this.focusTimer);
    this.view.active = false; this.view.state = 'conversation_end'; this.view.panel = false; this.view.reply = save && Math.random() < .4 ? line('talk_signoff') : ''; this.view.revision++;
    this.view.inputReady = false; this.view.focusFailed = false; this.view.forceBubble = false; this.focusBlocked = false;
    // Restore the captured foreground window before relinquishing focusability.
    this.companion.releaseConversationFocus();
    const turns = this.turns; const modelTurns = this.modelTurns; this.turns = []; this.modelTurns = []; this.confirmation = undefined; this.choices = undefined; this.lastSaved = undefined;
    this.publish();
    this.transition = setTimeout(() => { this.view.reply = ''; this.view.state = null; this.publish(); this.companion.finishConversation(); }, this.view.reply ? 3000 : 200);
    if (save && turns.length && this.companion.state.settings.memoryEnabled && this.companion.state.settings.conversationRetention !== 'off') {
      const conversation: Conversation = { id: this.sessionId, startedAt: this.startedAt, endedAt: Date.now(), turns, topics: keywords(turns.filter(t => t.role === 'user').map(t => t.text).join(' ')).slice(0, 6) };
      try { this.store.saveConversation(conversation); }
      catch { this.view.reply = 'I couldn’t save this conversation.'; this.view.revision++; this.publish(); return; }
      const s = this.companion.state.settings; const generation = this.store.generation;
      if (modelTurns.length && s.aiEnabled && s.aiModel && !this.disposed) {
        const summaryEpoch = ++this.summaryEpoch; this.companion.setConversationInference(true);
        void this.engine!.summarize(s.aiModel, modelTurns).then(result => this.store.setSummary(conversation.id, cleanText(result.summary), result.topics.map(cleanText), generation))
          .catch(() => { /* Stored user-only topics remain available offline. */ })
          .finally(() => { if (summaryEpoch === this.summaryEpoch) this.companion.setConversationInference(false); });
      }
    }
  }
  forgetEverything(): void { this.end(false); this.store.clear(); this.turns = []; this.publish(); }
  async library(action: LibraryAction): Promise<void> {
    switch (action.action) {
      case 'add': this.store.add(action.text, action.category, 'user_edited'); break;
      case 'edit': this.store.edit(action.id, action.text, action.category); break;
      case 'delete-memory': this.store.remove([action.id]); break;
      case 'delete-conversation': this.store.deleteConversations(action.id); break;
      case 'delete-conversations': this.store.deleteConversations(); break;
      case 'export': {
        const c = this.store.conversations.find(c => c.id === action.id); if (!c) throw new Error('Conversation missing');
        const result = await dialog.showSaveDialog({ title: 'Export conversation', defaultPath: `Ducky-${new Date(c.startedAt).toISOString().slice(0, 10)}.txt`, filters: [{ name: 'Text', extensions: ['txt'] }] });
        if (!result.canceled && result.filePath) await writeFile(result.filePath, `${c.summary ?? ''}\n\n${c.turns.map(t => `${t.role === 'user' ? 'You' : 'Ducky'}: ${t.text}`).join('\n\n')}`, 'utf8'); break;
      }
    }
  }
  dispose(): void {
    this.disposed = true; this.end(); this.cancel(); clearTimeout(this.transition); clearTimeout(this.idle); clearTimeout(this.blur); clearTimeout(this.focusTimer);
    this.companion.window.removeListener('blur', this.onBlur); this.companion.window.removeListener('focus', this.onFocus);
    if (this.registered) globalShortcut.unregister(this.registered); this.store.dispose();
  }
}
