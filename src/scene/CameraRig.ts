import * as THREE from 'three';
import type { LocomotionMode } from '../game/LocomotionState';

export type ViewMode = 'follow' | 'closeUp' | 'hawkEye' | 'foxEye';

const VIEW_MODE_ORDER: ViewMode[] = ['follow', 'closeUp', 'hawkEye', 'foxEye'];

const GROUNDED_OFFSET = new THREE.Vector3(0, 2.4, 4.2);
const COMBAT_OFFSET = new THREE.Vector3(0, 1.9, 3.2);
const CLIMB_OFFSET = new THREE.Vector3(0, 1.2, 3.6);
const GROUNDED_FOV = 55;
const COMBAT_FOV = 48;
const FOLLOW_LERP = 0.08;
const CAMERA_CLEARANCE = 0.3;
const CLOSE_UP_SCALE = 0.5;
const PITCH_MIN = -0.25; // steeper pitch-down would sink the camera below/into the ground plane at follow/closeUp distances
const PITCH_MAX = 0.9;

const HAWK_EYE_HEIGHT = 9;
const HAWK_EYE_HORIZONTAL = 2.5; // slight horizontal offset so it isn't a dead-vertical top-down view
// Measured directly against createFox.ts's real rig: the head joint sits at local (0, 0.23, 0.45)
// and the snout tip reaches z~0.88 ahead of the root. FOX_EYE_HEIGHT/FORWARD_NUDGE must clear
// both, or the first-person view sits inside the fox's own head/snout geometry.
const FOX_EYE_HEIGHT = 0.3; // meters above the target, at fox eye/head height
const FOX_EYE_FORWARD_NUDGE = 0.95; // meters forward of the target, clearing the snout tip (~0.88m)
const FOX_SNOUT_TIP_Z = 0.88; // meters — the real measured clearance boundary the nudge above must exceed

const raycaster = new THREE.Raycaster();

function offsetFor(mode: LocomotionMode): THREE.Vector3 {
  if (mode === 'combat') return COMBAT_OFFSET;
  if (mode === 'climbing') return CLIMB_OFFSET;
  return GROUNDED_OFFSET;
}

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private _orbitYaw = 0;
  private _orbitPitch = 0;
  private _viewMode: ViewMode = 'follow';

  constructor() {
    // ponytail: default 16:9 aspect ratio in tests; window.innerWidth/Height in production
    const aspect = typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 16 / 9;
    this.camera = new THREE.PerspectiveCamera(GROUNDED_FOV, aspect, 0.1, 100);
  }

  get orbitYaw(): number {
    return this._orbitYaw;
  }

  get viewMode(): ViewMode {
    return this._viewMode;
  }

  applyLookDelta(deltaYaw: number, deltaPitch: number): void {
    this._orbitYaw += deltaYaw;
    this._orbitPitch = THREE.MathUtils.clamp(this._orbitPitch + deltaPitch, PITCH_MIN, PITCH_MAX);
  }

  cycleViewMode(): void {
    const currentIndex = VIEW_MODE_ORDER.indexOf(this._viewMode);
    this._viewMode = VIEW_MODE_ORDER[(currentIndex + 1) % VIEW_MODE_ORDER.length];
  }

  private orbitedOffset(mode: LocomotionMode): THREE.Vector3 {
    const base = offsetFor(mode);
    const scale = this._viewMode === 'closeUp' ? CLOSE_UP_SCALE : 1;
    // base = (0, height, horizontalDistance) today — decompose, then re-apply yaw/pitch as spherical offset
    const height = base.y * scale;
    const horizontalDistance = base.z * scale;
    const pitchedDistance = horizontalDistance * Math.cos(this._orbitPitch);
    const pitchedHeight = height + horizontalDistance * Math.sin(this._orbitPitch);
    return new THREE.Vector3(
      pitchedDistance * Math.sin(this._orbitYaw),
      pitchedHeight,
      pitchedDistance * Math.cos(this._orbitYaw),
    );
  }

  // Raycasts from lookOrigin toward desired and pulls desired in along that same ray if an
  // obstacle blocks the sightline — shared by the orbit follow/closeUp path and hawkEye, since
  // an overhanging mountain ledge can occlude either exactly the same way a tree trunk can.
  private clampAgainstObstacles(
    lookOrigin: THREE.Vector3,
    desired: THREE.Vector3,
    obstacles?: THREE.Object3D[],
  ): THREE.Vector3 {
    if (!obstacles || obstacles.length === 0) return desired;
    const toDesired = desired.clone().sub(lookOrigin);
    const desiredDistance = toDesired.length();
    if (desiredDistance <= 1e-4) return desired;
    raycaster.set(lookOrigin, toDesired.clone().normalize());
    raycaster.far = desiredDistance;
    const hits = raycaster.intersectObjects(obstacles, false);
    if (hits.length > 0 && hits[0].distance < desiredDistance) {
      const clampedDistance = Math.max(0.5, hits[0].distance - CAMERA_CLEARANCE);
      return lookOrigin.clone().addScaledVector(toDesired.normalize(), clampedDistance);
    }
    return desired;
  }

  update(
    targetPosition: THREE.Vector3,
    mode: LocomotionMode,
    delta: number,
    obstacles?: THREE.Object3D[],
    facingAngle?: number,
  ): void {
    // foxEye's first-person eye point assumes solid ground under the fox — while climbing,
    // the target is a wall-relative position and the facing angle is frozen pointing INTO the
    // wall (the climb gate only fires while moving toward it), so first-person would look
    // straight into rock with no way to turn away. Fall back to the follow camera for this
    // one combination; every other view mode is unaffected.
    const activeViewMode = this._viewMode === 'foxEye' && mode === 'climbing' ? 'follow' : this._viewMode;

    if (activeViewMode === 'hawkEye') {
      const lookOrigin = targetPosition.clone().add(new THREE.Vector3(0, 1, 0));
      const desired = this.clampAgainstObstacles(
        lookOrigin,
        targetPosition
          .clone()
          .add(new THREE.Vector3(HAWK_EYE_HORIZONTAL * Math.sin(this._orbitYaw), HAWK_EYE_HEIGHT, HAWK_EYE_HORIZONTAL * Math.cos(this._orbitYaw))),
        obstacles,
      );
      this.camera.position.lerp(desired, 1 - Math.pow(1 - FOLLOW_LERP, delta * 60));
      this.camera.lookAt(targetPosition);
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, GROUNDED_FOV, 1 - Math.pow(1 - FOLLOW_LERP, delta * 60));
      this.camera.updateProjectionMatrix();
      return;
    }

    if (activeViewMode === 'foxEye') {
      const facing = facingAngle ?? 0;
      // Eye point clears the snout using the pure facing direction (physical head/snout
      // clearance) — the look DIRECTION separately layers the player's own mouse-look on top,
      // so dragging while in first-person visibly turns the view instead of silently doing
      // nothing (which previously left CameraRelativeMove's movement transform decoupled from
      // what the player could see).
      const eyePosition = targetPosition
        .clone()
        .add(new THREE.Vector3(0, FOX_EYE_HEIGHT, 0))
        .add(new THREE.Vector3(Math.sin(facing) * FOX_EYE_FORWARD_NUDGE, 0, Math.cos(facing) * FOX_EYE_FORWARD_NUDGE));
      void FOX_SNOUT_TIP_Z; // documents the real measured clearance boundary FOX_EYE_FORWARD_NUDGE must exceed; enforced by CameraRig.viewmodes.test.ts
      this.camera.position.copy(eyePosition);

      const lookAngle = facing + this._orbitYaw;
      const lookDir = new THREE.Vector3(
        Math.cos(this._orbitPitch) * Math.sin(lookAngle),
        Math.sin(this._orbitPitch),
        Math.cos(this._orbitPitch) * Math.cos(lookAngle),
      );
      this.camera.lookAt(eyePosition.clone().add(lookDir));

      const targetFov = mode === 'combat' ? COMBAT_FOV : GROUNDED_FOV;
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 1 - Math.pow(1 - FOLLOW_LERP, delta * 60));
      this.camera.updateProjectionMatrix();
      return;
    }

    const offset = this.orbitedOffset(mode);
    const lookOrigin = targetPosition.clone().add(new THREE.Vector3(0, 1, 0));
    const desired = this.clampAgainstObstacles(lookOrigin, targetPosition.clone().add(offset), obstacles);

    this.camera.position.lerp(desired, 1 - Math.pow(1 - FOLLOW_LERP, delta * 60));

    const targetFov = mode === 'combat' ? COMBAT_FOV : GROUNDED_FOV;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 1 - Math.pow(1 - FOLLOW_LERP, delta * 60));
    this.camera.updateProjectionMatrix();

    this.camera.lookAt(lookOrigin);
  }
}
