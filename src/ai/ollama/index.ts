import { ANIMATION_IDS, EMOTION_IDS } from '../../animation/adapter';
import { isModelName, isRecord } from '../../shared/schemas/settings';
import type { AIProvider, AIRequest } from '../providers';

export const RESPONSE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['shouldSpeak', 'dialogue', 'then', 'emotion', 'animation'],
  properties: {
    shouldSpeak: { type: 'boolean' }, dialogue: { type: 'string' }, then: { type: 'string' },
    emotion: { type: 'string', enum: EMOTION_IDS }, animation: { type: 'string', enum: ANIMATION_IDS },
  },
} as const;
export class OllamaError extends Error {
  constructor(readonly reason: 'Not running' | 'Timed out' | 'Cancelled' | 'Model missing' | 'Bad response' | 'Request failed') { super(reason); }
}
const localModel = (name: string): boolean => isModelName(name) && !!name && !/(?:^|[:-])cloud(?:$|[:-])/i.test(name);
/** Fixed loopback origin; no URL, headers, redirects or tools supplied by the model. */
export class OllamaProvider implements AIProvider {
  private active?: AbortController;
  private readonly origin: string;
  constructor(port = 11434, private fetcher: typeof fetch = fetch) {
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid Ollama port');
    this.origin = `http://127.0.0.1:${port}`;
  }
  cancel(): void { this.active?.abort(); }
  private async request(path: '/api/version' | '/api/tags' | '/api/chat', body?: unknown, signal?: AbortSignal, timeout = 2500): Promise<unknown> {
    this.cancel();
    const controller = new AbortController(); this.active = controller;
    let timedOut = false;
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    const timer = setTimeout(() => { timedOut = true; abort(); }, timeout);
    let rejectAbort: () => void = () => {};
    const cancelled = new Promise<never>((_resolve, reject) => {
      rejectAbort = () => reject(new OllamaError(timedOut ? 'Timed out' : 'Cancelled'));
      controller.signal.addEventListener('abort', rejectAbort, { once: true });
      if (controller.signal.aborted) rejectAbort();
    });
    try {
      return await Promise.race([cancelled, (async () => {
        if (controller.signal.aborted) throw new OllamaError('Cancelled');
        const response = await this.fetcher(`${this.origin}${path}`, {
          method: body === undefined ? 'GET' : 'POST', redirect: 'error', signal: controller.signal,
          headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
        });
        if (!response.ok) throw new OllamaError(response.status === 404 && path === '/api/chat' ? 'Model missing' : 'Request failed');
        try { return await response.json() as unknown; } catch { throw new OllamaError('Bad response'); }
      })()]);
    } catch (error) {
      // Never surface raw network errors or server bodies.
      throw error instanceof OllamaError ? error : new OllamaError('Not running');
    } finally {
      clearTimeout(timer); signal?.removeEventListener('abort', abort);
      controller.signal.removeEventListener('abort', rejectAbort);
      if (this.active === controller) this.active = undefined;
    }
  }
  async status(): Promise<{ version: string }> {
    const data = await this.request('/api/version');
    if (!isRecord(data) || typeof data.version !== 'string' || !/^[\w.+-]{1,40}$/.test(data.version)) throw new OllamaError('Bad response');
    return { version: data.version };
  }
  async listModels(): Promise<string[]> {
    const data = await this.request('/api/tags');
    if (!isRecord(data) || !Array.isArray(data.models)) throw new OllamaError('Bad response');
    const names = data.models.filter((model: unknown) => !isRecord(model) || (!model.remote_host && !model.remote_model))
      .map((model: unknown) => isRecord(model) ? model.name : undefined);
    if (names.some(name => typeof name !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:/+-]{0,199}$/.test(name))) throw new OllamaError('Bad response');
    return [...new Set((names as string[]).filter(localModel))];
  }
  async generate(request: AIRequest, signal: AbortSignal): Promise<string> {
    if (!localModel(request.model)) throw new OllamaError('Model missing');
    const data = await this.request('/api/chat', {
      model: request.model, messages: request.messages, stream: false, think: false,
      format: request.format ?? RESPONSE_SCHEMA, keep_alive: '10m',
      options: { temperature: request.conversation ? 0.8 : 0.9, top_p: 0.95, num_predict: request.summary ? 200 : request.conversation ? 700 : 80, repeat_penalty: 1.15 },
    }, signal, request.conversation ? 45000 : request.warmup ? 60000 : 2500);
    if (!isRecord(data) || !isRecord(data.message) || typeof data.message.content !== 'string') throw new OllamaError('Bad response');
    return data.message.content;
  }
}
