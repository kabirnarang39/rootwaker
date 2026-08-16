import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { resolvePlayerObstacleCollision } from '../ObstacleCollision';
import type { TreeObstacle } from '../../scene/TreeObstacleGrid';

describe('resolvePlayerObstacleCollision', () => {
  it('pushes the player out of an overlapping trunk', () => {
    const position = new THREE.Vector3(0.1, 0, 0); // 0.1m from a trunk at origin, player radius 0.3 + trunk radius 0.2 = 0.5m combined
    const obstacles: TreeObstacle[] = [{ x: 0, z: 0, radius: 0.2, height: 2 }];
    resolvePlayerObstacleCollision(position, 0.3, 1.8, obstacles);
    const distFromTrunk = Math.hypot(position.x, position.z);
    expect(distFromTrunk).toBeGreaterThanOrEqual(0.5 - 1e-4);
  });

  it('leaves the player untouched when far from every obstacle', () => {
    const position = new THREE.Vector3(10, 0, 10);
    const obstacles: TreeObstacle[] = [{ x: 0, z: 0, radius: 0.2, height: 2 }];
    resolvePlayerObstacleCollision(position, 0.3, 1.8, obstacles);
    expect(position.x).toBeCloseTo(10, 5);
    expect(position.z).toBeCloseTo(10, 5);
  });

  it('resolves against the nearest of multiple overlapping obstacles without throwing', () => {
    const position = new THREE.Vector3(0, 0, 0);
    const obstacles: TreeObstacle[] = [
      { x: 0.2, z: 0, radius: 0.2, height: 2 },
      { x: -0.2, z: 0, radius: 0.2, height: 2 },
    ];
    expect(() => resolvePlayerObstacleCollision(position, 0.3, 1.8, obstacles)).not.toThrow();
  });

  it('does not move the player vertically (Y unaffected)', () => {
    const position = new THREE.Vector3(0.1, 1.234, 0);
    const obstacles: TreeObstacle[] = [{ x: 0, z: 0, radius: 0.2, height: 2 }];
    resolvePlayerObstacleCollision(position, 0.3, 1.8, obstacles);
    expect(position.y).toBeCloseTo(1.234, 5);
  });
});
