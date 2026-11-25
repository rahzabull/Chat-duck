export interface AIRequest {
  model: string;
  messages: readonly { role: 'system' | 'user' | 'assistant'; content: string }[];
  warmup?: boolean;
  conversation?: boolean;
  summary?: boolean;
  format?: object;
}
/** Only the main process instantiates a provider. Output remains untrusted. */
export interface AIProvider {
  status(): Promise<{ version: string }>;
  listModels(): Promise<string[]>;
  generate(request: AIRequest, signal: AbortSignal): Promise<string>;
  cancel(): void;
}
