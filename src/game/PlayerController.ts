import * as THREE from 'three';
import { applyGravity, integrate, type PhysicsBody } from './physics';
import type { LocomotionMode } from './LocomotionState';

export interface MoveInput {
  x: number; // -1..1, world-space lateral intent
  z: number; // -1..1, world-space forward intent
  jump: boolean;
}

const MOVE_SPEED = 4.5; // m/s
const JUMP_SPEED = 7.5; // m/s, initial upward velocity

export class PlayerController {
  readonly body: PhysicsBody;
  mode: LocomotionMode = 'grounded';
  private grounded = true;

  constructor(startPosition: THREE.Vector3) {
    this.body = { position: startPosition.clone(), velocity: new THREE.Vector3() };
  }

  get moveSpeed(): number {
    return Math.hypot(this.body.velocity.x, this.body.velocity.z);
  }

  update(input: MoveInput, delta: number, groundHeightAt: (x: number, z: number) => number): void {
    if (this.mode !== 'grounded') return; // climbing/swimming/combat drive their own movement (Tasks 8-9)

    this.body.velocity.x = input.x * MOVE_SPEED;
    this.body.velocity.z = input.z * MOVE_SPEED;

    if (input.jump && this.grounded) {
      this.body.velocity.y = JUMP_SPEED;
      this.grounded = false;
    }

    applyGravity(this.body, delta);
    integrate(this.body, delta);

    const groundY = groundHeightAt(this.body.position.x, this.body.position.z);
    if (this.body.position.y <= groundY) {
      this.body.position.y = groundY;
      this.body.velocity.y = 0;
      this.grounded = true;
    }
  }
}
