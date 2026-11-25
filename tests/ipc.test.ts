import { describe, expect, it } from 'vitest';
import { CHANNELS } from '../src/shared/constants';
import { validatePayload } from '../src/shared/schemas/ipc';
describe('IPC allowlist and payload validation', () => {
  it('accepts only the expected shapes', () => {
    expect(validatePayload(CHANNELS.dragStart, { x: 120, y: 240 })).toBe(true);
    expect(validatePayload(CHANNELS.hitTest, true)).toBe(true);
    expect(validatePayload(CHANNELS.getState, undefined)).toBe(true);
    expect(validatePayload(CHANNELS.testAI, undefined)).toBe(true);
    expect(validatePayload(CHANNELS.testAI, { host: 'example.com' })).toBe(false);
    expect(validatePayload(CHANNELS.command, 'settings')).toBe(true);
    expect(validatePayload(CHANNELS.animationComplete, 'landing')).toBe(true);
    expect(validatePayload(CHANNELS.updateSettings, { mute: true })).toBe(true);
  });
  it('rejects unknown channels, unknown enum values, bad numbers, extra keys and payloads on empty messages', () => {
    for (const [channel, value] of [
      ['ducky:execute', 'calc.exe'], [CHANNELS.state, {}], [CHANNELS.cursor, {}],
      [CHANNELS.dragStart, { x: NaN, y: 1 }], [CHANNELS.dragStart, { x: 1, y: 2, extra: true }],
      [CHANNELS.dragStart, { x: 1e8, y: 1 }], [CHANNELS.hitTest, 'true'], [CHANNELS.command, 'shell'],
      [CHANNELS.animationComplete, '<script>'], [CHANNELS.getState, {}], [CHANNELS.dragEnd, null],
      [CHANNELS.updateSettings, { mute: true, arbitrary: true }],
    ] as Array<[string, unknown]>) expect(validatePayload(channel, value)).toBe(false);
  });
});
