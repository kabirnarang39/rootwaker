import * as THREE from 'three';
import { capsuleVsCapsule, type Capsule } from './collision';
import type { TreeObstacle } from '../scene/TreeObstacleGrid';

/**
 * Pushes `position` out of any overlapping tree trunk, modeling both the
 * player and each trunk as vertical capsules and reusing the existing
 * capsuleVsCapsule primitive's normal/depth output for positional
 * correction. Mutates `position` in place; does not touch Y.
 */
export function resolvePlayerObstacleCollision(
  position: THREE.Vector3,
  playerRadius: number,
  playerHeight: number,
  obstacles: TreeObstacle[],
): void {
  const playerCapsule: Capsule = {
    start: new THREE.Vector3(position.x, position.y, position.z),
    end: new THREE.Vector3(position.x, position.y + playerHeight, position.z),
    radius: playerRadius,
  };

  for (const obstacle of obstacles) {
    const trunkCapsule: Capsule = {
      start: new THREE.Vector3(obstacle.x, position.y, obstacle.z),
      end: new THREE.Vector3(obstacle.x, position.y + obstacle.height, obstacle.z),
      radius: obstacle.radius,
    };
    const result = capsuleVsCapsule(playerCapsule, trunkCapsule);
    if (!result.hit) continue;

    position.x += result.normal.x * result.depth;
    position.z += result.normal.z * result.depth;
    playerCapsule.start.set(position.x, position.y, position.z);
    playerCapsule.end.set(position.x, position.y + playerHeight, position.z);
  }
}
