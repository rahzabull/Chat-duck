import { ANIMATION_IDS, EMOTION_IDS, type AnimationId, type EmotionId } from '../../animation/adapter';
import { POLICIES, type DirectedSpeech } from '../../core/dialogue';
import { isRecord } from '../../shared/schemas/settings';
import { disallowedModelOutput, disallowedModelText, normalizeLanguage } from '../../core/content-safety';
import type { AIContext } from '../prompts';

export type Validation = { kind: 'invalid' } | { kind: 'silent' } | { kind: 'speech'; speech: DirectedSpeech };
const words = (text: string): Set<string> => new Set(text.toLowerCase().replace(/[’']/g, '').match(/[\p{L}\p{N}]+/gu) ?? []);
export function similarity(a: string, b: string): number {
  const left = words(a), right = words(b), union = new Set([...left, ...right]);
  return union.size ? [...left].filter(word => right.has(word)).length / union.size : 1;
}
const invented = /\b(tabs?|websites?|sites?|pages?|videos?|emails?|messages?|cats?|dogs?|files?)\b/gi;
const profanity = /\b(fuck\w*|shit\w*|bullshit|bitch\w*|ass|asshole\w*|arse\w*|bastard\w*|cunt\w*|dick\w*|piss\w*|damn\w*|crap|wtf|stfu)\b/i;
const strong = /\b(fuck\w*|bullshit|bitch\w*|ass|asshole\w*|arse\w*|bastard\w*|cunt\w*|dick\w*|piss\w*|wtf|stfu|nigg\w*|fagg\w*|retard\w*|kike\w*|chink\w*|trann\w*|spic)\b/i;
export function rejectedLanguage(text: string, allowed: boolean): boolean {
  if (disallowedModelText(text)) return true;
  const normalized = normalizeLanguage(text);
  if (strong.test(normalized)) return true;
  if (!allowed) return profanity.test(normalized) || /\b(hell|bloody)\b|for f[\u2014\u2013-]/i.test(normalized);
  const rest = normalized.replace(/\b(damn|hell|shit|crap|bloody)\b/gi, '').replace(/for f[\u2014\u2013-]+(?:\s*sake)?/gi, '');
  return profanity.test(rest) || /\b(?:you(?:'re| are)?|your)\b.{0,25}\b(?:damn|hell|shit|crap|bloody)\b|\b(?:damn|hell|shit|crap|bloody)\b.{0,25}\b(?:you|your)\b/i.test(normalized);
}
const timeEvents = new Set(['late_night_working', 'sleepy_late', 'thought_late', 'thought_morning']);
const smallNumbers = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const tens = ['twenty', 'thirty', 'forty', 'fifty'];
const numberNames = Array.from({ length: 60 }, (_, n) => n < 20 ? smallNumbers[n] :
  `${tens[Math.floor(n / 10) - 2]}${n % 10 ? ` ${smallNumbers[n % 10]}` : ''}`);
const alternatives = (names: string[]) => [...names].sort((a, b) => b.length - a.length).join('|').replace(/ /g, '[ -]');
const hourPattern = `(?:${alternatives(numberNames.slice(1, 24))}|zero|\\d{1,2})`;
const minutePattern = `(?:${alternatives(numberNames)}|(?:oh|zero)[ -](?:${smallNumbers.slice(1, 10).join('|')}))`;
const suffixPattern = "(?:o['’]?clock|[ap]\\.?m\\.?)";
const clockPattern = new RegExp(`\\b(?:(\\d{1,2}):(\\d{2})(?:\\s*(${suffixPattern}))?|(${hourPattern})(?:[ -](${minutePattern})(?:\\s*(${suffixPattern}))?|\\s*(${suffixPattern}))|noon|midnight)\\b`, 'gi');
function numberValue(value: string): number {
  const normalized = value.toLowerCase().replace(/-/g, ' ').replace(/^(?:oh|zero) /, '');
  return /^\d+$/.test(normalized) ? Number(normalized) : numberNames.indexOf(normalized);
}
function clockValue(match: RegExpMatchArray): { hour: number; minute: number; meridiem: boolean } {
  if (/^(noon|midnight)$/i.test(match[0])) return { hour: /^noon$/i.test(match[0]) ? 12 : 0, minute: 0, meridiem: true };
  let hour = numberValue(match[1] ?? match[4]);
  const minute = match[2] ? Number(match[2]) : match[5] ? numberValue(match[5]) : 0;
  const suffix = (match[3] ?? match[6] ?? match[7] ?? '').replace(/\./g, '').toLowerCase();
  const meridiem = suffix === 'am' || suffix === 'pm';
  if (meridiem) hour = hour < 1 || hour > 12 ? -1 : hour % 12 + (suffix === 'pm' ? 12 : 0);
  return { hour, minute, meridiem };
}
/** Compare whole times, never independent digit tokens from unrelated facts. */
function groundedTimes(text: string, context: AIContext): string | undefined {
  const { localTime, event, ...facts } = context;
  const supplied = [...Object.values(facts).join(' ').matchAll(clockPattern)].map(clockValue);
  if (timeEvents.has(event)) supplied.push(...[...localTime.matchAll(clockPattern)].map(clockValue));
  for (const match of text.matchAll(clockPattern)) {
    const time = clockValue(match);
    if (time.hour < 0 || time.hour > 23 || time.minute < 0 || time.minute > 59 || !supplied.some(fact =>
      fact.minute === time.minute && (fact.hour === time.hour || (!match[1] && !time.meridiem && time.hour <= 12 && fact.hour % 12 === time.hour % 12)))) return undefined;
  }
  return text.replace(clockPattern, '');
}
const cleanQuotes = (text: string): string => text.replace(/”/g, '').replace(/^ *["“']+|["“']+ *$/g, '').replace(/^ +| +$/g, '');
const wordCount = (text: string): number => text.split(/\s+/).filter(word => /[\p{L}\p{N}]/u.test(word)).length;
function validBeat(text: string, limit: number, context: AIContext, recent: readonly string[]): boolean {
  if (text.length > limit || text.trim().split(/\s+/).length > 18) return false;
  if (/[\r\n\u2028\u2029\u0000-\u001f\u007f\u0085]/u.test(text) || /[\p{Extended_Pictographic}\p{Regional_Indicator}\u200d\ufe0f\u20e3]/u.test(text)) return false;
  if (/[^\x00-\x7f]/u.test(text.replace(/[^\p{N}]/gu, ''))) return false;
  if (/(?:\b[a-z][a-z0-9+.-]*:\/\/|(?:https?|mailto|data|javascript|file):|www\.|\b[\w.-]+\.[a-z]{2,}(?:\b|\/)|\b\S+@\S+)|[`*_#<>\[\]{}|~]|^\s*(?:[-+>]\s|\d+[.)]\s|[-=]{3,}\s*$)/i.test(text)) return false;
  if (/^\s*(?:seriously\b|ugh\b|oh great\b|well,|as a duck\b|as an ai\b)/i.test(text) || rejectedLanguage(text, context.profanity === true) || /miss(?:ed)? you|lonely without|abandon(?:ed)? me|why did you leave/i.test(text)) return false;
  const withoutTimes = groundedTimes(text, context);
  if (withoutTimes === undefined) return false;
  const { localTime: _localTime, ...otherFacts } = context;
  const facts = Object.values(otherFacts).join(' ');
  const numbers = new Set(facts.match(/\d+/g) ?? []);
  if ((withoutTimes.match(/\d+/g) ?? []).some(number => !numbers.has(number))) return false;
  const factWords = words(facts);
  if ((text.match(invented) ?? []).some(word => !factWords.has(word.toLowerCase()))) return false;
  return !recent.slice(-20).some(line => similarity(text, line) >= .6);
}
export function validateResponse(raw: string, context: AIContext, recent: readonly string[]): Validation {
  if (raw.length > 8192) return { kind: 'invalid' };
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return { kind: 'invalid' }; }
  if (disallowedModelOutput(value)) return { kind: 'invalid' };
  if (!isRecord(value) || Object.keys(value).sort().join(',') !== 'animation,dialogue,emotion,shouldSpeak,then' ||
    typeof value.shouldSpeak !== 'boolean' || typeof value.dialogue !== 'string' || typeof value.then !== 'string' ||
    typeof value.emotion !== 'string' || typeof value.animation !== 'string') return { kind: 'invalid' };
  if (!value.shouldSpeak) return { kind: 'silent' };
  const dialogue = cleanQuotes(value.dialogue);
  let then = cleanQuotes(value.then);
  if (then && (/^\p{Ll}/u.test(then) || wordCount(then) < 2)) then = '';
  if (wordCount(dialogue) < 2 || !validBeat(dialogue, 110, context, recent) ||
    (then && (!validBeat(then, 90, context, recent) || similarity(dialogue, then) >= .6))) return { kind: 'invalid' };
  const [, , priority, emotion, animation] = POLICIES[context.event];
  return { kind: 'speech', speech: { text: dialogue, then: then || undefined, priority,
    emotion: (EMOTION_IDS as readonly string[]).includes(value.emotion) ? value.emotion as EmotionId : emotion,
    animation: (ANIMATION_IDS as readonly string[]).includes(value.animation) && !['strike', 'sunglasses', 'bread_snack', 'visitor', 'nap'].includes(value.animation) ? value.animation as AnimationId : animation } };
}
