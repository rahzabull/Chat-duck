export interface AIRequest {
  model: string;
  messages: readonly { role: 'system' | 'user'; content: string }[];
  warmup?: boolean;
}
/** Only the main process instantiates a provider. Output remains untrusted. */
export interface AIProvider {
  status(): Promise<{ version: string }>;
  listModels(): Promise<string[]>;
  generate(request: AIRequest, signal: AbortSignal): Promise<string>;
  cancel(): void;
}
