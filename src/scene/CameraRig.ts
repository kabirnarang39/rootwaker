import * as THREE from 'three';
import type { LocomotionMode } from '../game/LocomotionState';

export type ViewMode = 'follow' | 'closeUp';

const GROUNDED_OFFSET = new THREE.Vector3(0, 2.4, 4.2);
const COMBAT_OFFSET = new THREE.Vector3(0, 1.9, 3.2);
const CLIMB_OFFSET = new THREE.Vector3(0, 1.2, 3.6);
const GROUNDED_FOV = 55;
const COMBAT_FOV = 48;
const FOLLOW_LERP = 0.08;
const CAMERA_CLEARANCE = 0.3;
const CLOSE_UP_SCALE = 0.5;
const PITCH_MIN = -0.6;
const PITCH_MAX = 0.9;

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

  get orbitPitch(): number {
    return this._orbitPitch;
  }

  get viewMode(): ViewMode {
    return this._viewMode;
  }

  applyLookDelta(deltaYaw: number, deltaPitch: number): void {
    this._orbitYaw += deltaYaw;
    this._orbitPitch = THREE.MathUtils.clamp(this._orbitPitch + deltaPitch, PITCH_MIN, PITCH_MAX);
  }

  cycleViewMode(): void {
    this._viewMode = this._viewMode === 'follow' ? 'closeUp' : 'follow';
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

  update(targetPosition: THREE.Vector3, mode: LocomotionMode, delta: number, obstacles?: THREE.Object3D[]): void {
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
