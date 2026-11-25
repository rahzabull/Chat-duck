import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { SettingsStore } from '../src/main/settings/store';

const ownedDirectories: string[] = [];
function fixture(): string {
  const directory = mkdtempSync(join(tmpdir(), 'ducky-settings-test-'));
  ownedDirectories.push(directory); return join(directory, 'settings.json');
}
afterEach(() => {
  vi.useRealTimers();
  for (const directory of ownedDirectories.splice(0)) {
    const resolved = resolve(directory);
    if (!resolved.startsWith(resolve(tmpdir()) + '\\ducky-settings-test-') && !resolved.startsWith(resolve(tmpdir()) + '/ducky-settings-test-')) throw new Error('Unexpected fixture path');
    rmSync(resolved, { recursive: true, force: true });
  }
});
describe('local settings persistence (no Electron)', () => {
  it('persists the talk hint lifetime count independently of memory and clamps corrupt counts', () => {
    const path = fixture(); const store = new SettingsStore(path);
    store.update({ memoryEnabled: false, talkHintCount: 3 }); store.flush();
    expect(new SettingsStore(path).value.talkHintCount).toBe(3);
    store.update({ talkHintCount: 999 }); store.flush(); expect(new SettingsStore(path).value.talkHintCount).toBe(3);
  });
  it('recovers invalid JSON and replaces the file atomically after the debounce', () => {
    vi.useFakeTimers(); const path = fixture(); writeFileSync(path, '{broken');
    const store = new SettingsStore(path); expect(store.value.characterSize).toBe(1);
    store.update({ walking: false }); vi.advanceTimersByTime(500); store.update({ mute: true });
    vi.advanceTimersByTime(749); expect(readFileSync(path, 'utf8')).toBe('{broken');
    vi.advanceTimersByTime(1); const loaded = JSON.parse(readFileSync(path, 'utf8'));
    expect(loaded.walking).toBe(false); expect(loaded.mute).toBe(true); expect(existsSync(`${path}.tmp`)).toBe(false);
  });
  it('flushes unsaved position immediately on quit and reloads it', () => {
    const path = fixture(); const store = new SettingsStore(path);
    store.update({ position: { x: 2300, y: 1400 }, firstLaunchDone: true }); store.flush();
    const loaded = new SettingsStore(path); expect(loaded.value.position).toEqual({ x: 2300, y: 1400 }); expect(loaded.value.firstLaunchDone).toBe(true);
  });
});
describe('hand-edited settings files', () => {
  it('accepts a UTF-8 byte order mark (as written by Windows PowerShell)', () => {
    const path = fixture(); writeFileSync(path, '﻿' + JSON.stringify({ walking: false, appAwareness: true }));
    const store = new SettingsStore(path); expect(store.value.walking).toBe(false); expect(store.value.appAwareness).toBe(true);
  });
});
