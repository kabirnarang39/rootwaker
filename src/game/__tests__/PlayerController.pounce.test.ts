import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { PlayerController } from '../PlayerController';

describe('PlayerController pounce', () => {
  it('a pounce within range against a grounded target succeeds', () => {
    const pc = new PlayerController(new THREE.Vector3(0, 0, 0));
    const prey = new THREE.Vector3(0, 0, 1.5);
    const result = pc.tryPounce(prey);
    expect(result.success).toBe(true);
  });

  it('a pounce out of range fails and reports the real distance', () => {
    const pc = new PlayerController(new THREE.Vector3(0, 0, 0));
    const prey = new THREE.Vector3(0, 0, 10);
    const result = pc.tryPounce(prey);
    expect(result.success).toBe(false);
    expect(result.distance).toBeCloseTo(10, 5);
  });

  it('a pounce while not grounded (mid-climb/swim) fails regardless of range', () => {
    const pc = new PlayerController(new THREE.Vector3(0, 0, 0));
    pc.beginClimb(new THREE.Vector3(0, 0, 1), 5);
    const prey = new THREE.Vector3(0, 0, 1);
    const result = pc.tryPounce(prey);
    expect(result.success).toBe(false);
  });
});
