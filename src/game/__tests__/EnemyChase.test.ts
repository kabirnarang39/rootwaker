import * as THREE from 'three';
import { describe, it, expect } from 'vitest';
import { chaseTowardPlayer } from '../EnemyChase';

describe('chaseTowardPlayer', () => {
  it('moves toward the target at the given speed for one frame', () => {
    const pos = new THREE.Vector3(0, 0, 0);
    chaseTowardPlayer(pos, new THREE.Vector3(10, 0, 0), 5, 0.1, 0);
    expect(pos.x).toBeCloseTo(0.5, 5);
    expect(pos.z).toBeCloseTo(0, 5);
  });

  it('never overshoots past stopDistance from the target', () => {
    const pos = new THREE.Vector3(0, 0, 0);
    // huge speed*delta step, but only 3m of real gap beyond the 1m stop distance
    chaseTowardPlayer(pos, new THREE.Vector3(4, 0, 0), 100, 1, 1);
    expect(pos.distanceTo(new THREE.Vector3(4, 0, 0))).toBeCloseTo(1, 5);
  });

  it('does nothing once already within stopDistance (regression: a negative gap must not push the enemy backward away from the player)', () => {
    const pos = new THREE.Vector3(0, 0, 0.5);
    chaseTowardPlayer(pos, new THREE.Vector3(0, 0, 0), 5, 0.1, 1);
    expect(pos.z).toBeCloseTo(0.5, 5);
  });

  it('closes distance diagonally, not just on one axis', () => {
    const pos = new THREE.Vector3(0, 0, 0);
    chaseTowardPlayer(pos, new THREE.Vector3(3, 0, 4), 5, 1, 0); // 3-4-5 triangle, distance 5
    expect(pos.x).toBeCloseTo(3, 5);
    expect(pos.z).toBeCloseTo(4, 5);
  });
});
