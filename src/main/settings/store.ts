import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseSettings } from '../../shared/schemas/settings';
import type { Settings } from '../../shared/types';

export class SettingsStore {
  value: Settings;
  private timer?: ReturnType<typeof setTimeout>;
  constructor(private path: string) {
    let loaded: unknown;
    try { if (existsSync(path)) loaded = JSON.parse(readFileSync(path, 'utf8').replace(/^﻿/, '')); }
    catch { console.warn('[ducky] Invalid settings file; using defaults'); }
    this.value = parseSettings(loaded);
  }
  update(patch: Partial<Settings>): void {
    this.value = parseSettings({ ...this.value, ...patch });
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 750);
  }
  flush(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    try {
      mkdirSync(dirname(this.path), { recursive: true });
      writeFileSync(`${this.path}.tmp`, JSON.stringify(this.value, null, 2), 'utf8');
      renameSync(`${this.path}.tmp`, this.path);
    } catch (error) { console.error('[ducky] Could not save settings', error); }
  }
}
