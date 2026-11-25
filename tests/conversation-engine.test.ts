import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConversationEngine, conversationPrompt, type EngineContext } from '../src/main/conversation/engine';
import { ToolRegistry, type Tool } from '../src/main/tools';
import { DEFAULT_SETTINGS } from '../src/shared/schemas/settings';
import type { AIProvider } from '../src/ai/providers';
import { OllamaProvider } from '../src/ai/ollama';
import { CONVERSATION_SCHEMA, conversationSchema } from '../src/core/conversation/validation';
import { TALK_LINES } from '../src/core/dialogue/lines';
const context: EngineContext = { settings: { ...DEFAULT_SETTINGS, aiEnabled: true, aiModel: 'qwen3:8b' }, turns: [{ role: 'user', text: 'Explain recursion', at: Date.now() }], memories: [], summaries: [], now: Date.now() };
const response = (reply = 'A function calling itself.', tool: object | null = null) => JSON.stringify({ reply, tone: 'explaining', tool });
const provider = (): AIProvider => ({ status: vi.fn(), listModels: vi.fn(), cancel: vi.fn(), generate: vi.fn() });
const tool = (permission: Tool['permission'] = 'safe'): Tool => ({ name: 'remember', description: 'save a memory', permission, validate: a => typeof a.text === 'string', execute: vi.fn(() => ({ ok: true, message: 'Saved the exact requested memory.' })) });
afterEach(() => vi.useRealTimers());
describe('tool permissions and honest results', () => {
  it('does not echo a tool name or serialized arguments for generic confirmations', async () => {
    const t = { ...tool('confirm'), name: 'internal_action' };
    const result = await new ToolRegistry([t]).run({ name: t.name, args: { text: 'example', secret: 'details' } }, 0);
    expect(result.message).toBe('Allow this action? Reply yes or no.');
    expect(result.confirmation?.name).toBe(t.name); expect(t.execute).not.toHaveBeenCalled();
  });
  it('rejects technical text in confirmation arguments without leaving an invisible pending approval', async () => {
    const t = tool('confirm');
    const result = await new ToolRegistry([t]).run({ name: t.name, args: { text: '{"query":"tea"}' } }, 0);
    expect(TALK_LINES.talk_error).toContain(result.message);
    expect(result.confirmation).toBeUndefined(); expect(t.execute).not.toHaveBeenCalled();
  });
  it.each(['safe', 'confirm', 'blocked'] as const)('enforces %s permission', async permission => {
    const t = tool(permission); const registry = new ToolRegistry([t]);
    const result = await registry.run({ name: 'remember', args: { text: 'nights' } }, 0);
    expect(result.ok).toBe(permission === 'safe');
    expect(t.execute).toHaveBeenCalledTimes(permission === 'safe' ? 1 : 0);
    if (permission === 'confirm') {
      expect(result.confirmation?.name).toBe('remember');
      expect((await registry.run(result.confirmation!, 0, true)).ok).toBe(true);
    }
    if (permission === 'blocked') expect((await registry.run({ name: 'remember', args: { text: 'nights' } }, 0, true)).ok).toBe(false);
  });
  it('enforces round limits, validates arguments, rejects unknown tools and catches failed writes', async () => {
    const t = tool(); const registry = new ToolRegistry([t]);
    expect((await registry.run({ name: 'remember', args: { text: 'x' } }, 2)).ok).toBe(false);
    expect((await registry.run({ name: 'remember', args: {} }, 0)).ok).toBe(false);
    expect((await registry.run({ name: 'shell', args: {} }, 0)).ok).toBe(false);
    expect(t.execute).not.toHaveBeenCalled();
    vi.mocked(t.execute).mockImplementation(() => { throw new Error('Disk full'); });
    const result = await registry.run({ name: 'remember', args: { text: 'x' } }, 0);
    expect(result.ok).toBe(false); expect(result.message).toContain('failed');
  });
});
describe('conversation engine with fake provider', () => {
  it('exposes productivity tools in the constrained schema and returns the real mutation result', async () => {
    const p = provider(); const t: Tool = { name: 'add_task', description: 'add_task(title:string)', permission: 'safe', validate: a => typeof a.title === 'string', execute: () => ({ ok: true, message: 'Added: insurance' }) };
    vi.mocked(p.generate).mockResolvedValueOnce(response('Let me save that.', { name: 'add_task', args: { title: 'insurance' } })).mockResolvedValueOnce(response('I booked you a flight too.'));
    const result = await new ConversationEngine(p, new ToolRegistry([t])).reply(context);
    expect(result.reply).toBe('Added: insurance');
    expect(vi.mocked(p.generate).mock.calls[0][0].format).toEqual(conversationSchema(['add_task']));
  });
  it.each(['I added that task.', 'I updated the note.', 'Reminder created.', 'Timer started.'])('blocks unverified productivity acknowledgement: %s', async text => {
    const p = provider(); vi.mocked(p.generate).mockResolvedValue(response(text));
    expect((await new ConversationEngine(p, new ToolRegistry([])).reply(context)).reply).not.toBe(text);
  });
  it.each([false, true])('regenerates unsafe output once with profanity=%s', async profanity => {
    const p = provider(); vi.mocked(p.generate).mockResolvedValueOnce(response('Retard?')).mockResolvedValueOnce(response('Say that again?'));
    const result = await new ConversationEngine(p, new ToolRegistry([])).reply({ ...context, settings: { ...context.settings, profanity } });
    expect(result.reply).toBe('Say that again?'); expect(p.generate).toHaveBeenCalledTimes(2);
    const retry = vi.mocked(p.generate).mock.calls[1][0];
    expect(retry.messages.at(-1)?.content).toContain('your last reply contained a disallowed word');
    expect(JSON.stringify(retry)).not.toContain('Retard?');
  });
  it.each(['r3tard', 'idiot', 'stupid?', 'porn', 'kill yourself'])('uses talk_error after a second unsafe reply %s', async text => {
    const p = provider(); vi.mocked(p.generate).mockResolvedValue(response(text));
    const result = await new ConversationEngine(p, new ToolRegistry([])).reply(context);
    expect(TALK_LINES.talk_error).toContain(result.reply); expect(result.tool).toBeNull(); expect(p.generate).toHaveBeenCalledTimes(2);
  });
  it('rejects unsafe tool arguments before confirmation or execution', async () => {
    const p = provider(); const t = tool(); vi.mocked(p.generate).mockResolvedValue(response('Here is a memory.', { name: 'remember', args: { text: 'r3tard' } }));
    const result = await new ConversationEngine(p, new ToolRegistry([t])).reply(context);
    expect(TALK_LINES.talk_error).toContain(result.reply); expect(t.execute).not.toHaveBeenCalled(); expect(result.confirmation).toBeUndefined();
  });
  it('validates every tool round without resetting the safety retry budget', async () => {
    const p = provider(); const t = tool();
    vi.mocked(p.generate).mockResolvedValueOnce(response('Idiot?')).mockResolvedValueOnce(response('Looking that up.', { name: 'remember', args: { text: 'tea' } })).mockResolvedValueOnce(response('stupid?'));
    const result = await new ConversationEngine(p, new ToolRegistry([t])).reply(context);
    expect(TALK_LINES.talk_error).toContain(result.reply); expect(p.generate).toHaveBeenCalledTimes(3);
  });
  it.each([
    { summary: 'Retard?', topics: ['one', 'two', 'three'] },
    { summary: 'A safe summary.', topics: ['one', 'porn', 'three'] },
  ])('rejects unsafe summaries and topics before persistence', async value => {
    const p = provider(); vi.mocked(p.generate).mockResolvedValue(JSON.stringify(value));
    await expect(new ConversationEngine(p, new ToolRegistry([])).summarize('model', context.turns)).rejects.toThrow('Disallowed');
  });
  it('answers with bounded context and required prompt rules', async () => {
    const p = provider(); vi.mocked(p.generate).mockResolvedValue(response());
    const engine = new ConversationEngine(p, new ToolRegistry([]));
    const result = await engine.reply({ ...context, turns: Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: String(i), at: 1 })) });
    expect(result.reply).toContain('function');
    const request = vi.mocked(p.generate).mock.calls[0][0];
    expect(request.messages).toHaveLength(13); expect(request.messages[1].content).toBe('18');
    expect(request.conversation).toBe(true); expect(request.format).toEqual(conversationSchema([]));
    const prompt = conversationPrompt(context, new ToolRegistry([]));
    expect(prompt).toContain('cannot browse'); expect(prompt).toContain('correct and useful first'); expect(prompt).toContain('Do not swear');
  });
  it('aborts a previous request even if a provider ignores cancellation', async () => {
    const p = provider(); vi.mocked(p.generate).mockImplementationOnce(() => new Promise(() => {})).mockResolvedValueOnce(response('Second answer'));
    const engine = new ConversationEngine(p, new ToolRegistry([]));
    const first = engine.reply(context); const rejected = expect(first).rejects.toThrow('Cancelled');
    expect((await engine.reply(context)).reply).toBe('Second answer'); await rejected;
    expect(vi.mocked(p.generate).mock.calls[0][1].aborted).toBe(true);
  });
  it('has a 45 second deadline and releases timers', async () => {
    vi.useFakeTimers(); const p = provider(); vi.mocked(p.generate).mockImplementation(() => new Promise(() => {}));
    const pending = new ConversationEngine(p, new ToolRegistry([])).reply(context);
    const rejection = expect(pending).rejects.toThrow('Timed out');
    await vi.advanceTimersByTimeAsync(45000); await rejection; expect(vi.getTimerCount()).toBe(0);
  });
  it('rejects invalid JSON and unknown tools', async () => {
    const p = provider(); const engine = new ConversationEngine(p, new ToolRegistry([]));
    vi.mocked(p.generate).mockResolvedValueOnce('not JSON'); await expect(engine.reply(context)).rejects.toThrow();
    vi.mocked(p.generate).mockResolvedValueOnce(response('Done', { name: 'shell', args: {} })); await expect(engine.reply(context)).rejects.toThrow('Unknown');
  });
  it('does not repeat an unverified action acknowledgement without a tool result', async () => {
    const p = provider(); vi.mocked(p.generate).mockResolvedValue(response("I've saved that memory and emailed your boss."));
    const result = await new ConversationEngine(p, new ToolRegistry([])).reply(context);
    expect(result.reply).toContain('haven’t performed'); expect(result.reply).not.toContain('emailed');
  });
  it('feeds actual tool results back and uses authoritative mutation acknowledgements', async () => {
    const p = provider(); const t = tool();
    vi.mocked(p.generate).mockResolvedValueOnce(response('Saved!', { name: 'remember', args: { text: 'night work' } })).mockResolvedValueOnce(response('I also emailed your boss.'));
    const result = await new ConversationEngine(p, new ToolRegistry([t])).reply(context);
    expect(t.execute).toHaveBeenCalledOnce(); expect(result.reply).toBe('Saved the exact requested memory.');
    expect(vi.mocked(p.generate).mock.calls[1][0].messages.at(-1)?.content).toContain('TOOL_RESULT');
  });
  it('bypasses model-generated success after tool failure', async () => {
    const p = provider(); const t = tool(); vi.mocked(t.execute).mockImplementation(() => { throw new Error('write denied'); });
    vi.mocked(p.generate).mockResolvedValue(response('Successfully saved!', { name: 'remember', args: { text: 'x' } }));
    const result = await new ConversationEngine(p, new ToolRegistry([t])).reply(context);
    expect(result.reply).toContain('failed'); expect(result.reply).not.toContain('Successfully'); expect(p.generate).toHaveBeenCalledOnce();
  });
  it('requires confirmation and executes no tool on the proposal', async () => {
    const p = provider(); const t = tool('confirm'); vi.mocked(p.generate).mockResolvedValue(response('Saved already', { name: 'remember', args: { text: 'x' } }));
    const result = await new ConversationEngine(p, new ToolRegistry([t])).reply(context);
    expect(result.confirmation?.name).toBe('remember'); expect(result.reply).toContain('yes or no'); expect(t.execute).not.toHaveBeenCalled();
  });
  it('allows at most two execution rounds', async () => {
    const p = provider(); const t = tool(); vi.mocked(p.generate).mockResolvedValue(response('Again', { name: 'remember', args: { text: 'x' } }));
    await new ConversationEngine(p, new ToolRegistry([t])).reply(context);
    expect(t.execute).toHaveBeenCalledTimes(2); expect(p.generate).toHaveBeenCalledTimes(3);
  });
  it('retains the successful result if the final answer is invalid', async () => {
    const p = provider(); const t = tool(); vi.mocked(p.generate).mockResolvedValueOnce(response('Proposal', { name: 'remember', args: { text: 'x' } })).mockResolvedValueOnce('invalid');
    expect((await new ConversationEngine(p, new ToolRegistry([t])).reply(context)).reply).toBe('Saved the exact requested memory.');
  });
  it('reports an already completed tool honestly when final prose times out', async () => {
    vi.useFakeTimers(); const p = provider(); const t = tool();
    vi.mocked(p.generate).mockResolvedValueOnce(response('Proposal', { name: 'remember', args: { text: 'x' } })).mockImplementationOnce(() => new Promise(() => {}));
    const pending = new ConversationEngine(p, new ToolRegistry([t])).reply(context);
    await vi.advanceTimersByTimeAsync(45001);
    expect((await pending).reply).toBe('Saved the exact requested memory.');
    expect(t.execute).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
  });
  it('validates summaries and uses a small request', async () => {
    const p = provider(); vi.mocked(p.generate).mockResolvedValue(JSON.stringify({ summary: 'We discussed recursion.', topics: ['code', 'functions', 'recursion'] }));
    const result = await new ConversationEngine(p, new ToolRegistry([])).summarize('qwen3:8b', context.turns);
    expect(result.topics).toHaveLength(3); expect(vi.mocked(p.generate).mock.calls[0][0].summary).toBe(true);
    vi.mocked(p.generate).mockResolvedValue('{"summary":"hello","topics":[1]}');
    await expect(new ConversationEngine(p, new ToolRegistry([])).summarize('qwen3:8b', [])).rejects.toThrow('Invalid summary');
  });
  it('uses the same fixed local transport with conversation options', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ message: { content: response() } })));
    await new OllamaProvider(11434, fetcher).generate({ model: 'qwen3:8b', messages: [], conversation: true, format: CONVERSATION_SCHEMA }, new AbortController().signal);
    expect(fetcher.mock.calls[0][0]).toBe('http://127.0.0.1:11434/api/chat');
    const body = JSON.parse(fetcher.mock.calls[0][1]!.body as string);
    expect(body).toMatchObject({ stream: false, think: false, format: CONVERSATION_SCHEMA, options: { num_predict: 700, temperature: .8 } });
  });
});
