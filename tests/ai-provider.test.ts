import { afterEach, describe, expect, it, vi } from 'vitest';
import { OllamaProvider, RESPONSE_SCHEMA } from '../src/ai/ollama';
import type { AIRequest } from '../src/ai/providers';
const request: AIRequest = { model: 'gemma3:4b', messages: [{ role: 'user', content: 'hello' }] };
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
afterEach(() => vi.useRealTimers());
describe('Ollama loopback provider with fake fetch', () => {
  it('uses only fixed endpoints and prescribed structured chat options', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ version: '0.40.18' }))
      .mockResolvedValueOnce(json({ models: [{ name: 'gemma3:4b' }, { name: 'qwen3:8b' }] }))
      .mockResolvedValueOnce(json({ message: { content: '{"shouldSpeak":false}' } }));
    const provider = new OllamaProvider(11434, fetcher);
    expect(await provider.status()).toEqual({ version: '0.40.18' });
    expect(await provider.listModels()).toEqual(['gemma3:4b', 'qwen3:8b']);
    expect(await provider.generate(request, new AbortController().signal)).toBe('{"shouldSpeak":false}');
    expect(fetcher.mock.calls.map(call => call[0])).toEqual(['http://127.0.0.1:11434/api/version', 'http://127.0.0.1:11434/api/tags', 'http://127.0.0.1:11434/api/chat']);
    for (const call of fetcher.mock.calls) expect(call[1]?.redirect).toBe('error');
    expect(JSON.parse(fetcher.mock.calls[2][1]!.body as string)).toEqual({
      model: request.model, messages: request.messages, stream: false, think: false, format: RESPONSE_SCHEMA, keep_alive: '10m',
      options: { temperature: .9, top_p: .95, num_predict: 80, repeat_penalty: 1.15 },
    });
  });
  it('allows a numeric custom port, never a custom host', async () => {
    for (const port of [0, 65536, 1.5, NaN, Infinity, 'example.com' as unknown as number]) expect(() => new OllamaProvider(port)).toThrow();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({ version: '1' }));
    await new OllamaProvider(12000, fetcher).status();
    expect(fetcher.mock.calls[0][0]).toBe('http://127.0.0.1:12000/api/version');
  });
  it.each([false, true])('aborts after the %s warmup deadline, including non-cooperative fetch', async warmup => {
    vi.useFakeTimers(); const fetcher = vi.fn<typeof fetch>(() => new Promise(() => {}));
    const provider = new OllamaProvider(11434, fetcher);
    const promise = provider.generate({ ...request, warmup }, new AbortController().signal);
    const rejected = expect(promise).rejects.toThrow('Timed out');
    const timeout = warmup ? 60000 : 2500;
    await vi.advanceTimersByTimeAsync(timeout - 1);
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1); await rejected;
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('aborts via caller, rejects already-aborted signals without fetching', async () => {
    const fetcher = vi.fn<typeof fetch>(() => new Promise(() => {})); const provider = new OllamaProvider(11434, fetcher);
    const controller = new AbortController(); const pending = provider.generate(request, controller.signal);
    const rejected = expect(pending).rejects.toThrow('Cancelled'); controller.abort(); await rejected;
    await expect(provider.generate(request, controller.signal)).rejects.toThrow('Cancelled');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('keeps only one active transport across status, tags and chat', async () => {
    let active = 0, peak = 0;
    const fetcher = vi.fn<typeof fetch>((_url, options) => new Promise((_resolve, reject) => {
      active++; peak = Math.max(peak, active);
      options!.signal!.addEventListener('abort', () => { active--; reject(new Error('abort')); }, { once: true });
    }));
    const provider = new OllamaProvider(11434, fetcher);
    const first = expect(provider.generate(request, new AbortController().signal)).rejects.toThrow('Cancelled');
    const second = expect(provider.listModels()).rejects.toThrow('Cancelled');
    const third = expect(provider.status()).rejects.toThrow('Cancelled');
    provider.cancel(); await Promise.all([first, second, third]); expect(peak).toBe(1); expect(active).toBe(0);
  });
  it.each([
    ['Bad response', () => Promise.resolve(new Response('bad JSON'))],
    ['Bad response', () => Promise.resolve(json({ message: { content: 1 } }))],
    ['Model missing', () => Promise.resolve(new Response('private server details', { status: 404 }))],
    ['Request failed', () => Promise.resolve(new Response('', { status: 500 }))],
    ['Request failed', () => Promise.resolve(new Response('', { status: 302, headers: { Location: 'https://untrusted.invalid' } }))],
    ['Not running', () => Promise.reject(new TypeError('ECONNREFUSED private details'))],
  ] as const)('reports a short safe error: %s', async (message, response) => {
    await expect(new OllamaProvider(11434, vi.fn(response)).generate(request, new AbortController().signal)).rejects.toThrow(message);
  });
  it('validates version and model-list response shapes', async () => {
    for (const data of [null, {}, { version: '<html>' }]) await expect(new OllamaProvider(11434, vi.fn(async () => json(data))).status()).rejects.toThrow('Bad response');
    for (const data of [null, {}, { models: [null] }, { models: [{ name: 'bad\nname' }] }]) await expect(new OllamaProvider(11434, vi.fn(async () => json(data))).listModels()).rejects.toThrow('Bad response');
  });
  it('excludes cloud-tagged and remote models and refuses direct cloud generation', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({ models: [{ name: 'qwen3:8b' }, { name: 'model:cloud' }, { name: 'other:latest', remote_host: 'https://remote.invalid' }] }));
    const provider = new OllamaProvider(11434, fetcher);
    expect(await provider.listModels()).toEqual(['qwen3:8b']);
    await expect(provider.generate({ ...request, model: 'model:cloud' }, new AbortController().signal)).rejects.toThrow('Model missing');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
