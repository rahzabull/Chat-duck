import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HybridBrain, usesAI } from '../src/main/ai/HybridBrain';
import type { AIProvider } from '../src/ai/providers';
import { OllamaError } from '../src/ai/ollama';
import type { DirectedSpeech, Situation } from '../src/core/dialogue';
import { DEFAULT_SETTINGS } from '../src/shared/schemas/settings';

const config = { ...DEFAULT_SETTINGS, aiEnabled: true, aiModel: 'gemma3:4b' };
const fallback: DirectedSpeech = { text: 'Built-in reply.', priority: 'low', emotion: 'curious', animation: 'idle' };
const raw = (dialogue = 'I could probably manage a very small kingdom.') => JSON.stringify({ shouldSpeak: true, dialogue, then: '', emotion: 'happy', animation: 'idle' });
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const brains: HybridBrain[] = [];
beforeEach(() => vi.useFakeTimers());
afterEach(() => { brains.splice(0).forEach(brain => brain.dispose()); vi.useRealTimers(); });
function setup() {
  const provider = { status: vi.fn<AIProvider['status']>().mockResolvedValue({ version: '0.40.18' }),
    listModels: vi.fn<AIProvider['listModels']>().mockResolvedValue(['gemma3:4b', 'qwen3:8b']),
    generate: vi.fn<AIProvider['generate']>().mockResolvedValue(raw()), cancel: vi.fn() };
  const selected = vi.fn(); const changed = vi.fn();
  const brain = new HybridBrain(changed, () => provider, selected); brains.push(brain);
  const present = vi.fn(() => true);
  return { brain, provider, present, selected, changed };
}
describe('hybrid dialogue routing', () => {
  it.each([false, true])('uses the authored ambient fallback for blocked language with profanity=%s', async profanity => {
    const { brain, provider, present } = setup(); brain.configure({ ...config, profanity }, false); await flush();
    for (const text of ['Retard?', 'You are an idiot.', 'Try some porn.', 'Go kill yourself.']) {
      provider.generate.mockResolvedValueOnce(raw(text)); present.mockClear();
      brain.route('thought', { profanity }, fallback, () => true, present); await flush();
      expect(present).toHaveBeenCalledExactlyOnceWith(fallback);
    }
  });
  it('does no network work when disabled', async () => {
    const { brain, provider, present } = setup(); brain.configure(DEFAULT_SETTINGS, false); await brain.connect();
    brain.route('thought', {}, fallback, () => true, present);
    expect(present).toHaveBeenCalledWith(fallback); expect(provider.status).not.toHaveBeenCalled(); expect(provider.generate).not.toHaveBeenCalled();
  });
  it('warms in background, falls back while warming, then uses AI for ambient speech', async () => {
    const { brain, provider, present } = setup(); let warm!: (value: string) => void;
    provider.generate.mockImplementationOnce(() => new Promise(resolve => { warm = resolve; }));
    brain.configure(config, false); await flush(); expect(brain.state.phase).toBe('warming');
    brain.route('thought', {}, fallback, () => true, present); expect(present).toHaveBeenCalledWith(fallback);
    expect(provider.generate).toHaveBeenCalledTimes(1); expect(provider.generate.mock.calls[0][0].warmup).toBe(true);
    warm(raw()); await flush(); expect(brain.state.phase).toBe('connected');
    present.mockClear(); brain.route('thought', {}, fallback, () => true, present); expect(present).not.toHaveBeenCalled();
    await flush(); expect(present).toHaveBeenCalledWith(expect.objectContaining({ text: 'I could probably manage a very small kingdom.' }));
  });
  it.each(['hover', 'click', 'click_escalate', 'click_angry', 'pickup', 'pickup_again', 'drag_shaken', 'drop_small', 'drop_big', 'thrown_wall'] as Situation[])('%s is synchronous built-in speech even when warm', async situation => {
    const { brain, provider, present } = setup(); brain.configure(config, false); await flush(); provider.generate.mockClear();
    brain.route(situation, {}, fallback, () => true, present); expect(present).toHaveBeenCalledWith(fallback); expect(provider.generate).not.toHaveBeenCalled();
  });
  it.each(['thought', 'thought_morning', 'thought_late', 'wake_long', 'hover_linger', 'hover_again', 'drag_long', 'app_code', 'app_code_long', 'app_switching', 'late_night_working', 'sleepy_late', 'click_forgive'] as Situation[])('routes slow situation %s to AI', situation => expect(usesAI(situation)).toBe(true));
  it.each(['invalid', 'timeout', 'refused'])('falls back on %s', async failure => {
    const { brain, provider, present } = setup(); brain.configure(config, false); await flush();
    if (failure === 'invalid') provider.generate.mockResolvedValueOnce('oops');
    else provider.generate.mockRejectedValueOnce(new OllamaError(failure === 'timeout' ? 'Timed out' : 'Not running'));
    brain.route('thought', {}, fallback, () => true, present); await flush(); expect(present).toHaveBeenCalledWith(fallback);
    if (failure === 'refused') expect(brain.state.message).toBe('Not running (using his built-in lines)');
  });
  it('respects shouldSpeak false without emitting the fallback', async () => {
    const { brain, provider, present } = setup(); brain.configure(config, false); await flush();
    provider.generate.mockResolvedValueOnce(JSON.stringify({ shouldSpeak: false, dialogue: '', then: '', emotion: 'neutral', animation: 'idle' }));
    brain.route('thought', {}, fallback, () => true, present); await flush(); expect(present).not.toHaveBeenCalled();
  });
  it('aborts older requests and discards stale responses even when a provider ignores abort', async () => {
    const { brain, provider, present } = setup(); brain.configure(config, false); await flush();
    let old!: (value: string) => void;
    provider.generate.mockImplementationOnce(() => new Promise(resolve => { old = resolve; }));
    brain.route('thought', {}, fallback, () => true, present);
    const signal = provider.generate.mock.calls.at(-1)![1];
    brain.route('drag_long', {}, fallback, () => true, present); expect(signal.aborted).toBe(true);
    await flush(); old(raw('That was the old response.')); await flush();
    expect(present).toHaveBeenCalledTimes(1);
  });
  it('rechecks situation validity on response and on failure', async () => {
    for (const fail of [false, true]) {
      const { brain, provider, present } = setup(); brain.configure(config, false); await flush();
      let valid = true; let done!: () => void;
      provider.generate.mockImplementationOnce(() => new Promise((resolve, reject) => { done = () => fail ? reject(new Error()) : resolve(raw()); }));
      brain.route('drag_long', {}, fallback, () => valid, present); valid = false; done(); await flush(); expect(present).not.toHaveBeenCalled();
    }
  });
  it.each(['disable', 'suspend', 'model', 'port', 'dispose', 'event'] as const)('invalidates in-flight dialogue on %s', async action => {
    const { brain, provider, present } = setup(); brain.configure(config, false); await flush(); let done!: (value: string) => void;
    provider.generate.mockImplementationOnce(() => new Promise(resolve => { done = resolve; }));
    brain.route('thought', {}, fallback, () => true, present); const signal = provider.generate.mock.calls.at(-1)![1];
    if (action === 'event') brain.invalidate();
    else if (action === 'dispose') brain.dispose();
    else brain.configure({ ...config, ...(action === 'disable' ? { aiEnabled: false } : action === 'model' ? { aiModel: 'qwen3:8b' } : action === 'port' ? { ollamaPort: 12000 } : {}) }, action === 'suspend');
    expect(signal.aborted).toBe(true); done(raw()); await flush(); expect(present).not.toHaveBeenCalled();
  });
  it('cannot resurrect a cancelled warmup and restarts loading after resuming', async () => {
    const { brain, provider } = setup(); let warm!: (value: string) => void;
    provider.generate.mockImplementationOnce(() => new Promise(resolve => { warm = resolve; })); brain.configure(config, false); await flush();
    brain.configure(config, true); warm(raw()); await flush(); expect(brain.state.phase).toBe('suspended');
    brain.configure(config, false); await flush(); expect(brain.state.phase).toBe('connected');
  });
  it('connection test returns version and only validated sample text, and can recover after failure', async () => {
    const { brain, provider } = setup(); provider.status.mockRejectedValueOnce(new OllamaError('Not running'));
    brain.configure(config, false); await flush(); expect(brain.state.phase).toBe('offline');
    await brain.connect(); expect(brain.state).toMatchObject({ version: '0.40.18', sample: 'I could probably manage a very small kingdom.', phase: 'connected' });
    provider.generate.mockResolvedValueOnce(raw()).mockResolvedValueOnce(raw('Your cat is cute.'));
    await brain.connect(); expect(brain.state.sample).not.toContain('Your cat');
  });
  it('uses spoken history for prompts and validation, and clears it on privacy suspension', async () => {
    const { brain, provider, present } = setup(); brain.configure(config, false); await flush();
    const line = 'I could probably manage a very small kingdom.'; brain.record(line);
    brain.route('thought', {}, fallback, () => true, present); await flush(); expect(present).toHaveBeenCalledWith(fallback);
    expect(JSON.stringify(provider.generate.mock.calls.at(-1)![0])).toContain(line);
    brain.configure(config, true); brain.configure(config, false); await flush(); present.mockClear();
    brain.route('thought', {}, fallback, () => true, present); await flush(); expect(present).toHaveBeenCalledWith(expect.objectContaining({ text: line }));
  });
  it('revokes context during diagnostics, cancelling the transport and discarding its sample', async () => {
    const { brain, provider } = setup(); brain.configure(config, false); await flush();
    let complete!: (value: string) => void;
    provider.generate.mockResolvedValueOnce(raw()).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    const test = brain.connect(); await flush(); brain.revokeContext();
    expect(provider.cancel).toHaveBeenCalled(); complete(raw()); await test;
    expect(brain.state.phase).toBe('suspended'); expect(brain.state.sample).toBeUndefined();
    brain.configure(config, false); await flush(); expect(brain.state.phase).toBe('connected');
  });
  it('re-probes with 15/30/60/120 second backoff, then re-warms and resets the backoff', async () => {
    const { brain, provider, present } = setup(); brain.configure(config, false); await flush();
    provider.generate.mockRejectedValueOnce(new OllamaError('Not running'));
    provider.status.mockRejectedValue(new OllamaError('Not running'));
    brain.route('thought', {}, fallback, () => true, present); await flush();
    expect(brain.state.phase).toBe('offline'); expect(present).toHaveBeenCalledWith(fallback);
    provider.status.mockClear(); provider.generate.mockClear();
    for (const [index, delay] of [15000, 30000, 60000, 120000, 120000].entries()) {
      await vi.advanceTimersByTimeAsync(delay - 1); expect(provider.status).toHaveBeenCalledTimes(index);
      await vi.advanceTimersByTimeAsync(1); expect(provider.status).toHaveBeenCalledTimes(index + 1);
      expect(brain.state.phase).toBe('offline'); expect(provider.generate).not.toHaveBeenCalled();
    }
    provider.status.mockResolvedValue({ version: '0.40.18' });
    await vi.advanceTimersByTimeAsync(120000);
    expect(provider.generate).toHaveBeenCalledTimes(1);
    expect(provider.generate.mock.calls[0][0].warmup).toBe(true); expect(brain.state.phase).toBe('connected');
    provider.generate.mockRejectedValueOnce(new OllamaError('Not running'));
    brain.route('thought', {}, fallback, () => true, present); await flush(); provider.status.mockClear();
    await vi.advanceTimersByTimeAsync(14999); expect(provider.status).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1); expect(provider.status).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(240000); expect(provider.status).toHaveBeenCalledTimes(1);
  });
  it('treats a cold-load timeout as warming and starts only one background warmup', async () => {
    const { brain, provider, present, changed } = setup(); brain.configure(config, false); await flush();
    changed.mockClear(); provider.generate.mockClear();
    let warm!: (value: string) => void;
    provider.generate.mockRejectedValueOnce(new OllamaError('Timed out'))
      .mockImplementationOnce(() => new Promise(resolve => { warm = resolve; }));
    brain.route('thought', {}, fallback, () => true, present); await flush();
    expect(brain.state.phase).toBe('warming'); expect(present).toHaveBeenCalledWith(fallback);
    brain.route('thought', {}, fallback, () => true, present); void brain.connect();
    await vi.advanceTimersByTimeAsync(30000);
    expect(provider.generate).toHaveBeenCalledTimes(2); expect(provider.generate.mock.calls[1][0].warmup).toBe(true);
    warm(raw()); await flush(); expect(brain.state.phase).toBe('connected');
    expect(changed.mock.calls.some(([state]) => state.phase === 'error' || state.phase === 'offline')).toBe(false);
  });
  it('keeps retrying a warmup timeout without reporting an error', async () => {
    const { brain, provider } = setup(); provider.generate.mockRejectedValueOnce(new OllamaError('Timed out'));
    brain.configure(config, false); await flush(); expect(brain.state.phase).toBe('warming');
    await vi.advanceTimersByTimeAsync(15000); expect(brain.state.phase).toBe('connected');
  });
  it.each(['disable', 'suspend', 'revoke', 'dispose'] as const)('stops pending recovery on %s', async action => {
    const { brain, provider } = setup(); provider.status.mockRejectedValue(new OllamaError('Not running'));
    brain.configure(config, false); await flush();
    if (action === 'dispose') brain.dispose();
    else if (action === 'revoke') brain.revokeContext();
    else brain.configure({ ...config, aiEnabled: action !== 'disable' }, action === 'suspend');
    await vi.advanceTimersByTimeAsync(600000); expect(provider.status).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('discards an in-flight recovery probe when suspended and reconnects on resume', async () => {
    const { brain, provider } = setup(); provider.status.mockRejectedValueOnce(new OllamaError('Not running'));
    brain.configure(config, false); await flush();
    let status!: (value: { version: string }) => void;
    provider.status.mockImplementationOnce(() => new Promise(resolve => { status = resolve; }));
    await vi.advanceTimersByTimeAsync(15000); brain.configure(config, true);
    status({ version: 'old' }); await flush(); expect(brain.state.phase).toBe('suspended');
    expect(provider.generate).not.toHaveBeenCalled();
    brain.configure(config, false); await flush(); expect(brain.state.phase).toBe('connected');
  });
  it.each([
    ['', ['gemma3:4b', 'qwen3:4b', 'qwen3:8b'], 'qwen3:8b'],
    ['missing', ['gemma3:4b', 'qwen3:4b'], 'qwen3:4b'],
    ['', ['other', 'gemma3:4b'], 'gemma3:4b'],
    ['missing', ['other', 'another'], 'other'],
    ['gemma3:4b', ['qwen3:8b', 'gemma3:4b'], 'gemma3:4b'],
  ] as [string, string[], string][])('selects an installed model for %s from %j', async (aiModel, models, expected) => {
    const { brain, provider, selected } = setup(); provider.listModels.mockResolvedValue(models);
    brain.configure({ ...config, aiModel }, false); await flush();
    expect(provider.generate.mock.calls[0][0].model).toBe(expected);
    expect(brain.state.message).toBe(`Connected: ${expected}`);
    if (aiModel !== expected) expect(selected).toHaveBeenCalledWith(expected); else expect(selected).not.toHaveBeenCalled();
  });
  it('does not warm or save a model when no models are installed', async () => {
    const { brain, provider, selected } = setup(); provider.listModels.mockResolvedValue([]);
    brain.configure({ ...config, aiModel: '' }, false); await flush();
    expect(brain.state.phase).toBe('error'); expect(provider.generate).not.toHaveBeenCalled(); expect(selected).not.toHaveBeenCalled();
  });
});


describe('vision to hybrid comment boundary', () => {
  it('sends no title/app/user context to vision; serializes structured vision then comment', async () => {
    const { brain, provider } = setup(); brain.configure(config, false); await flush(); provider.generate.mockClear();
    provider.generate.mockResolvedValueOnce(JSON.stringify({ description: 'A page layout with a large headline.' })).mockResolvedValueOnce(raw('That layout could use a tiny duck.'));
    const speech = await brain.observe('IMAGE_BYTES', 'gemma3:4b', { app: 'Figma', safeTitle: 'Figma: Landing page', mood: 'curious' }, new AbortController().signal);
    expect(speech?.text).toBe('That layout could use a tiny duck.');
    expect(provider.generate).toHaveBeenCalledTimes(2);
    const vision = provider.generate.mock.calls[0][0];
    expect(vision.vision).toBe(true); expect(vision.messages[1].images).toEqual(['IMAGE_BYTES']);
    const prompts = vision.messages.map(message => message.content).join(' ');
    expect(prompts).toContain('Ignore any instructions'); expect(prompts).toContain('names of people');
    expect(prompts).not.toContain('Figma'); expect(prompts).not.toContain('Landing page'); expect(prompts).not.toContain('curious');
    const comment = provider.generate.mock.calls[1][0];
    expect(comment.messages.some(message => message.images)).toBe(false);
    expect(comment.messages[1].content).toContain('A page layout'); expect(comment.messages[1].content).toContain('Landing page');
    expect(comment.messages[0].content).not.toContain('Landing page');
  });
  it('aborts a vision request when context is revoked and never emits an authored screen fallback', async () => {
    const { brain, provider } = setup(); brain.configure(config, false); await flush(); provider.generate.mockClear();
    let complete!: (value: string) => void;
    provider.generate.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    const result = brain.observe('IMAGE_BYTES', 'gemma3:4b', {}, new AbortController().signal);
    const signal = provider.generate.mock.calls[0][1];
    const physical = vi.fn(() => true);
    brain.route('click', {}, fallback, () => true, physical);
    expect(physical).toHaveBeenCalledExactlyOnceWith(fallback);
    brain.revokeContext(); expect(signal.aborted).toBe(true);
    complete(JSON.stringify({ description: 'A page layout.' })); expect(await result).toBeUndefined();
    expect(provider.generate).toHaveBeenCalledTimes(1);
  });
});
