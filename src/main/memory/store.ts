import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { freshMemory, parseMemory, type Memory } from '../../core/memory';
export class MemoryStore {
  value: Memory;
  private timer?: ReturnType<typeof setTimeout>;
  constructor(private path: string, private enabled = true, private clock = Date.now) {
    let loaded: unknown;
    if (enabled) try { if (existsSync(path)) loaded = JSON.parse(readFileSync(path, 'utf8')); } catch { /* invalid memory starts fresh */ }
    this.value = parseMemory(loaded, clock());
    if (!enabled) this.forget();
  }
  configure(enabled: boolean): void { this.enabled = enabled; if (!enabled) this.forget(); }
  changed(): void { if (!this.enabled) return; if (this.timer) clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), 750); }
  forget(): void {
    if (this.timer) clearTimeout(this.timer); this.timer = undefined;
    // Deletion errors reach the caller: never claim forgetting succeeded when it did not.
    rmSync(this.path, { force: true }); rmSync(`${this.path}.tmp`, { force: true }); this.value = freshMemory(this.clock());
  }
  flush(): void {
    if (this.timer) clearTimeout(this.timer); const dirty = this.timer !== undefined; this.timer = undefined;
    if (!this.enabled || !dirty) return;
    try { mkdirSync(dirname(this.path), { recursive: true }); writeFileSync(`${this.path}.tmp`, JSON.stringify(this.value, null, 2), 'utf8'); renameSync(`${this.path}.tmp`, this.path); }
    catch { console.error('[ducky] Could not save memory'); }
  }
}
