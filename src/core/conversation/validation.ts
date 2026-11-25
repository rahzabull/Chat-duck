import { isRecord } from '../../shared/schemas/settings';
import { disallowedModelOutput, DisallowedOutputError } from '../content-safety';
import { cleanText, TONES, TOOL_NAMES, type Reply } from './types';
/** Count visible graphemes, excluding whitespace and invisible formatting. */
export function needsClarification(text: string): boolean {
  const visible = text.replace(/[\p{White_Space}\p{Cf}]/gu, '');
  return !/\p{L}/u.test(visible) || [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(visible)].length < 2;
}
export const conversationSchema = (names: readonly string[] = TOOL_NAMES) => ({
  type: 'object', additionalProperties: false, required: ['reply', 'tone', 'tool'],
  properties: { reply: { type: 'string' }, tone: { type: 'string', enum: TONES }, tool: { anyOf: [
    { type: 'null' }, { type: 'object', additionalProperties: false, required: ['name', 'args'], properties: { name: { type: 'string', enum: names }, args: { type: 'object' } } },
  ] } },
});
export const CONVERSATION_SCHEMA = conversationSchema();
export function validateReply(raw: string, names: readonly string[] = TOOL_NAMES): Reply {
  if (raw.length > 24000) throw new Error('Invalid response');
  const value: unknown = JSON.parse(raw);
  if (disallowedModelOutput(value)) throw new DisallowedOutputError();
  if (!isRecord(value) || Object.keys(value).sort().join(',') !== 'reply,tone,tool' || typeof value.reply !== 'string' || value.reply.length > 4000) throw new Error('Invalid response');
  const reply = cleanText(value.reply); if (!reply) throw new Error('Empty response');
  if (value.tool !== null && (!isRecord(value.tool) || Object.keys(value.tool).sort().join(',') !== 'args,name' || typeof value.tool.name !== 'string' || !names.includes(value.tool.name) || !isRecord(value.tool.args))) throw new Error('Unknown or invalid tool');
  return { reply, tone: TONES.includes(value.tone as never) ? value.tone as Reply['tone'] : 'neutral', tool: value.tool as Reply['tool'] };
}

/** Guard obvious ungrounded external-action acknowledgements, not authored code/prose. */
export function unverifiedActionClaim(text: string): boolean {
  const prose = text.replace(/```[\s\S]*?```|`[^`]*`/g, '');
  return /\bI(?:'ve|’ve| have)?\s+(?:(?:successfully|already|just)\s+)?(?:saved|stored|remembered|deleted|removed|forgotten|sent|emailed|booked|scheduled|installed|downloaded|uploaded|opened|browsed|created|added|updated|completed|rescheduled|snoozed|started|stopped)\b/i.test(prose)
    || /\bI(?:'ll|’ll| will) remember\b/i.test(prose)
    || /\b(?:memory|reminder|email|file|appointment|task|note|timer)\s+(?:(?:has been|was|is)\s+)?(?:saved|deleted|sent|scheduled|created|added|updated|completed|snoozed|started|stopped)\b/i.test(prose);
}
