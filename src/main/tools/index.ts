import type { ToolCall } from '../../core/conversation/types';
import { flipPronouns } from '../../core/conversation/intents';
import { guardedReply } from '../../core/conversation/output';
export type Permission = 'safe' | 'confirm' | 'blocked';
export interface ToolResult { ok: boolean; message: string; data?: unknown; confirmation?: ToolCall }
export interface Tool { name: string; description: string; permission: Permission; validate(args: Record<string, unknown>): boolean; execute(args: Record<string, unknown>): Promise<ToolResult> | ToolResult }
export const MAX_TOOL_ROUNDS = 2;
/** Permissions are enforced by authored code, never model-provided arguments. */
export class ToolRegistry {
  constructor(private tools: readonly Tool[]) {}
  get names(): string[] { return this.tools.map(t => t.name); }
  describe(): string { return this.tools.map(t => `${t.name}: ${t.description} [${t.permission}]`).join('\n'); }
  async run(call: ToolCall, round: number, confirmed = false): Promise<ToolResult> {
    if (round >= MAX_TOOL_ROUNDS) return { ok: false, message: 'Tool round limit reached. No operation performed.' };
    const tool = this.tools.find(t => t.name === call.name);
    if (!tool || tool.permission === 'blocked') return { ok: false, message: 'That tool is not allowed. No operation performed.' };
    if (!tool.validate(call.args)) return { ok: false, message: 'Invalid tool arguments. No operation performed.' };
    if (tool.permission === 'confirm' && !confirmed) {
      const message = call.name === 'forget' && typeof call.args.query === 'string'
        ? `Forget '${flipPronouns(call.args.query)}'? Reply yes or no.`
        : call.name === 'remember' && typeof call.args.text === 'string'
          ? `Remember '${flipPronouns(call.args.text)}'? Reply yes or no.`
          : 'Allow this action? Reply yes or no.';
      const safe = guardedReply(message);
      return { ok: false, message: safe, ...(safe === message ? { confirmation: call } : {}) };
    }
    try { return await tool.execute(call.args); }
    catch { return { ok: false, message: 'The operation failed. I could not save or delete anything successfully.' }; }
  }
}
