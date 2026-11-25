import { TALK_LINES } from '../dialogue/lines';

/** Last boundary before prose reaches a bubble/panel (including local/tool results).
 * Remember/forget are also ordinary English; only their tool-call spelling is technical.
 */
export function guardedReply(text: string): string {
  const technical = /\{\s*["']|\b(?:recall_memories|recall_conversations|TOOL_RESULT)\b|\b(?:remember|forget)\s*\(|["`](?:remember|forget)["`]/i.test(text)
    || /^\s*(?:```(?:json)?\s*)?[{\[]/.test(text);
  return technical ? TALK_LINES.talk_error[0] : text;
}
