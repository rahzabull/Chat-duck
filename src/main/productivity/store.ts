import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, openSync, fsyncSync, closeSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { FOCUS_DEFAULTS, type Task, type Reminder, type Note, type FocusData } from '../../core/productivity/types';
import { validTask, validReminder, validNote, validFocus } from '../../core/productivity/validation';
/** Durable transactions publish only after fsync + atomic rename. Debounced callers share one acknowledgement. */
export class JsonStore<T> {
  private current: T; private timer?: ReturnType<typeof setTimeout>;
  private pending?: T; private waiters: { resolve: () => void; reject: (e: unknown) => void }[] = [];
  readonly recovered: boolean;
  constructor(readonly path: string, fallback: T, private validate: (v: unknown) => v is T) {
    this.current = structuredClone(fallback); let recovered = false;
    if (existsSync(path)) {
      try { const v = JSON.parse(readFileSync(path, 'utf8')); if (v.version !== 1 || !validate(v.data)) throw new Error('Invalid schema'); this.current = v.data; }
      catch { copyFileSync(path, `${path}.corrupt-${Date.now()}`); recovered = true; }
    }
    this.recovered = recovered;
  }
  get value(): T { return structuredClone(this.current); }
  commit(value: T): void {
    if (!this.validate(value)) throw new Error('Invalid productivity data');
    mkdirSync(dirname(this.path), { recursive: true });
    const tmp = `${this.path}.tmp`; writeFileSync(tmp, JSON.stringify({ version: 1, data: value }, null, 2), 'utf8');
    const fd = openSync(tmp, 'r+'); try { fsyncSync(fd); } finally { closeSync(fd); }
    renameSync(tmp, this.path); this.current = structuredClone(value);
  }
  save(value: T): Promise<void> {
    this.pending = structuredClone(value); clearTimeout(this.timer);
    const promise = new Promise<void>((resolve, reject) => this.waiters.push({ resolve, reject }));
    this.timer = setTimeout(() => this.flush(), 250); return promise;
  }
  flush(): void {
    clearTimeout(this.timer); this.timer = undefined; if (this.pending === undefined) return;
    const pending = this.pending; this.pending = undefined; const waiters = this.waiters; this.waiters = [];
    try { this.commit(pending); waiters.forEach(w => w.resolve()); } catch (e) { waiters.forEach(w => w.reject(e)); }
  }
}
const list = <T>(valid: (v: unknown) => v is T) => (v: unknown): v is T[] => Array.isArray(v) && v.length <= 10000 && v.every(valid) && new Set(v.map(i => (i as { id: string }).id)).size === v.length;
export class ProductivityStore {
  tasks: JsonStore<Task[]>; reminders: JsonStore<Reminder[]>; notes: JsonStore<Note[]>; focus: JsonStore<FocusData>;
  constructor(directory: string) {
    this.tasks = new JsonStore(join(directory, 'tasks.json'), [], list(validTask));
    this.reminders = new JsonStore(join(directory, 'reminders.json'), [], list(validReminder));
    this.notes = new JsonStore(join(directory, 'notes.json'), [], list(validNote));
    this.focus = new JsonStore(join(directory, 'focus.json'), { settings: { ...FOCUS_DEFAULTS }, history: [] }, validFocus);
  }
  dispose(): void { this.tasks.flush(); this.reminders.flush(); this.notes.flush(); this.focus.flush(); }
}
