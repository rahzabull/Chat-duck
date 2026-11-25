import { OllamaError, OllamaProvider } from '../../ai/ollama';
import { buildContext, buildPrompt } from '../../ai/prompts';
import type { AIProvider } from '../../ai/providers';
import { validateResponse } from '../../ai/response-validation';
import type { DialogueContext, DirectedSpeech, Situation } from '../../core/dialogue';
import { LINES } from '../../core/dialogue/lines';
import type { BrainState, Settings } from '../../shared/types';

export const usesAI = (situation: Situation): boolean => situation.startsWith('app_') || [
  'thought', 'thought_morning', 'thought_late', 'wake_long', 'hover_linger', 'hover_again', 'drag_long',
  'late_night_working', 'sleepy_late', 'click_forgive',
].includes(situation);
type Config = Pick<Settings, 'aiEnabled' | 'aiModel' | 'ollamaPort'> & Partial<Pick<Settings, 'personality' | 'profanity'>>;
export const initialBrainState = (): BrainState => ({ phase: 'disabled', message: 'Built-in lines active', models: [] });

const preferredModels = ['qwen3:8b', 'qwen3:4b', 'gemma3:4b'];
const retryDelays = [15000, 30000, 60000, 120000];

/** Main-process owner of inference, diagnostics, and suspended-aware recovery. */
export class HybridBrain {
  state = initialBrainState();
  private config: Config = { aiEnabled: false, aiModel: '', ollamaPort: 11434 };
  private voice: DialogueContext = {};
  private provider?: AIProvider;
  private suspended = false;
  private epoch = 0;
  private generation = 0;
  private pending?: AbortController;
  private recent: string[] = [];
  private retryTimer?: ReturnType<typeof setTimeout>;
  private retryAttempt = 0;
  private connecting?: Promise<void>;
  private disposed = false;
  constructor(private changed: (state: BrainState) => void,
    private factory: (port: number) => AIProvider = port => new OllamaProvider(port),
    private selectModel: (model: string) => void = () => {}) {}
  private update(patch: Partial<BrainState>): void { this.state = { ...this.state, ...patch }; this.changed(this.state); }
  record(text: string): void { this.recent = [...this.recent, text].slice(-20); }
  clearHistory(): void { this.recent = []; if (this.state.sample !== undefined) this.update({ sample: undefined }); }
  /** A new event invalidates dialogue, but does not interrupt background model loading. */
  invalidate(): void { this.generation++; this.pending?.abort(); this.pending = undefined; }
  private stop(): void {
    this.epoch++; this.invalidate(); this.provider?.cancel(); this.connecting = undefined;
    if (this.retryTimer !== undefined) clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
  }
  revokeContext(): void {
    this.stop(); this.clearHistory();
    // Force the next configure to restart without the revoked history, even if
    // the interrupted operation was a Settings diagnostic or model warmup.
    this.suspended = true;
    this.update({ phase: 'suspended', message: 'Built-in lines active (AI paused)' });
  }
  configure(config: Config, suspended: boolean): void {
    if (this.disposed) return;
    this.voice = { personality: config.personality, profanity: config.profanity };
    const different = config.aiEnabled !== this.config.aiEnabled || config.aiModel !== this.config.aiModel || config.ollamaPort !== this.config.ollamaPort;
    if (!different && suspended === this.suspended) return;
    this.stop(); this.retryAttempt = 0; this.config = { aiEnabled: config.aiEnabled, aiModel: config.aiModel, ollamaPort: config.ollamaPort }; this.suspended = suspended;
    if (different) { this.provider = undefined; this.update({ models: [], version: undefined, sample: undefined }); }
    if (!config.aiEnabled) { this.clearHistory(); this.update({ phase: 'disabled', message: 'Built-in lines active' }); return; }
    if (suspended) { this.clearHistory(); this.update({ phase: 'suspended', message: 'Built-in lines active (AI paused)' }); return; }
    this.provider ??= this.factory(config.ollamaPort);
    void this.connect(false);
  }
  private retry(): void {
    if (this.disposed || !this.config.aiEnabled || this.suspended || this.retryTimer !== undefined) return;
    const delay = retryDelays[Math.min(this.retryAttempt++, retryDelays.length - 1)];
    this.retryTimer = setTimeout(() => { this.retryTimer = undefined; void this.connect(false); }, delay);
  }
  private failure(error: unknown, probing = false): void {
    const reason = error instanceof OllamaError ? error.reason : 'Request failed';
    if (reason === 'Not running' || (probing && reason === 'Timed out')) {
      this.update({ phase: 'offline', message: 'Not running (using his built-in lines)' }); this.retry();
    } else if (reason === 'Timed out') {
      this.update({ phase: 'warming', message: 'Warming up...' }); this.retry();
    } else this.update({ phase: 'error', message: `Error: ${reason} (using his built-in lines)` });
  }
  async connect(test = true): Promise<void> {
    if (this.disposed || !this.config.aiEnabled || this.suspended || !this.provider) return;
    if (this.connecting) return this.connecting;
    const task = this.establish(test);
    this.connecting = task;
    try { await task; } finally { if (this.connecting === task) this.connecting = undefined; }
  }
  private async establish(test: boolean): Promise<void> {
    this.stop(); const epoch = this.epoch; const provider = this.provider;
    if (!provider) return;
    const valid = () => epoch === this.epoch;
    let probing = true;
    if (this.state.phase !== 'offline') this.update({ phase: 'warming', message: 'Warming up...', sample: undefined });
    try {
      const { version } = await provider.status(); if (!valid()) return;
      this.update({ phase: 'warming', message: 'Warming up...', sample: undefined });
      const models = await provider.listModels(); if (!valid()) return;
      this.update({ version, models });
      if (!models.includes(this.config.aiModel)) {
        const model = preferredModels.find(name => models.includes(name)) ?? models[0];
        if (!model) throw new OllamaError('Model missing');
        this.config.aiModel = model; this.selectModel(model);
        if (!valid()) return;
      }
      probing = false;
      await provider.generate({ model: this.config.aiModel, warmup: true, messages: [
        { role: 'user', content: 'Return JSON: shouldSpeak false, dialogue empty, then empty, emotion neutral, animation idle.' },
      ] }, new AbortController().signal);
      if (!valid()) return;
      if (test) {
        const context = buildContext('thought', this.voice);
        const raw = await provider.generate(buildPrompt(this.config.aiModel, context, this.recent), new AbortController().signal);
        if (!valid()) return;
        const result = validateResponse(raw, context, this.recent);
        this.update({ sample: result.kind === 'speech' ? result.speech.text : result.kind === 'silent' ? '(Ducky chose silence.)' : `(Rejected sample; built-in line: ${LINES.thought[0].text})` });
      }
      this.retryAttempt = 0;
      this.update({ phase: 'connected', message: `Connected: ${this.config.aiModel}` });
    } catch (error) { if (valid()) this.failure(error, probing); }
  }
  /** Called only after the director and interruption gate accepted this event. */
  route(situation: Situation, context: DialogueContext, fallback: DirectedSpeech, validSituation: () => boolean, present: (speech: DirectedSpeech) => boolean): void {
    this.invalidate();
    if (!usesAI(situation) || this.state.phase !== 'connected' || !this.provider) { present(fallback); return; }
    const token = this.generation; const epoch = this.epoch; const controller = new AbortController(); this.pending = controller;
    const valid = () => token === this.generation && epoch === this.epoch && !controller.signal.aborted && validSituation();
    const data = buildContext(situation, context);
    void this.provider.generate(buildPrompt(this.config.aiModel, data, this.recent), controller.signal).then(raw => {
      if (!valid()) return;
      const result = validateResponse(raw, data, this.recent);
      this.update({ message: `Connected: ${this.config.aiModel}${result.kind === 'invalid' ? ' (using his built-in lines)' : ''}` });
      if (result.kind === 'silent') return;
      present(result.kind === 'speech' ? result.speech : fallback);
    }).catch(error => {
      if (!valid()) return;
      if (error instanceof OllamaError && error.reason === 'Timed out') {
        // A short inference deadline also covers models evicted by keep_alive.
        // Loading uses the longer warmup deadline and never blocks this line.
        void this.connect(false);
      } else this.failure(error);
      present(fallback);
    }).finally(() => { if (this.pending === controller) this.pending = undefined; });
  }
  dispose(): void { this.disposed = true; this.stop(); this.recent = []; }
}
