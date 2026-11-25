import type { Direction, Point, WorkArea } from '../../shared/types';

export interface Body extends Point {
  vx: number; vy: number; grounded: boolean; bounces: number;
  walking: boolean; walkRemaining: number; direction: Direction;
}
export interface Size { width: number; height: number }
export const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(n, Math.max(min, max)));
export const bottom = (area: WorkArea): number => area.y + area.height;
// Fractional work-area floors must never round the window down into the taskbar.
export const groundY = (area: WorkArea): number => Math.floor(bottom(area));
export function windowOrigin(point: Point, size: Size): Point {
  return { x: Math.round(point.x - size.width / 2), y: Math.floor(point.y - size.height) };
}
export function contains(point: Point, area: WorkArea): boolean {
  return point.x >= area.x && point.x <= area.x + area.width && point.y >= area.y && point.y <= bottom(area);
}
export function nearestArea(point: Point, areas: WorkArea[]): WorkArea {
  if (!areas.length) throw new Error('At least one work area is required');
  return areas.reduce((best, area) => distance(point, area) < distance(point, best) ? area : best);
}
function distance(p: Point, a: WorkArea): number {
  return Math.hypot(p.x - clamp(p.x, a.x, a.x + a.width), p.y - clamp(p.y, a.y, bottom(a)));
}
/** A same-ground connected corridor permits seamless walking across a display seam. */
export function corridor(area: WorkArea, areas: WorkArea[]): WorkArea {
  let left = area.x; let right = area.x + area.width; let top = area.y;
  let changed = true;
  while (changed) {
    changed = false;
    for (const next of areas) {
      if (Math.abs(bottom(next) - bottom(area)) > 1 || next.x > right + 1 || next.x + next.width < left - 1) continue;
      if (next.x < left || next.x + next.width > right) {
        left = Math.min(left, next.x); right = Math.max(right, next.x + next.width);
        top = Math.max(top, next.y); changed = true;
      }
    }
  }
  return { ...area, x: left, y: top, width: right - left, height: bottom(area) - top };
}
/** In flight, unequal floors can share a corridor while the entire window fits
 * their vertical overlap. Walking deliberately uses the stricter same-floor rule. */
function flightCorridor(point: Point, areas: WorkArea[], size: Size): WorkArea {
  const home = nearestArea(point, areas);
  let left = home.x; let right = home.x + home.width; let changed = true;
  while (changed) {
    changed = false;
    for (const area of areas) {
      if (area.y > point.y - size.height || bottom(area) < point.y || area.x > right + 1 || area.x + area.width < left - 1) continue;
      if (area.x < left || area.x + area.width > right) {
        left = Math.min(left, area.x); right = Math.max(right, area.x + area.width); changed = true;
      }
    }
  }
  return { ...home, x: left, width: right - left };
}
export function clampPosition(point: Point, areas: WorkArea[], size: Size): Point {
  const area = corridor(nearestArea(point, areas), areas);
  return { x: clamp(point.x, area.x + size.width / 2, area.x + area.width - size.width / 2),
    y: clamp(point.y, area.y + size.height, groundY(area)) };
}
export function createBody(point: Point): Body {
  return { ...point, vx: 0, vy: 0, grounded: false, bounces: 0, walking: false, walkRemaining: 0, direction: 'right' };
}
export function recover(body: Body, areas: WorkArea[], size: Size): Body {
  const point = clampPosition(body, areas, size);
  const area = nearestArea(point, areas);
  return { ...createBody(point), y: groundY(area), grounded: true, direction: body.direction };
}
export function resetPosition(primary: WorkArea, size: Size): Body {
  return recover(createBody({ x: primary.x + primary.width - size.width / 2 - 24, y: bottom(primary) }), [primary], size);
}
export function release(body: Body, velocity: Point): Body {
  return { ...body, vx: clamp(velocity.x, -1800, 1800), vy: clamp(velocity.y, -1500, 1800),
    grounded: false, walking: false, bounces: 0 };
}
export function walk(body: Body, direction: Direction, distance: number): Body {
  return { ...body, walking: body.grounded, direction, walkRemaining: distance, vx: direction === 'left' ? -42 : 42 };
}
export function moving(body: Body): boolean { return !body.grounded || body.walking || Math.abs(body.vx) > 1; }

export function step(body: Body, elapsed: number, areas: WorkArea[], size: Size, reducedMotion = false): { body: Body; landed: boolean } {
  const next = { ...body }; const dt = clamp(elapsed, 0, 0.04);
  const area = body.walking ? corridor(nearestArea(body, areas), areas) : flightCorridor(body, areas, size);
  const minX = area.x + size.width / 2; const maxX = area.x + area.width - size.width / 2;
  let landed = false;
  const travel = next.walking ? Math.sign(next.vx) * Math.min(Math.abs(next.vx * dt), next.walkRemaining) : next.vx * dt;
  next.x += travel;
  if (next.x < minX || next.x > maxX) {
    next.x = clamp(next.x, minX, maxX);
    next.vx = next.x <= minX ? Math.abs(next.vx) : -Math.abs(next.vx);
    if (!next.walking) next.vx *= 0.55;
    next.direction = next.vx < 0 ? 'left' : 'right';
  }
  if (next.walking) {
    next.y = groundY(area); next.walkRemaining -= Math.abs(travel);
    if (next.walkRemaining <= 0) { next.walking = false; next.vx = 0; }
  } else {
    // Until the whole window clears a seam, use the higher supporting floor.
    const supports = areas.filter(a => a.x < next.x + size.width / 2 - 0.01 && a.x + a.width > next.x - size.width / 2 + 0.01 &&
      a.y <= body.y - size.height + 0.01 && bottom(a) >= body.y - 0.01);
    let ground = supports.length ? Math.min(...supports.map(groundY)) : groundY(nearestArea(next, areas));
    const top = supports.length ? Math.max(...supports.map(a => a.y)) : area.y;
    if (next.y < ground - 0.01) next.grounded = false;
    if (!next.grounded) {
      next.vy += 1850 * dt; next.y += next.vy * dt;
      if (next.y < top + size.height) { next.y = Math.min(ground, top + size.height); next.vy = Math.max(0, next.vy); }
      if (next.y >= ground) {
        // At an unequal-floor seam, select the display under the centre and fit
        // the window there before continuing the fall. Never perch over a gap.
        const landing = nearestArea({ x: next.x, y: ground }, areas);
        const safe = corridor(landing, areas);
        next.x = clamp(next.x, safe.x + size.width / 2, safe.x + safe.width - size.width / 2);
        ground = groundY(landing);
      }
      if (next.y >= ground) {
        next.y = ground; landed = true;
        if (!reducedMotion && next.vy > 150 && next.bounces < 2) {
          next.vy = -Math.min(230, next.vy * 0.25); next.bounces++;
        } else { next.vy = 0; next.grounded = true; }
      }
    }
  }
  if (!next.walking) {
    next.vx *= Math.exp(-(next.grounded ? 9 : 0.8) * dt);
    if (Math.abs(next.vx) < 1) next.vx = 0;
  }
  return { body: next, landed };
}

export class VelocityHistory {
  private samples: Array<Point & { time: number }> = [];
  clear(): void { this.samples = []; }
  add(point: Point, time: number): void {
    this.samples.push({ ...point, time });
    this.samples = this.samples.filter(s => time - s.time <= 120).slice(-12);
  }
  velocity(): Point {
    const first = this.samples[0]; const last = this.samples.at(-1);
    if (!first || !last || last.time - first.time < 8) return { x: 0, y: 0 };
    const seconds = (last.time - first.time) / 1000;
    return { x: (last.x - first.x) / seconds, y: (last.y - first.y) / seconds };
  }
}
