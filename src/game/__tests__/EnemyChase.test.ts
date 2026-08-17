import * as THREE from 'three';
import { describe, it, expect } from 'vitest';
import { chaseTowardPlayer, horizontalDistance, computeStrikeRange } from '../EnemyChase';

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

describe('horizontalDistance', () => {
  it('ignores Y entirely, even a large vertical offset', () => {
    const a = new THREE.Vector3(0, 100, 0);
    const b = new THREE.Vector3(3, -50, 4);
    expect(horizontalDistance(a, b)).toBeCloseTo(5, 5); // 3-4-5 triangle on x/z only
  });

  it('matches chaseTowardPlayer\'s own stop condition exactly once converged (regression: a viper — radius 0.22, the game\'s tightest strikeRange margin — reproducibly closed to horizontal 0.57m via chaseTowardPlayer while a 3D .distanceTo() including a real ~0.05m terrain-height gap sat at 0.572m, permanently outside its own strikeRange and never striking)', () => {
    const enemyRadius = 0.22;
    const strikeRange = computeStrikeRange(enemyRadius); // 0.57
    const enemyPos = new THREE.Vector3(0.57, 0.127, 0); // chase converged exactly to strikeRange horizontally
    const playerPos = new THREE.Vector3(0, 0.076, 0); // ~0.051m of real terrain-height difference

    const distance3D = enemyPos.distanceTo(playerPos);
    expect(distance3D).toBeGreaterThan(strikeRange); // the bug: 3D distance sits just outside the gate

    const distanceHorizontal = horizontalDistance(enemyPos, playerPos);
    expect(distanceHorizontal).toBeCloseTo(strikeRange, 5); // the fix: horizontal distance is exactly at the gate
    expect(distanceHorizontal).toBeLessThanOrEqual(strikeRange);
  });
});
