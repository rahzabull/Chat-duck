import type { Point } from '../../shared/types';
import type { DialogueContext, Situation } from './index';
export interface SituationEvent { situation: Situation; context?: DialogueContext }
export class InteractionContext {
  private hovers: number[] = [];
  private hoverStart?: number;
  private lingered = false;
  private clicks: number[] = [];
  private angry = false;
  private forgiveAt?: number;
  private pickups: number[] = [];
  private dragStart?: number;
  private long = false;
  private shaken = false;
  private previous?: Point & { time: number };
  private direction = 0;
  private reversals: number[] = [];
  private awaySince?: number;
  constructor(private clock = Date.now) {}
  hover(active: boolean): SituationEvent | null {
    if (!active) { this.hoverStart = undefined; return null; }
    if (this.hoverStart !== undefined) return null;
    const now = this.clock(); this.hoverStart = now; this.lingered = false;
    this.hovers = [...this.hovers.filter(time => now - time < 60000), now];
    return { situation: this.hovers.length >= 3 ? 'hover_again' : 'hover', context: { count: this.hovers.length } };
  }
  click(): SituationEvent | null {
    const now = this.clock(); this.clicks = this.clicks.filter(time => now - time < 4000);
    if (!this.clicks.length) this.angry = false;
    this.clicks.push(now);
    if (this.forgiveAt !== undefined) this.forgiveAt = now + 20000;
    const count = this.clicks.length;
    if (count >= 5) {
      if (this.angry) return null;
      this.angry = true; this.forgiveAt = now + 20000;
    }
    return { situation: count >= 5 ? 'click_angry' : count >= 2 ? 'click_escalate' : 'click', context: { count } };
  }
  pickup(point: Point): SituationEvent {
    const now = this.clock(); this.hover(false); this.dragStart = now; this.long = false; this.shaken = false;
    this.previous = { ...point, time: now }; this.direction = 0; this.reversals = [];
    this.pickups = [...this.pickups.filter(time => now - time < 120000), now];
    return { situation: this.pickups.length >= 3 ? 'pickup_again' : 'pickup', context: { count: this.pickups.length } };
  }
  drag(point: Point): SituationEvent | null {
    const now = this.clock(); const last = this.previous; this.previous = { ...point, time: now };
    if (this.dragStart === undefined || !last || now <= last.time || this.shaken) return null;
    const speed = (point.x - last.x) / ((now - last.time) / 1000);
    this.reversals = this.reversals.filter(time => now - time <= 1000);
    if (Math.abs(speed) > 1200) {
      const direction = Math.sign(speed);
      if (this.direction && direction !== this.direction) this.reversals.push(now);
      this.direction = direction;
    }
    if (this.reversals.length < 4) return null;
    this.shaken = true; return { situation: 'drag_shaken' };
  }
  release(): void { this.dragStart = undefined; this.previous = undefined; this.reversals = []; }
  idle(idleSeconds: number): void { this.awaySince ??= this.clock() - idleSeconds * 1000; }
  wake(): SituationEvent {
    const awayMs = this.awaySince === undefined ? 0 : Math.max(0, this.clock() - this.awaySince);
    this.awaySince = undefined;
    return { situation: awayMs < 15 * 60000 ? 'wake_short' : 'wake_long', context: { awayMs } };
  }
  tick(): SituationEvent[] {
    const now = this.clock(); const events: SituationEvent[] = [];
    if (this.hoverStart !== undefined && !this.lingered && now - this.hoverStart > 2500) {
      this.lingered = true; events.push({ situation: 'hover_linger' });
    }
    if (this.dragStart !== undefined && !this.long && now - this.dragStart > 4000) {
      this.long = true; events.push({ situation: 'drag_long' });
    }
    if (this.forgiveAt !== undefined && now >= this.forgiveAt) {
      this.forgiveAt = undefined; events.push({ situation: 'click_forgive' });
    }
    return events;
  }
  suspend(): void { this.hover(false); this.release(); this.forgiveAt = undefined; }
}
export function landingSituation(height: number, hitWall: boolean): Situation {
  return hitWall ? 'thrown_wall' : height > 500 ? 'drop_big' : 'drop_small';
}
