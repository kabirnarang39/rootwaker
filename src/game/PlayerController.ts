import * as THREE from 'three';
import { applyGravity, damp, integrate, type PhysicsBody } from './physics';
import type { LocomotionMode } from './LocomotionState';
import type { WaterBody } from './WaterBody';
import { checkPounceRange } from './Stalking';

export interface MoveInput {
  x: number; // -1..1, world-space lateral intent
  z: number; // -1..1, world-space forward intent
  jump: boolean;
}

const MOVE_SPEED = 4.5; // m/s
const JUMP_SPEED = 7.5; // m/s, initial upward velocity
const CLIMB_SPEED = 2.2; // m/s, deliberately slower than ground move speed — climbing reads as effortful
const SWIM_BUOYANCY_SCALE = -0.6; // negative gravity scale = net upward pull toward the surface
const SWIM_DRAG_PER_SECOND = 0.9;
const SWIM_MOVE_SPEED = 2.5;
const POUNCE_MAX_RANGE = 2; // meters — real fox pounces reach much further, but this is a stylized, readable gameplay range
const MAX_STAMINA = 100;
const STAMINA_DRAIN_PER_SECOND = 15; // climbing for ~6.7s at rest drains a full bar
const STAMINA_REGEN_PER_SECOND = 25; // resting recovers faster than climbing drains — a real ledge pause matters

export class PlayerController {
  readonly body: PhysicsBody;
  mode: LocomotionMode = 'grounded';
  stamina = MAX_STAMINA;
  private grounded = true;
  private climbTopY = 0;
  private lastLedgePosition: THREE.Vector3 | null = null;
  // Open-terrain climb: the reference frame the winding path measures from.
  private climbBaseY = 0;
  private climbBaseZ = 0;
  private climbPathAt: (heightAboveBase: number) => { dx: number; dz: number } = () => ({ dx: 0, dz: 0 });

  constructor(startPosition: THREE.Vector3) {
    this.body = { position: startPosition.clone(), velocity: new THREE.Vector3() };
  }

  get moveSpeed(): number {
    return Math.hypot(this.body.velocity.x, this.body.velocity.z);
  }

  update(input: MoveInput, delta: number, groundHeightAt: (x: number, z: number) => number): void {
    // Climbing/swimming are dispatched by the caller to updateClimb/updateSwim with their own
    // (non-camera-relative) input shape — this must never self-forward into them, since `input`
    // here may be camera-relative and climbing/swimming expect raw axis intent for some fields.
    if (this.mode !== 'grounded') return;

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

  beginClimb(
    surfaceNormal: THREE.Vector3,
    topY: number,
    ledgePosition?: THREE.Vector3,
    pathAt?: (heightAboveBase: number) => { dx: number; dz: number },
  ): void {
    if (this.mode !== 'grounded') return; // canTransition('grounded', 'climbing') is the only legal entry
    this.mode = 'climbing';
    this.climbTopY = topY;
    this.climbBaseY = this.body.position.y;
    this.climbBaseZ = this.body.position.z;
    this.climbPathAt = pathAt ?? (() => ({ dx: 0, dz: 0 }));
    this.body.velocity.set(0, 0, 0);
    this.lastLedgePosition = ledgePosition ? ledgePosition.clone() : this.body.position.clone();
    void surfaceNormal; // reserved for a future wall-facing camera treatment; not needed for movement math here
  }

  restStamina(delta: number): void {
    this.stamina = Math.min(MAX_STAMINA, this.stamina + STAMINA_REGEN_PER_SECOND * delta);
  }

  updateClimb(input: MoveInput, delta: number): void {
    this.stamina = Math.max(0, this.stamina - STAMINA_DRAIN_PER_SECOND * delta);
    if (this.stamina <= 0) {
      if (this.lastLedgePosition) this.body.position.copy(this.lastLedgePosition);
      this.mode = 'grounded';
      this.grounded = true;
      this.body.velocity.set(0, 0, 0);
      return;
    }
    this.body.position.y += input.z * CLIMB_SPEED * delta;
    this.body.position.x += input.x * CLIMB_SPEED * delta * 0.5; // lateral shuffle along the wall, slower than vertical
    // Real winding path: Z is a deterministic function of height climbed so far, always
    // re-derived from the wall's own base (never accumulated frame-to-frame), so it can never
    // drift or double-count. climbPathAt defaults to a zero-offset function, so this is a pure
    // no-op for any caller that never passes a real path.
    const heightAboveBase = this.body.position.y - this.climbBaseY;
    const { dz } = this.climbPathAt(heightAboveBase);
    this.body.position.z = this.climbBaseZ + dz;
    if (this.body.position.y >= this.climbTopY) {
      this.body.position.y = this.climbTopY;
      this.mode = 'grounded';
      this.grounded = true;
    }
  }

  beginSwim(): void {
    if (this.mode !== 'grounded') return;
    this.mode = 'swimming';
  }

  updateSwim(input: MoveInput, delta: number, water: WaterBody): void {
    this.body.velocity.x += input.x * SWIM_MOVE_SPEED * delta;
    this.body.velocity.z += input.z * SWIM_MOVE_SPEED * delta;
    this.body.velocity.addScaledVector(water.current, delta);

    applyGravity(this.body, delta, SWIM_BUOYANCY_SCALE);
    damp(this.body.velocity, SWIM_DRAG_PER_SECOND, delta);
    integrate(this.body, delta);

    if (this.body.position.y >= water.surfaceY) {
      this.body.position.y = water.surfaceY;
      this.body.velocity.y = 0;
      this.mode = 'grounded';
      this.grounded = true;
    }
  }

  /** `maxRange` defaults to the normal pounce reach; Keen Ear passes an extended range so the
   * HUD hunt-prompt (which mirrors this same reach) and the actual pounce stay consistent. */
  tryPounce(preyPosition: THREE.Vector3, maxRange: number = POUNCE_MAX_RANGE): { success: boolean; distance: number } {
    if (this.mode !== 'grounded') return { success: false, distance: this.body.position.distanceTo(preyPosition) };
    const window = checkPounceRange(this.body.position, preyPosition, maxRange);
    return { success: window.inRange, distance: window.distance };
  }
}
