import { describe, it, expect } from 'vitest';
import { toCameraRelative } from '../CameraRelativeMove';

describe('toCameraRelative', () => {
  it('at yaw 0, forward input (z=1) becomes world -Z (away from the camera behind the player)', () => {
    const result = toCameraRelative(0, 1, 0);
    expect(result.x).toBeCloseTo(0, 5);
    expect(result.z).toBeCloseTo(-1, 5);
  });

  it('at yaw 0, rightward input (x=1) stays world +X', () => {
    const result = toCameraRelative(1, 0, 0);
    expect(result.x).toBeCloseTo(1, 5);
    expect(result.z).toBeCloseTo(0, 5);
  });

  it('at yaw = PI/2 (camera orbited 90 degrees), forward input rotates into world -X', () => {
    const result = toCameraRelative(0, 1, Math.PI / 2);
    expect(result.x).toBeCloseTo(-1, 5);
    expect(result.z).toBeCloseTo(0, 5);
  });

  it('at yaw = PI (camera orbited 180 degrees), forward input reverses to world +Z', () => {
    const result = toCameraRelative(0, 1, Math.PI);
    expect(result.x).toBeCloseTo(0, 5);
    expect(result.z).toBeCloseTo(1, 5);
  });

  it('preserves magnitude for a diagonal input at yaw 0', () => {
    const result = toCameraRelative(1, 1, 0);
    expect(Math.hypot(result.x, result.z)).toBeCloseTo(Math.hypot(1, 1), 5);
  });
});
