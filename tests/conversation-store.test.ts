import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConversationStore, parseConversations, parseMemories } from '../src/main/conversation/store';
let directory: string; let store: ConversationStore;
beforeEach(() => { directory = mkdtempSync(join(tmpdir(), 'ducky-conversation-')); });
afterEach(() => { store?.dispose(); rmSync(directory, { recursive: true, force: true }); vi.useRealTimers(); });
describe('local conversation persistence', () => {
  it('writes explicit memories durably before returning and reloads edits', () => {
    store = new ConversationStore(directory, true, '7 days');
    const m = store.add('I like tea', 'preference');
    expect(JSON.parse(readFileSync(join(directory, 'memories.json'), 'utf8'))[0].id).toBe(m.id);
    store.edit(m.id, 'I like coffee', 'about_me'); store.dispose();
    store = new ConversationStore(directory, true, '7 days');
    expect(store.memories[0]).toMatchObject({ text: 'I like coffee', source: 'user_edited', category: 'about_me' });
    expect(store.remove([m.id])).toHaveLength(1); expect(store.memories).toEqual([]);
  });
  it('does not acknowledge a failed atomic write or change in-memory values', () => {
    store = new ConversationStore(directory, true, '7 days');
    mkdirSync(join(directory, 'memories.json.tmp'));
    expect(() => store.add('No disk space')).toThrow(); expect(store.memories).toEqual([]);
  });
  it('retains turns across restart, purges old conversations on startup and daily', () => {
    vi.useFakeTimers(); const now = Date.now();
    const c = { id: 'old', startedAt: now - 8 * 86400000, endedAt: now - 8 * 86400000, turns: [] };
    writeFileSync(join(directory, 'conversations.json'), JSON.stringify([c]));
    store = new ConversationStore(directory, true, '7 days'); expect(store.conversations).toEqual([]);
    store.saveConversation({ id: 'new', startedAt: now, endedAt: now, turns: [{ role: 'user', text: 'Christmas campaign', at: now }] });
    store.dispose(); store = new ConversationStore(directory, true, '7 days'); expect(store.conversations[0].turns[0].text).toBe('Christmas campaign');
    vi.advanceTimersByTime(7 * 86400000); expect(store.conversations).toEqual([]);
  });
  it('turning memory off removes both files, cancels deferred summaries, and prevents writes', () => {
    vi.useFakeTimers(); const now = Date.now(); store = new ConversationStore(directory, true, '7 days');
    store.add('tea'); store.saveConversation({ id: 'c', startedAt: now, endedAt: now, turns: [] });
    const generation = store.generation; store.setSummary('c', 'Tea discussion.', ['tea', 'drinks', 'taste'], generation);
    store.configure(false, '7 days'); vi.advanceTimersByTime(1000);
    expect(existsSync(join(directory, 'memories.json'))).toBe(false); expect(existsSync(join(directory, 'conversations.json'))).toBe(false);
    expect(() => store.add('coffee')).toThrow('Memory is off');
    store.setSummary('c', 'Stale', [], generation); expect(store.conversations).toEqual([]);
  });
  it('retention off stores no turns or summaries, while explicit memories still work', () => {
    store = new ConversationStore(directory, true, 'off'); const now = Date.now();
    store.add('tea'); store.saveConversation({ id: 'c', startedAt: now, endedAt: now, turns: [] });
    store.setSummary('c', 'Tea', [], store.generation); store.flush();
    expect(store.memories).toHaveLength(1); expect(existsSync(join(directory, 'conversations.json'))).toBe(false);
  });
  it('never resurrects a deleted conversation from a late summary', () => {
    store = new ConversationStore(directory, true, '7 days'); const now = Date.now();
    store.saveConversation({ id: 'c', startedAt: now, endedAt: now, turns: [] }); const generation = store.generation;
    store.deleteConversations('c'); store.setSummary('c', 'Late summary', [], generation); store.flush(); expect(store.conversations).toEqual([]);
  });
  it('discards malformed entries and unapproved observation fields', () => {
    expect(parseMemories([null, { text: 'bad' }])).toEqual([]);
    const now = Date.now();
    const parsed = parseConversations([{ id: 'c', startedAt: now, endedAt: now, turns: [{ role: 'system', text: 'secret', at: now }, { role: 'user', text: 'hi', at: now }], observedApp: 'SecretApp' }]);
    expect(parsed[0].turns).toHaveLength(1); expect(JSON.stringify(parsed)).not.toContain('SecretApp');
  });
});
