import { TALK_LINES } from '../dialogue/lines';

/** Remove whole emoji sequences without deleting digits, punctuation or ASCII emoticons. */
export function stripEmoji(text: string): string {
  return text.replace(/[#*0-9]\uFE0F?\u20E3|[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\uFE0F\u200D\u{E0020}-\u{E007F}]/gu, '').trim();
}

export function toolFailureLine(): string {
  const pool = TALK_LINES.talk_tool_failed;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Last boundary before prose reaches a bubble/panel (including local/tool results).
 * Remember/forget are also ordinary English; only their tool-call spelling is technical.
 */
export function guardedReply(text: string): string {
  text = stripEmoji(text);
  if (/\b(?:invalid tool arguments|no operation performed|tool round limit|TOOL_ERROR|stack trace|ECONNREFUSED|ENOENT|EACCES)\b|\b\w*(?:Error|Exception):/i.test(text)) return toolFailureLine();
  const technical = /\{\s*["']|\b(?:recall_memories|recall_conversations|TOOL_RESULT)\b|\b(?:remember|forget)\s*\(|["`](?:remember|forget)["`]/i.test(text)
    || /^\s*(?:```(?:json)?\s*)?[{\[]/.test(text);
  return technical ? TALK_LINES.talk_error[0] : text;
}
