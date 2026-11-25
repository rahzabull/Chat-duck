import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { freshMemory, memorySummary, parseMemory, remember, sanitizeName, visit } from '../src/core/memory';
import { MemoryStore } from '../src/main/memory/store';
const directories: string[] = [];
const now = new Date(2026, 0, 1, 12).getTime();
function fixture() { const dir = mkdtempSync(join(tmpdir(), 'ducky-memory-test-')); directories.push(dir); return join(dir, 'memory.json'); }
afterEach(() => {
  vi.useRealTimers();
  for (const dir of directories.splice(0)) {
    const target = resolve(dir);
    if (!target.startsWith(resolve(tmpdir()) + '\\ducky-memory-test-') && !target.startsWith(resolve(tmpdir()) + '/ducky-memory-test-')) throw new Error('Unsafe fixture path');
    rmSync(target, { recursive: true, force: true });
  }
});
describe('bounded local memory', () => {
  it('counts distinct run days, interactions and two notable moments without logging events', () => {
    const m = freshMemory(now); visit(m, now); visit(m, now + 1000); expect(m.daysTogether).toBe(1);
    for (let i = 0; i < 8; i++) remember(m, 'pickup', now);
    remember(m, 'throw', now); remember(m, 'throw', now); remember(m, 'angry', now);
    visit(m, now + 3 * 86400000); expect(m.daysTogether).toBe(2); expect(m.totalPickups).toBe(8); expect(m.throws).toBe(2);
    expect(m.angryClickStreaks).toBe(1); expect(m.runningJokes).toHaveLength(2);
    expect(m.runningJokes.find(j => j.kind === 'most_pickups_in_a_day')?.count).toBe(8);
    visit(m, now + 7 * 86400000); expect(m.pickupsByDay).toEqual([]); expect(m.totalPickups).toBe(8);
  });
  it('validates an allowlist, bounds corrupted fields and strips injected history', () => {
    const m = parseMemory({ ...freshMemory(now), totalPickups: -1, throws: Infinity, preferredName: '<Alex>\n', appHistory: ['secret'], screenshot: 'secret', runningJokes: [{ kind: 'app_visit', date: '2026-01-01', count: 1 }] }, now);
    expect(m.totalPickups).toBe(0); expect(m.throws).toBe(0); expect(m.preferredName).toBe('Alex'); expect(m.runningJokes).toEqual([]);
    expect(JSON.stringify(m)).not.toContain('secret'); expect(sanitizeName('a'.repeat(100))).toHaveLength(30);
    expect(memorySummary(m).join(' ')).toContain('Alex');
  });
  it('debounces, atomically replaces, reloads and flushes dirty state', () => {
    vi.useFakeTimers(); const path = fixture(); const store = new MemoryStore(path, true, () => now);
    remember(store.value, 'pickup', now); store.changed(); vi.advanceTimersByTime(500);
    remember(store.value, 'pickup', now); store.changed(); vi.advanceTimersByTime(749); expect(existsSync(path)).toBe(false);
    vi.advanceTimersByTime(1); expect(JSON.parse(readFileSync(path, 'utf8')).totalPickups).toBe(2); expect(existsSync(path + '.tmp')).toBe(false);
    expect(new MemoryStore(path, true, () => now).value.totalPickups).toBe(2);
    remember(store.value, 'throw', now); store.changed(); store.flush(); expect(new MemoryStore(path, true, () => now).value.throws).toBe(1);
  });
  it('deletes immediately, cancels pending writes and never rewrites while disabled', () => {
    vi.useFakeTimers(); const path = fixture(); const store = new MemoryStore(path, true, () => now);
    store.changed(); store.flush(); writeFileSync(path + '.tmp', 'stale'); store.changed(); store.configure(false);
    expect(existsSync(path)).toBe(false); expect(existsSync(path + '.tmp')).toBe(false);
    store.changed(); vi.advanceTimersByTime(60000); store.flush(); expect(existsSync(path)).toBe(false);
    store.configure(true); store.changed(); store.flush(); expect(existsSync(path)).toBe(true);
    store.forget(); store.flush(); expect(existsSync(path)).toBe(false); expect(store.value.totalPickups).toBe(0);
  });
  it('recovers malformed JSON and deletes old data on disabled startup', () => {
    const path = fixture(); writeFileSync(path, '{oops'); expect(new MemoryStore(path, true, () => now).value).toEqual(freshMemory(now));
    writeFileSync(path, JSON.stringify({ ...freshMemory(now), preferredName: 'Alex' }));
    const store = new MemoryStore(path, false, () => now); expect(existsSync(path)).toBe(false); expect(store.value.preferredName).toBe('');
  });
});
