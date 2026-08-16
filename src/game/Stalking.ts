import * as THREE from 'three';

export interface PounceWindow {
  inRange: boolean;
  distance: number;
}

/**
 * Speed component of the player's movement specifically toward `preyPos` —
 * not raw movement speed. Moving sideways past prey shouldn't alert it the
 * way running straight at it does.
 */
export function computeApproachSpeed(
  playerPos: THREE.Vector3,
  playerPrevPos: THREE.Vector3,
  preyPos: THREE.Vector3,
  delta: number,
): number {
  if (delta <= 0) return 0;
  const movement = playerPos.clone().sub(playerPrevPos);
  const toPreyBefore = preyPos.clone().sub(playerPrevPos);
  const distBefore = toPreyBefore.length();
  if (distBefore < 1e-6) return 0;
  const towardPreyDir = toPreyBefore.normalize();
  const approachDistance = movement.dot(towardPreyDir); // positive dot = moving toward prey
  return approachDistance / delta;
}

export function checkPounceRange(playerPos: THREE.Vector3, preyPos: THREE.Vector3, maxRange: number): PounceWindow {
  const distance = playerPos.distanceTo(preyPos);
  return { inRange: distance <= maxRange, distance };
}
