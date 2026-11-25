import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { dragPose } from '../src/animation/figma/poses';

describe('Rahul Figma adapter', () => {
  it('parses every generated pose in Chromium and verifies the real SVG adapter lifecycle', () => {
    const output = execFileSync(process.execPath, [resolve('scripts/figma/check.mjs')], { encoding: 'utf8', windowsHide: true, timeout: 60000 });
    const result = JSON.parse(output.trim());
    expect(result.poses).toBe(20); expect(result.paths).toBe(312); expect(result.assertions).toBeGreaterThan(400);
  }, 65000);
  it('uses signed horizontal motion only when it dominates the vertical motion', () => {
    expect(dragPose(-20, 2)).toBe('dragged_left'); expect(dragPose(20, 2)).toBe('dragged_right');
    expect(dragPose(2, -20)).toBe('dragged_up_down'); expect(dragPose(0, 0)).toBe('dragged_up_down');
  });
});
