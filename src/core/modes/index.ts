import type { Settings } from '../../shared/types';

export type Mode = 'privacy' | 'do_not_disturb' | 'gaming' | 'focus' | 'conversation' | 'companion';
export const dndActive = (s: Pick<Settings, 'dndUntil'>, now = Date.now()): boolean => s.dndUntil === -1 || s.dndUntil > now;
export function resolveMode(input: { privacy: boolean; dnd: boolean; gaming: boolean; focus: boolean; conversation: boolean }): Mode {
  return input.privacy ? 'privacy' : input.dnd ? 'do_not_disturb' : input.gaming ? 'gaming' : input.focus ? 'focus' : input.conversation ? 'conversation' : 'companion';
}
/** Hysteresis is advanced by existing samples/ticks, never a new polling timer. */
export class ModeResolver {
  gaming = false;
  private entered?: number;
  private exited?: number;
  observe(fullscreen: boolean, now: number): boolean {
    if (fullscreen) {
      this.exited = undefined; this.entered ??= now;
      if (now - this.entered >= 10000) this.gaming = true;
    } else {
      this.entered = undefined; this.exited ??= now;
      if (now - this.exited >= 5000) this.gaming = false;
    }
    return this.gaming;
  }
}
export function inTimeWindow(now: Date, start: string, end: string): boolean {
  const minute = now.getHours() * 60 + now.getMinutes();
  const parse = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3));
  const a = parse(start), b = parse(end);
  return a === b || (a < b ? minute >= a && minute < b : minute >= a || minute < b);
}
export const quietHours = (s: Settings, now = Date.now()): boolean => s.quietHoursEnabled && inTimeWindow(new Date(now), s.quietHoursStart, s.quietHoursEnd);
