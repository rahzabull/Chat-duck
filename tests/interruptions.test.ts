import { describe, expect, it } from 'vitest';
import { SpeechQueue } from '../src/core/interruptions';
const options = { muted: false, blocked: false, cooldownMs: 1000 };
describe('speech queue', () => {
  it('shows only one bubble, drops low priority while busy, and retains no backlog', () => {
    let now = 0; const queue = new SpeechQueue(() => now);
    expect(queue.offer('Hello', 'medium', options)).toBe(true);
    expect(queue.offer('Dropped', 'low', options)).toBe(false);
    expect(queue.offer('Also dropped', 'medium', options)).toBe(false);
    expect(queue.current?.text).toBe('Hello'); now = 3000; expect(queue.tick()).toBe(true); expect(queue.current).toBeNull();
  });
  it('replaces the first beat in the same bubble after the supplied pause', () => {
    let now = 0; const queue = new SpeechQueue(() => now);
    queue.offer('Hello', 'low', { ...options, then: 'x'.repeat(100), followUpDelayMs: 1800 });
    now = 1799; expect(queue.tick()).toBe(false); expect(queue.current?.text).toBe('Hello');
    now = 1800; expect(queue.tick()).toBe(true); expect(queue.current?.text).toBe('x'.repeat(100));
    expect(queue.current?.expiresAt).toBe(8300);
    now = 8300; queue.tick(); expect(queue.current).toBeNull();
  });
  it('drops follow-ups on a user interruption, dismissal or higher priority line', () => {
    for (const action of ['interrupt', 'dismiss', 'preempt'] as const) {
      let now = 0; const queue = new SpeechQueue(() => now);
      queue.offer('Hello', 'low', { ...options, then: 'Stale' });
      now = 1000;
      if (action === 'preempt') expect(queue.offer('Urgent', 'high', options)).toBe(true);
      else queue[action]();
      now = 2000; queue.tick(); expect(queue.current?.text).not.toBe('Stale');
      expect(queue.current?.text).toBe(action === 'preempt' ? 'Urgent' : undefined);
    }
  });
  it('rejects low and medium speech in fullscreen, including follow-ups', () => {
    const queue = new SpeechQueue(() => 0);
    for (const priority of ['low', 'medium'] as const) expect(queue.offer('No', priority, { ...options, fullscreen: true, then: 'No either' })).toBe(false);
    expect(queue.offer('Yes', 'high', { ...options, fullscreen: true })).toBe(true);
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
