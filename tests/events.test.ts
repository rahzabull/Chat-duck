import { expect, it } from 'vitest';
import { EventBus } from '../src/core/events';
it('delivers typed events and unsubscribes cleanly', () => {
  const bus = new EventBus(); let clicks = 0;
  const off = bus.on('CHARACTER_CLICKED', ({ count }) => { clicks += count; });
  bus.emit('CHARACTER_CLICKED', { count: 2 }); off(); bus.emit('CHARACTER_CLICKED', { count: 9 }); expect(clicks).toBe(2);
});
