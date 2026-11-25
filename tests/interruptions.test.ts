import { describe, expect, it } from 'vitest';
import { SpeechQueue } from '../src/core/interruptions';
const options = { muted: false, blocked: false, cooldownMs: 1000 };
describe('speech queue', () => {
  it('shows only one bubble, drops low priority while busy, and retains no backlog', () => {
    let now = 0; const queue = new SpeechQueue(() => now);
    expect(queue.offer('Hello', 'medium', options)).toBe(true);
    expect(queue.offer('Dropped', 'low', options)).toBe(false);
    expect(queue.offer('Also dropped', 'high', options)).toBe(false);
    expect(queue.current?.text).toBe('Hello'); now = 3000; expect(queue.tick()).toBe(true); expect(queue.current).toBeNull();
  });
  it('honours cooldown, minimum duration, and longer text duration', () => {
    let now = 0; const queue = new SpeechQueue(() => now);
    queue.offer('Hello', 'medium', options); expect(queue.current?.expiresAt).toBe(3000);
    queue.dismiss(); now = 3999; expect(queue.offer('Too soon', 'medium', options)).toBe(false);
    now = 4000; expect(queue.offer('x'.repeat(100), 'medium', options)).toBe(true); expect(queue.current?.expiresAt).toBe(10500);
  });
  it('mutes low priority, suppresses everything when blocked, and allows high priority past cooldown', () => {
    const queue = new SpeechQueue(() => 0);
    expect(queue.offer('Muted', 'low', { ...options, muted: true })).toBe(false);
    expect(queue.offer('Paused', 'high', { ...options, blocked: true })).toBe(false);
    expect(queue.offer('User reply', 'medium', { ...options, muted: true })).toBe(true);
    queue.dismiss(); expect(queue.offer('Explicit request', 'high', options)).toBe(true);
  });
});
