import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonStore, ProductivityStore } from '../src/main/productivity/store';
import { validTask, validReminder, validNote, validFocus, day, validAction } from '../src/core/productivity/validation';
import { FOCUS_DEFAULTS, type Task } from '../src/core/productivity/types';
let directory: string;
beforeEach(() => { vi.useFakeTimers(); directory = mkdtempSync(join(tmpdir(), 'ducky-productivity-')); });
afterEach(() => { rmSync(directory, { recursive: true, force: true }); vi.useRealTimers(); });
const task = (): Task => ({ id: 'task1', title: 'Buy bread', priority: 'normal', done: false, subtasks: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
describe('durable schema-versioned productivity stores', () => {
  it('debounces writes, acknowledges only durable state, and restores after restart', async () => {
    const store = new ProductivityStore(directory); const p = store.tasks.save([task()]);
    expect(store.tasks.value).toEqual([]); expect(existsSync(store.tasks.path)).toBe(false);
    await vi.advanceTimersByTimeAsync(250); await p;
    expect(JSON.parse(readFileSync(store.tasks.path, 'utf8'))).toMatchObject({ version: 1, data: [{ title: 'Buy bread' }] });
    expect(existsSync(`${store.tasks.path}.tmp`)).toBe(false); expect(new ProductivityStore(directory).tasks.value).toEqual(store.tasks.value);
  });
  it('rejects failed atomic replacement without modifying the committed value', async () => {
    const store = new ProductivityStore(directory); store.tasks.commit([task()]); mkdirSync(`${store.tasks.path}.tmp`);
    const pending = store.tasks.save([{ ...task(), title: 'Cannot save' }]); const rejection = expect(pending).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(250); await rejection;
    expect(store.tasks.value[0].title).toBe('Buy bread'); expect(JSON.parse(readFileSync(store.tasks.path, 'utf8')).data[0].title).toBe('Buy bread');
  });
  it('preserves corrupted or incompatible files and starts an empty validated list', () => {
    for (const [name, raw] of [['tasks', '{bad json'], ['notes', '{"version":999,"data":[]}'], ['reminders', '{"version":1,"data":[{"id":"bad"}]}']]) writeFileSync(join(directory, `${name}.json`), raw);
    const store = new ProductivityStore(directory); expect(store.tasks.recovered).toBe(true); expect(store.notes.recovered).toBe(true); expect(store.reminders.value).toEqual([]);
    expect(readdirSync(directory).filter(name => name.includes('.corrupt-'))).toHaveLength(3);
  });
  it('validates fields, dates, recurrence, history and IPC shape', () => {
    expect(validTask(task())).toBe(true); expect(validTask({ ...task(), priority: 'super' })).toBe(false); expect(validTask({ ...task(), due: '2026-02-31' })).toBe(false);
    expect(day('2026-99-99')).toBe(false); expect(validTask({ ...task(), dueTime: '25:00' })).toBe(false);
    expect(validReminder({ id: 'r', text: 'x', at: new Date().toISOString(), createdAt: new Date().toISOString(), state: 'scheduled', timezone: 'Invalid/Zone' })).toBe(false);
    expect(validReminder({ id: 'r', text: 'x', at: new Date().toISOString(), createdAt: new Date().toISOString(), state: 'scheduled', timezone: 'UTC', recurrence: { kind: 'weekly', weekdays: [8] } })).toBe(false);
    expect(validNote({ id: 'n', text: '', pinned: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })).toBe(false);
    expect(validFocus({ settings: FOCUS_DEFAULTS, history: [] })).toBe(true); expect(validFocus({ settings: { ...FOCUS_DEFAULTS, focusMinutes: NaN }, history: [] })).toBe(false);
    expect(validAction({ name: 'delete_task', args: { id: 'task1' }, confirmed: true })).toBe(false);
    expect(validAction({ name: 'add_task', args: { title: 'x' } })).toBe(true);
  });
  it('flushes pending writes on shutdown and never exposes mutable committed references', async () => {
    const store = new ProductivityStore(directory); const p = store.tasks.save([task()]); store.dispose(); await p;
    const rows = store.tasks.value; rows[0].title = 'mutated'; expect(store.tasks.value[0].title).toBe('Buy bread');
  });
  it('coalesces rapid settings edits into one write with shared acknowledgement', async () => {
    const store = new JsonStore(join(directory, 'test.json'), 0, (v): v is number => typeof v === 'number'); const spy = vi.spyOn(store, 'commit');
    const a = store.save(1); const b = store.save(2); await vi.advanceTimersByTimeAsync(250); await Promise.all([a, b]);
    expect(spy).toHaveBeenCalledOnce(); expect(store.value).toBe(2);
  });
});
