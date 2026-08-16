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
const CLIMB_SPEED = 2.2; // m/s, deliberately slower than ground move speed — climbing reads as effortful

export class PlayerController {
  readonly body: PhysicsBody;
  mode: LocomotionMode = 'grounded';
  private grounded = true;
  private climbTopY = 0;

  constructor(startPosition: THREE.Vector3) {
    this.body = { position: startPosition.clone(), velocity: new THREE.Vector3() };
  }

  get moveSpeed(): number {
    return Math.hypot(this.body.velocity.x, this.body.velocity.z);
  }

  update(input: MoveInput, delta: number, groundHeightAt: (x: number, z: number) => number): void {
    if (this.mode === 'climbing') {
      this.updateClimb(input, delta);
      return;
    }
    if (this.mode !== 'grounded') return; // swimming/combat drive their own movement (Tasks 9+)

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

  beginClimb(surfaceNormal: THREE.Vector3, topY: number): void {
    if (this.mode !== 'grounded') return; // canTransition('grounded', 'climbing') is the only legal entry
    this.mode = 'climbing';
    this.climbTopY = topY;
    this.body.velocity.set(0, 0, 0);
    void surfaceNormal; // reserved for wall-facing orientation in the CameraRig (Task 10), not needed for movement math here
  }

  updateClimb(input: MoveInput, delta: number): void {
    this.body.position.y += input.z * CLIMB_SPEED * delta;
    this.body.position.x += input.x * CLIMB_SPEED * delta * 0.5; // lateral shuffle along the wall, slower than vertical
    if (this.body.position.y >= this.climbTopY) {
      this.body.position.y = this.climbTopY;
      this.mode = 'grounded';
      this.grounded = true;
    }
  }
}
