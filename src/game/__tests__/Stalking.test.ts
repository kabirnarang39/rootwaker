import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { computeApproachSpeed, checkPounceRange } from '../Stalking';

describe('Stalking', () => {
  it('computeApproachSpeed is high when moving directly toward the prey', () => {
    const prev = new THREE.Vector3(0, 0, 10);
    const now = new THREE.Vector3(0, 0, 8); // moved 2m toward prey at z=0 in 0.5s
    const prey = new THREE.Vector3(0, 0, 0);
    const speed = computeApproachSpeed(now, prev, prey, 0.5);
    expect(speed).toBeCloseTo(4, 1); // 2m / 0.5s = 4 m/s, fully toward prey
  });

  it('computeApproachSpeed is near zero when moving perpendicular to the prey direction', () => {
    const prev = new THREE.Vector3(0, 0, 10);
    const now = new THREE.Vector3(2, 0, 10); // moved sideways, same distance to prey along z
    const prey = new THREE.Vector3(0, 0, 0);
    const speed = computeApproachSpeed(now, prev, prey, 0.5);
    expect(Math.abs(speed)).toBeLessThan(0.5);
  });

  it('computeApproachSpeed is negative when moving away from the prey', () => {
    const prev = new THREE.Vector3(0, 0, 5);
    const now = new THREE.Vector3(0, 0, 7);
    const prey = new THREE.Vector3(0, 0, 0);
    const speed = computeApproachSpeed(now, prev, prey, 0.5);
    expect(speed).toBeLessThan(0);
  });

  it('checkPounceRange reports in-range within maxRange', () => {
    const player = new THREE.Vector3(0, 0, 0);
    const prey = new THREE.Vector3(0, 0, 3);
    const result = checkPounceRange(player, prey, 5);
    expect(result.inRange).toBe(true);
    expect(result.distance).toBeCloseTo(3, 5);
  });

  it('checkPounceRange reports out-of-range beyond maxRange', () => {
    const player = new THREE.Vector3(0, 0, 0);
    const prey = new THREE.Vector3(0, 0, 8);
    const result = checkPounceRange(player, prey, 5);
    expect(result.inRange).toBe(false);
  });
});
