import type { Conversation, Retention, UserMemory } from './types';
const stop = new Set('a an the i me my you your we our do what about that this were was is are remember talking discussing earlier last time'.split(' '));
export const keywords = (text: string): string[] => [...new Set(text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])].filter(w => w.length > 1 && !stop.has(w));
export function score(query: string, text: string, at: number, now: number): number {
  const terms = new Set(keywords(text));
  const overlap = keywords(query).filter(w => terms.has(w)).length;
  return overlap * 10 + 1 / (1 + Math.max(0, now - at) / 86400000);
}
export interface MemoryRetrieval {
  memories(query: string, values: readonly UserMemory[], now: number): UserMemory[];
  conversations(query: string, values: readonly Conversation[], now: number): Conversation[];
}
export class KeywordRetrieval implements MemoryRetrieval {
  memories(query: string, values: readonly UserMemory[], now: number): UserMemory[] {
    return [...values].sort((a, b) => score(query, b.text, b.createdAt, now) - score(query, a.text, a.createdAt, now)).slice(0, 8);
  }
  conversations(query: string, values: readonly Conversation[], now: number): Conversation[] {
    return [...values].sort((a, b) => score(query, `${b.summary ?? ''} ${b.topics?.join(' ') ?? ''}`, b.endedAt, now) - score(query, `${a.summary ?? ''} ${a.topics?.join(' ') ?? ''}`, a.endedAt, now)).slice(0, 3);
  }
}
export function purgeConversations(values: readonly Conversation[], retention: Retention, now: number): Conversation[] {
  if (retention === 'off') return [];
  const cutoff = now - (retention === '30 days' ? 30 : 7) * 86400000;
  return values.filter(c => c.endedAt > cutoff && c.endedAt <= now);
}
