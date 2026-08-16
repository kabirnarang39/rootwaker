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
const HAWK_EYE_PITCH = -1.3; // radians, steep fixed downward look — a hawk looks down, not level
const FOX_EYE_HEIGHT = 0.35; // meters above the target, roughly fox head height
const FOX_EYE_FORWARD_NUDGE = 0.15; // meters forward of the target so the camera isn't inside the model's own head geometry

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

  update(
    targetPosition: THREE.Vector3,
    mode: LocomotionMode,
    delta: number,
    obstacles?: THREE.Object3D[],
    facingAngle?: number,
  ): void {
    if (this._viewMode === 'hawkEye') {
      const desired = targetPosition
        .clone()
        .add(new THREE.Vector3(HAWK_EYE_HORIZONTAL * Math.sin(this._orbitYaw), HAWK_EYE_HEIGHT, HAWK_EYE_HORIZONTAL * Math.cos(this._orbitYaw)));
      this.camera.position.lerp(desired, 1 - Math.pow(1 - FOLLOW_LERP, delta * 60));
      this.camera.lookAt(targetPosition);
      void HAWK_EYE_PITCH; // lookAt already produces a steep downward angle given the height/horizontal ratio above; named constant documents the intent for future tuning
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, GROUNDED_FOV, 1 - Math.pow(1 - FOLLOW_LERP, delta * 60));
      this.camera.updateProjectionMatrix();
      return;
    }

    if (this._viewMode === 'foxEye') {
      const angle = facingAngle ?? 0;
      const eyePosition = targetPosition
        .clone()
        .add(new THREE.Vector3(0, FOX_EYE_HEIGHT, 0))
        .add(new THREE.Vector3(Math.sin(angle) * FOX_EYE_FORWARD_NUDGE, 0, Math.cos(angle) * FOX_EYE_FORWARD_NUDGE));
      this.camera.position.copy(eyePosition);
      const lookTarget = eyePosition.clone().add(new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle)));
      this.camera.lookAt(lookTarget);
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, GROUNDED_FOV, 1 - Math.pow(1 - FOLLOW_LERP, delta * 60));
      this.camera.updateProjectionMatrix();
      return;
    }

    const offset = this.orbitedOffset(mode);
    let desired = targetPosition.clone().add(offset);

    if (obstacles && obstacles.length > 0) {
      const lookOrigin = targetPosition.clone().add(new THREE.Vector3(0, 1, 0));
      const toDesired = desired.clone().sub(lookOrigin);
      const desiredDistance = toDesired.length();
      if (desiredDistance > 1e-4) {
        raycaster.set(lookOrigin, toDesired.clone().normalize());
        raycaster.far = desiredDistance;
        const hits = raycaster.intersectObjects(obstacles, false);
        if (hits.length > 0 && hits[0].distance < desiredDistance) {
          const clampedDistance = Math.max(0.5, hits[0].distance - CAMERA_CLEARANCE);
          desired = lookOrigin.clone().addScaledVector(toDesired.normalize(), clampedDistance);
        }
      }
    }

    this.camera.position.lerp(desired, 1 - Math.pow(1 - FOLLOW_LERP, delta * 60));

    const targetFov = mode === 'combat' ? COMBAT_FOV : GROUNDED_FOV;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 1 - Math.pow(1 - FOLLOW_LERP, delta * 60));
    this.camera.updateProjectionMatrix();

    const lookTarget = targetPosition.clone().add(new THREE.Vector3(0, 1, 0));
    this.camera.lookAt(lookTarget);
  }
}
