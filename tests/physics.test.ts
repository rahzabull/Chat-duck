import { describe, expect, it } from 'vitest';
import { clampPosition, contains, createBody, moving, recover, release, resetPosition, step, VelocityHistory, walk, windowOrigin, type Body } from '../src/core/physics';
import type { WorkArea } from '../src/shared/types';

const size = { width: 320, height: 300 };
const single: WorkArea[] = [{ id: 1, x: 0, y: 0, width: 1920, height: 1040 }];
const offset: WorkArea[] = [{ id: 1, x: 0, y: 0, width: 2560, height: 1400 }, { id: 2, x: 2560, y: 135, width: 2560, height: 1400 }];
const aligned = offset.map(area => ({ ...area, y: 0 }));
// 3840×2160 physical / 1.5 = 2560×1440 DIP; second display is 1920×1080 at 1×.
const mixedDpi: WorkArea[] = [{ id: 1, x: 0, y: 0, width: 2560, height: 1400 }, { id: 2, x: 2560, y: 0, width: 1920, height: 1040 }];
const gap: WorkArea[] = [{ id: 1, x: -2000, y: -200, width: 1920, height: 1040 }, { id: 2, x: 200, y: 300, width: 1920, height: 1040 }];
function settle(body: Body, areas = single): Body {
  for (let i = 0; i < 900 && moving(body); i++) body = step(body, 1 / 60, areas, size).body;
  return body;
}
function seeded(seed: number): () => number { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }

describe('physics in screen DIP', () => {
  it.each([2291, 2290, -109])('keeps landed and rounded bounds above physical floor %s at 150%% scaling', physicalBottom => {
    const scale = 1.5;
    const floor = physicalBottom / scale;
    const area: WorkArea = { id: 1, x: 0, y: floor - 1400, width: 2560, height: 1400 };
    const landed = settle(createBody({ x: 800, y: area.y + size.height }), [area]);
    expect(landed.grounded).toBe(true);
    expect(landed.y).toBe(Math.floor(floor));
    const walking = step(walk(landed, 'right', 80), 1 / 60, [area], size).body;
    for (const body of [landed, walking, recover(landed, [area], size), resetPosition(area, size),
      createBody(clampPosition({ x: 800, y: floor + 100 }, [area], size)), createBody({ x: 800, y: floor })]) {
      const origin = windowOrigin(body, size);
      expect(origin.y + size.height).toBeLessThanOrEqual(floor);
      // Include separate native rounding of origin and height, including odd DIP heights.
      for (const height of [180, 299, 300, 481]) {
        const top = windowOrigin(body, { ...size, height }).y;
        expect(Math.round(top * scale) + Math.round(height * scale)).toBeLessThanOrEqual(physicalBottom);
      }
    }
    expect(moving(landed)).toBe(false);
  });
  it('falls, lands, bounces no more than twice and settles on the taskbar work area', () => {
    let body = createBody({ x: 800, y: 330 }); let landings = 0;
    for (let i = 0; i < 600; i++) { const result = step(body, 1 / 60, single, size); body = result.body; if (result.landed) landings++; }
    expect(body.y).toBe(1040); expect(body.grounded).toBe(true); expect(moving(body)).toBe(false);
    expect(body.bounces).toBeGreaterThan(0); expect(body.bounces).toBeLessThanOrEqual(2); expect(landings).toBeLessThanOrEqual(3);
  });
  it('carries release velocity, applies friction, and bounces at both exterior walls', () => {
    const released = release(createBody({ x: 800, y: 400 }), { x: 700, y: -120 });
    const next = step(released, 1 / 60, single, size).body;
    expect(next.x).toBeGreaterThan(800); expect(next.vy).toBeLessThan(0);
    const right = step(release(createBody({ x: 1759, y: 400 }), { x: 900, y: 0 }), 1 / 60, single, size).body;
    const left = step(release(createBody({ x: 161, y: 400 }), { x: -900, y: 0 }), 1 / 60, single, size).body;
    expect(right.vx).toBeLessThan(0); expect(left.vx).toBeGreaterThan(0);
    expect(settle(released).vx).toBe(0);
  });
  it('removes bounce with reduced motion', () => {
    const result = step(release(createBody({ x: 600, y: 1039 }), { x: 0, y: 500 }), 1 / 60, single, size, true);
    expect(result.landed).toBe(true); expect(result.body.grounded).toBe(true); expect(result.body.bounces).toBe(0);
  });
  it.each([['single', single], ['135px offset dual 2560×1440', offset], ['aligned dual', aligned], ['mixed DPI', mixedDpi], ['negative coordinates and gap', gap]] as const)(
    'keeps 250 random drops on valid ground: %s', (_name, areas) => {
      const rng = seeded(391);
      for (let i = 0; i < 250; i++) {
        const position = clampPosition({ x: rng() * 11000 - 4000, y: rng() * 5000 - 2000 }, [...areas], size);
        let body = release(createBody(position), { x: rng() * 5000 - 2500, y: rng() * 5000 - 2500 });
        for (let frame = 0; frame < 700 && moving(body); frame++) {
          body = step(body, 1 / 60, [...areas], size).body;
          expect(areas.some(area => contains(body, area))).toBe(true);
          expect(Number.isFinite(body.x + body.y)).toBe(true);
        }
        expect(body.grounded).toBe(true);
        expect(areas.some(a => contains(body, a) && body.y === a.y + a.height)).toBe(true);
      }
    });
  it('recovers when the current display is removed and resets bottom-right of primary', () => {
    const body = recover(createBody({ x: 4900, y: 1535 }), [offset[0]], size);
    expect(contains(body, offset[0])).toBe(true); expect(body.y).toBe(1400); expect(body.x).toBeLessThanOrEqual(2400);
    const reset = resetPosition(single[0], size); expect(reset.x).toBe(1736); expect(reset.y).toBe(1040);
  });
  it('walking turns at a height-changing edge and crosses an adjacent same-floor seam', () => {
    let blocked = walk(recover(createBody({ x: 2399, y: 1400 }), offset, size), 'right', 200);
    blocked = step(blocked, 0.04, offset, size).body;
    expect(blocked.direction).toBe('left'); expect(blocked.vx).toBeLessThan(0);
    let crossing = walk(recover(createBody({ x: 2540, y: 1400 }), aligned, size), 'right', 200);
    for (let i = 0; i < 90; i++) crossing = step(crossing, 1 / 60, aligned, size).body;
    expect(crossing.x).toBeGreaterThan(2560); expect(crossing.direction).toBe('right');
  });
  it('walking stops at the requested distance', () => {
    const end = settle(walk(recover(createBody({ x: 700, y: 1040 }), single, size), 'left', 80));
    expect(end.walking).toBe(false); expect(end.x).toBeCloseTo(620, 0);
  });
  it('can be thrown across an offset seam while airborne, then finds the lower floor', () => {
    const body = settle(release(createBody({ x: 2300, y: 700 }), { x: 1200, y: 0 }), offset);
    expect(body.x).toBeGreaterThan(2560); expect(body.y).toBe(1535); expect(body.grounded).toBe(true);
  });
  it('uses recent actual movement for release velocity, and stops stale throws', () => {
    const history = new VelocityHistory(); history.add({ x: 0, y: 0 }, 0); history.add({ x: 60, y: 30 }, 100);
    expect(history.velocity()).toEqual({ x: 600, y: 300 });
    history.add({ x: 60, y: 30 }, 220); history.add({ x: 60, y: 30 }, 240);
    expect(history.velocity()).toEqual({ x: 0, y: 0 }); history.clear(); expect(history.velocity()).toEqual({ x: 0, y: 0 });
  });
});
