import { describe, it, expect } from 'vitest';
import { computeFacingAngle } from '../FoxFacing';

describe('computeFacingAngle', () => {
  it('returns the unchanged current angle when velocity is near zero (no jitter while stationary)', () => {
    const angle = computeFacingAngle(0.001, 0.001, 1.234, 0.1);
    expect(angle).toBeCloseTo(1.234, 5);
  });

  it('smoothly turns toward the movement direction over multiple calls (does not snap instantly)', () => {
    let angle = 0;
    // moving toward world -Z should converge toward atan2(0, -1) = PI (facing -Z)
    for (let i = 0; i < 5; i++) angle = computeFacingAngle(0, -3, angle, 1 / 60);
    const partiallyTurned = angle;
    for (let i = 0; i < 60; i++) angle = computeFacingAngle(0, -3, angle, 1 / 60);
    expect(Math.abs(partiallyTurned)).toBeLessThan(Math.abs(angle - 0.001)); // still turning, not already snapped
    expect(angle).toBeCloseTo(Math.PI, 1);
  });

  it('turning from a small positive angle to a small negative angle takes the short way around (no 359-degree spin)', () => {
    let angle = 0.1;
    for (let i = 0; i < 60; i++) angle = computeFacingAngle(-0.01, 1, angle, 1 / 60);
    // target is atan2(-0.01, 1) ≈ slightly negative — should converge near there, not spin almost all the way around through PI
    expect(angle).toBeGreaterThan(-0.5);
    expect(angle).toBeLessThan(0.2);
  });

  it('wraps correctly across the +PI/-PI seam: a near-+PI angle turning toward a near--PI target takes the short ~0.24rad hop, not a ~6rad spin', () => {
    let angle = 3.0; // near +PI
    const targetAngle = Math.atan2(-0.1, -1); // ≈ -3.0419, near -PI
    for (let i = 0; i < 120; i++) angle = computeFacingAngle(-0.1, -1, angle, 1 / 60);
    // shortest path crosses the seam upward: converges to targetAngle + 2*PI (same physical facing), not targetAngle itself
    expect(angle).toBeCloseTo(targetAngle + Math.PI * 2, 1);
    // total movement from the start must be small (short way), not the ~6.04 rad the long way around would require
    expect(Math.abs(angle - 3.0)).toBeLessThan(1);
  });
});
