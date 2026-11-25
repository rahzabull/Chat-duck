import type { ToolCall } from '../../core/conversation/types';
import { flipPronouns } from '../../core/conversation/intents';
import { guardedReply, toolFailureLine } from '../../core/conversation/output';
export type Permission = 'safe' | 'confirm' | 'blocked';
export interface ToolResult {
  ok: boolean; message: string; data?: unknown; confirmation?: ToolCall;
  /** Authored requests for missing input are not system/tool failures. */
  needsInput?: boolean;
  /** Internal model feedback. Never render this diagnostic as conversation prose. */
  failure?: { kind: 'validation' | 'execution' | 'permission' | 'limit'; detail: string; call: ToolCall };
}
export interface Tool { name: string; description: string; permission: Permission; validate(args: Record<string, unknown>): boolean; execute(args: Record<string, unknown>): Promise<ToolResult> | ToolResult }
export const MAX_TOOL_ROUNDS = 2;
/** Permissions are enforced by authored code, never model-provided arguments. */
export class ToolRegistry {
  constructor(private tools: readonly Tool[]) {}
  get names(): string[] { return this.tools.map(t => t.name); }
  describe(): string { return this.tools.map(t => `${t.name}: ${t.description} [${t.permission}]`).join('\n'); }
  async run(call: ToolCall, round: number, confirmed = false): Promise<ToolResult> {
    const fail = (kind: NonNullable<ToolResult['failure']>['kind'], detail: string): ToolResult => ({ ok: false, message: toolFailureLine(), failure: { kind, detail, call } });
    if (round >= MAX_TOOL_ROUNDS) return fail('limit', 'Tool round limit reached.');
    const tool = this.tools.find(t => t.name === call.name);
    if (!tool || tool.permission === 'blocked') return fail('permission', 'That tool is not allowed.');
    try {
      if (!tool.validate(call.args)) return fail('validation', `Invalid tool arguments. Expected: ${tool.description}. No operation performed.`);
    } catch { return fail('validation', `Invalid tool arguments. Expected: ${tool.description}. No operation performed.`); }
    if (tool.permission === 'confirm' && !confirmed) {
      const message = call.name === 'forget' && typeof call.args.query === 'string'
        ? `Forget '${flipPronouns(call.args.query)}'? Reply yes or no.`
        : call.name === 'remember' && typeof call.args.text === 'string'
          ? `Remember '${flipPronouns(call.args.text)}'? Reply yes or no.`
          : 'Allow this action? Reply yes or no.';
      const safe = guardedReply(message);
      return { ok: false, message: safe, ...(safe === message ? { confirmation: call } : {}) };
    }
    try {
      const result = await tool.execute(call.args);
      return result.ok || result.needsInput || result.confirmation ? { ...result, message: guardedReply(result.message) } : fail('execution', 'The operation did not succeed.');
    } catch { return fail('execution', 'The operation failed. Completion is unconfirmed.'); }
  }
}
