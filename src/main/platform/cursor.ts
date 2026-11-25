import { screen } from 'electron';
import type { Point } from '../../shared/types';

export class CursorPoller {
  private timer?: ReturnType<typeof setTimeout>;
  private last?: Point;
  private lastMovedAt = -Infinity;
  private active = false;
  private dragging = false;
  private generation = 0;
  constructor(private changed: (point: Point) => void, private sampleDrag: (point: Point) => void,
    private duckBounds: () => Point & { width: number; height: number }) {}
  configure(active: boolean, dragging: boolean): void {
    if (!active) { this.stop(); return; }
    if (this.active && dragging === this.dragging) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined; this.active = true; this.dragging = dragging; this.generation++;
    this.poll();
  }
  private poll(): void {
    const generation = this.generation;
    const point = screen.getCursorScreenPoint();
    if (this.dragging) this.sampleDrag(point);
    if (!this.last || point.x !== this.last.x || point.y !== this.last.y) {
      this.last = point; this.lastMovedAt = performance.now(); this.changed(point);
    }
    if (!this.active || generation !== this.generation) return;
    const bounds = this.duckBounds();
    const distance = Math.hypot(Math.max(bounds.x - point.x, 0, point.x - bounds.x - bounds.width),
      Math.max(bounds.y - point.y, 0, point.y - bounds.y - bounds.height));
    const rate = this.dragging ? 60 : distance <= 600 || performance.now() - this.lastMovedAt < 1000 ? 20 : 4;
    this.timer = setTimeout(() => { this.timer = undefined; this.poll(); }, 1000 / rate);
  }
  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined; this.last = undefined; this.lastMovedAt = -Infinity;
    this.active = false; this.dragging = false; this.generation++;
  }
}
