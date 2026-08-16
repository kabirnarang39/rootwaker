import * as THREE from 'three';

/**
 * Tuned above real-world 9.8 m/s^2 for a readable, snappy jump/fall arc —
 * a deliberate game-feel choice, not a physics error.
 */
export const GRAVITY_MPS2 = 22;

export interface PhysicsBody {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
}

export function applyGravity(body: PhysicsBody, delta: number, scale = 1): void {
  body.velocity.y -= GRAVITY_MPS2 * scale * delta;
}

export function integrate(body: PhysicsBody, delta: number): void {
  body.position.addScaledVector(body.velocity, delta);
}

export function damp(velocity: THREE.Vector3, dragPerSecond: number, delta: number): void {
  velocity.multiplyScalar(Math.pow(1 - dragPerSecond, delta));
}
