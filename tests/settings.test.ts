import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, isSettingsPatch, parseSettings } from '../src/shared/schemas/settings';
describe('settings schema', () => {
  it('defaults AI off and validates model and numeric loopback port on disk and IPC', () => {
    expect(parseSettings({})).toMatchObject({ aiEnabled: false, aiModel: '', ollamaPort: 11434 });
    expect(parseSettings({ aiEnabled: true, aiModel: 'gemma3:4b', ollamaPort: 12000 })).toMatchObject({ aiEnabled: true, aiModel: 'gemma3:4b', ollamaPort: 12000 });
    expect(isSettingsPatch({ aiEnabled: true, aiModel: 'qwen3:8b', ollamaPort: 12000 })).toBe(true);
    expect(isSettingsPatch({ aiModel: '' })).toBe(true);
    for (const ollamaPort of [0, 65536, NaN, 11434.5, '11434', 'evil.example']) {
      expect(isSettingsPatch({ ollamaPort })).toBe(false); expect(parseSettings({ ollamaPort }).ollamaPort).toBe(11434);
    }
    for (const aiModel of [null, 3, 'x'.repeat(201), 'bad\nmodel', '<script>']) expect(isSettingsPatch({ aiModel })).toBe(false);
    expect(isSettingsPatch({ ollamaHost: 'example.com' })).toBe(false);
    expect(isSettingsPatch({ aiEnabled: 'true' })).toBe(false);
  });
  it('defaults app awareness off and accepts only an explicit boolean opt-in', () => {
    expect(parseSettings({}).appAwareness).toBe(false);
    expect(parseSettings({ appAwareness: true }).appAwareness).toBe(true);
    expect(parseSettings({ appAwareness: 'true' }).appAwareness).toBe(false);
    expect(isSettingsPatch({ appAwareness: true })).toBe(true);
    expect(isSettingsPatch({ appAwareness: 1 })).toBe(false);
  });
  it.each([null, undefined, false, 'garbage', [], 12])('turns invalid input into defaults: %j', value => {
    expect(parseSettings(value)).toEqual(DEFAULT_SETTINGS);
  });
  it('merges partial valid settings and ignores bad fields and unknown keys', () => {
    expect(parseSettings({ walking: false, mute: 'yes', characterSize: NaN, secret: true })).toEqual({ ...DEFAULT_SETTINGS, walking: false });
    expect(parseSettings({ position: { x: -200, y: 400 }, firstLaunchDone: true }).position).toEqual({ x: -200, y: 400 });
  });
  it('clamps loaded numeric values and rejects non-finite positions', () => {
    expect(parseSettings({ characterSize: 90, idleToSleepMinutes: 0 }).characterSize).toBe(1.6);
    expect(parseSettings({ characterSize: 0 }).characterSize).toBe(0.6);
    expect(parseSettings({ idleToSleepMinutes: 0 }).idleToSleepMinutes).toBe(1);
    expect(parseSettings({ position: { x: Infinity, y: 0 } }).position).toBeNull();
  });
  it('requires valid editable patches with no unknown or internal keys', () => {
    expect(isSettingsPatch({ characterSize: 1.2, walking: false })).toBe(true);
    for (const value of [{}, { firstLaunchDone: true }, { position: null }, { mute: 1 }, { characterSize: 5 }, { unknown: false }]) expect(isSettingsPatch(value)).toBe(false);
  });
});
