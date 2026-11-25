import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { isRecord } from '../../shared/schemas/settings';
import { CATEGORIES, cleanText, type Category, type Conversation, type Retention, type UserMemory } from '../../core/conversation/types';
import { purgeConversations } from '../../core/conversation/retrieval';
const timestamp = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0 && v <= Date.now();
const idOK = (v: unknown): v is string => typeof v === 'string' && /^[\w-]{1,80}$/.test(v);
export function parseMemories(value: unknown): UserMemory[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-1000).filter(v => isRecord(v) && idOK(v.id) && typeof v.text === 'string' && !!cleanText(v.text) && v.text.length <= 4000 && CATEGORIES.includes(v.category as Category) && timestamp(v.createdAt) && ['user_said', 'user_edited'].includes(v.source as string))
    .map(v => ({ id: v.id, text: cleanText(v.text), category: v.category, createdAt: v.createdAt, source: v.source }));
}
export function parseConversations(value: unknown): Conversation[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-500).filter(v => isRecord(v) && idOK(v.id) && timestamp(v.startedAt) && timestamp(v.endedAt) && v.endedAt >= v.startedAt && Array.isArray(v.turns)).map(v => ({
    id: v.id, startedAt: v.startedAt, endedAt: v.endedAt,
    turns: (v.turns as unknown[]).slice(-200).filter(t => isRecord(t) && ['user', 'assistant'].includes(t.role as string) && typeof t.text === 'string' && t.text.length <= 4000 && timestamp(t.at)).map(t => { const turn = t as Record<string, unknown>; return { role: turn.role as 'user' | 'assistant', text: cleanText(turn.text as string), at: turn.at as number }; }),
    summary: typeof v.summary === 'string' ? cleanText(v.summary).slice(0, 1000) : undefined,
    topics: Array.isArray(v.topics) ? v.topics.filter((s: unknown) => typeof s === 'string').slice(0, 6).map((s: string) => cleanText(s).slice(0, 60)) : undefined,
  }));
}
/** Explicit commands commit synchronously before acknowledgement. Summary updates debounce. */
export class ConversationStore {
  memories: UserMemory[] = []; conversations: Conversation[] = [];
  private pending?: ReturnType<typeof setTimeout>;
  private daily: ReturnType<typeof setInterval>;
  private epoch = 0;
  onChanged: () => void = () => {};
  constructor(private directory: string, private enabled: boolean, private retention: Retention, private clock = Date.now) {
    const read = (name: string): unknown => { try { return JSON.parse(readFileSync(join(directory, name), 'utf8')); } catch { return []; } };
    if (enabled) { this.memories = parseMemories(read('memories.json')); this.conversations = parseConversations(read('conversations.json')); this.purge(); }
    else this.clear();
    this.daily = setInterval(() => { try { this.purge(); } catch { console.error('[ducky] Retention purge failed'); } }, 86400000);
  }
  get generation(): number { return this.epoch; }
  private write(name: string, value: unknown): void {
    mkdirSync(this.directory, { recursive: true }); const path = join(this.directory, name);
    writeFileSync(`${path}.tmp`, JSON.stringify(value, null, 2), 'utf8'); renameSync(`${path}.tmp`, path);
  }
  configure(enabled: boolean, retention: Retention): void {
    if (enabled !== this.enabled || retention !== this.retention) this.epoch++;
    if (!enabled) this.clear();
    this.enabled = enabled; this.retention = retention; this.purge();
  }
  add(text: string, category: Category = 'other', source: UserMemory['source'] = 'user_said'): UserMemory {
    if (!this.enabled) throw new Error('Memory is off. Turn it on in Settings first.');
    text = cleanText(text); if (!text || text.length > 4000 || !CATEGORIES.includes(category)) throw new Error('Invalid memory');
    if (this.memories.length >= 1000) throw new Error('Memory is full. Delete an old memory first.');
    const memory: UserMemory = { id: randomUUID(), text, category, source, createdAt: this.clock() };
    const next = [...this.memories, memory]; this.write('memories.json', next); this.memories = next; this.onChanged(); return memory;
  }
  edit(id: string, text: string, category: Category): void {
    if (!this.enabled || !this.memories.some(m => m.id === id) || !cleanText(text) || text.length > 4000 || !CATEGORIES.includes(category)) throw new Error('Invalid memory');
    const next = this.memories.map(m => m.id === id ? { ...m, text: cleanText(text), category, source: 'user_edited' as const } : m);
    this.write('memories.json', next); this.memories = next; this.onChanged();
  }
  remove(ids: string[]): UserMemory[] {
    const removed = this.memories.filter(m => ids.includes(m.id)); if (!removed.length) return [];
    const next = this.memories.filter(m => !ids.includes(m.id)); this.write('memories.json', next); this.memories = next; this.onChanged(); return removed;
  }
  saveConversation(value: Conversation): void {
    if (!this.enabled || this.retention === 'off') return;
    const next = purgeConversations([...this.conversations.filter(c => c.id !== value.id), value].slice(-500), this.retention, this.clock());
    this.write('conversations.json', next); this.conversations = next; this.onChanged();
  }
  setSummary(id: string, summary: string, topics: string[], generation: number): void {
    if (!this.enabled || this.retention === 'off' || this.epoch !== generation || !this.conversations.some(c => c.id === id)) return;
    this.conversations = this.conversations.map(c => c.id === id ? { ...c, summary, topics } : c);
    if (this.pending) clearTimeout(this.pending);
    this.pending = setTimeout(() => { try { this.flush(); } catch { console.error('[ducky] Summary save failed'); } }, 750); this.onChanged();
  }
  deleteConversations(id?: string): void {
    const next = id ? this.conversations.filter(c => c.id !== id) : [];
    if (this.enabled) this.write('conversations.json', next); this.conversations = next; this.epoch++; this.onChanged();
  }
  purge(): void {
    const next = purgeConversations(this.conversations, this.retention, this.clock());
    if (next.length !== this.conversations.length) { this.write('conversations.json', next); this.conversations = next; this.onChanged(); }
  }
  clear(): void {
    this.epoch++; if (this.pending) clearTimeout(this.pending); this.pending = undefined;
    this.memories = []; this.conversations = [];
    for (const file of ['memories.json', 'conversations.json']) for (const suffix of ['', '.tmp']) rmSync(join(this.directory, file + suffix), { force: true });
    this.onChanged();
  }
  flush(): void {
    if (!this.pending) return; clearTimeout(this.pending); this.pending = undefined;
    if (this.enabled && this.retention !== 'off') this.write('conversations.json', this.conversations);
  }
  dispose(): void {
    clearInterval(this.daily);
    try { this.flush(); } catch { console.error('[ducky] Could not flush conversation summaries on quit'); }
  }
}
