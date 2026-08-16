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
// Below this distance from the target, the third-person camera is close enough that it would
// clip through the fox's own body rather than comfortably frame it (the obstacle clamp's floor
// was lowered from 0.5 to 0.05 to fix foxEye's own obstacles, which routinely sit under 1m —
// but that same lower floor lets a close third-person obstacle collapse the camera onto the
// fox's own geometry instead of the world beyond it). Reuses the same own-body render layer
// foxEye already excludes, rather than tuning a second obstacle-clearance constant.
const NEAR_SELF_HIDE_DISTANCE = 0.6;
const CLOSE_UP_SCALE = 0.5;
const PITCH_MIN = -0.25; // steeper pitch-down would sink the camera below/into the ground plane at follow/closeUp distances
const PITCH_MAX = 0.9;

const HAWK_EYE_HEIGHT = 9;
const HAWK_EYE_HORIZONTAL = 2.5; // slight horizontal offset so it isn't a dead-vertical top-down view
// Measured directly against createFox.ts's real BIND POSE (root-relative world bounding boxes
// of every mesh via Box3.setFromObject, not local joint offsets — the spine's own +0.55 offset
// would otherwise silently throw the numbers off): eye spheres at y 0.785-0.855, the forwardmost
// mesh (the snout tip) at z=0.880, head-shell/ear cones extending up to y=1.197. These numbers
// only hold at runtime because Rig.captureBasePose()/applyPositionOffset() (see rig/Clip.ts)
// apply clip position keyframes as offsets from this bind pose rather than overwriting it — an
// earlier version of this fix measured the ANIMATED pose while that bug was still live, which
// had silently lost the spine's bind-pose offset and put "eye level" 0.55m too low. Height 0.82
// sits at true eye level, clear of the ears above it; forward nudge 1.0 clears the snout tip
// with a real ~0.12m margin (measured via a nearest-mesh-distance probe against every mesh, not
// just the single snout-tip figure) — placing the eye just past the fox's own face, matching
// the common FPS convention of keeping the whole head model out of the first-person frustum
// entirely rather than trying to sit inside it.
const FOX_EYE_HEIGHT = 0.82;
const FOX_EYE_FORWARD_NUDGE = 1.0;
const FOX_EYE_LOOK_YAW_RANGE = 1.2; // radians either side of straight-ahead — a fox can glance, not spin its head

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
  // orbitYaw is a shared, unbounded accumulator with follow/closeUp/hawkEye — entering foxEye
  // with whatever yaw happened to be dragged up in another mode would otherwise point the
  // first-person view at the fox's own body. Recording the yaw at entry and clamping orbitYaw
  // itself around that base (in applyLookDelta, at accumulation time — see below) keeps
  // foxEye's look always starting straight ahead with no windup deadzone.
  private _foxEyeYawBase = 0;
  // The climbing fallback overrides which camera RENDERS without ever changing _viewMode, so
  // cycleViewMode()'s entry-refresh alone can't see "foxEye resuming after a climb" as a
  // transition — tracked separately here and refreshed in update() the frame climbing ends.
  private _wasClimbingInFoxEye = false;

  constructor() {
    // ponytail: default 16:9 aspect ratio in tests; window.innerWidth/Height in production
    const aspect = typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 16 / 9;
    this.camera = new THREE.PerspectiveCamera(GROUNDED_FOV, aspect, 0.1, 100);
    // Layer 1 is reserved for "the player's own body" (see createFox.ts) — enabled by default
    // so follow/closeUp/hawkEye render the fox normally, disabled only in foxEye below, since
    // no eye-position tuning reliably keeps wide/glowing parts like the ears out of a close-range
    // first-person frustum.
    this.camera.layers.enable(1);
  }

  get orbitYaw(): number {
    return this._orbitYaw;
  }

  get viewMode(): ViewMode {
    return this._viewMode;
  }

  applyLookDelta(deltaYaw: number, deltaPitch: number): void {
    this._orbitYaw += deltaYaw;
    if (this._viewMode === 'foxEye') {
      // Clamp the shared accumulator itself around the entry base — at accumulation time, not
      // just when read — so continuing to drag past the glance range doesn't "wind up" extra
      // yaw that then has to be dragged back before the view moves again.
      this._orbitYaw = THREE.MathUtils.clamp(
        this._orbitYaw,
        this._foxEyeYawBase - FOX_EYE_LOOK_YAW_RANGE,
        this._foxEyeYawBase + FOX_EYE_LOOK_YAW_RANGE,
      );
    }
    this._orbitPitch = THREE.MathUtils.clamp(this._orbitPitch + deltaPitch, PITCH_MIN, PITCH_MAX);
  }

  cycleViewMode(): void {
    const currentIndex = VIEW_MODE_ORDER.indexOf(this._viewMode);
    this._viewMode = VIEW_MODE_ORDER[(currentIndex + 1) % VIEW_MODE_ORDER.length];
    if (this._viewMode === 'foxEye') this._foxEyeYawBase = this._orbitYaw;
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
      // Floored at a small epsilon rather than the old 0.5m: that larger floor could push the
      // eye/camera PAST a hit closer than ~0.8m (hit.distance - CAMERA_CLEARANCE going negative,
      // then getting floored back UP to 0.5, past the obstacle) — a real bug for foxEye, where
      // obstacles routinely sit well under 1m away. 0.05 is always < hits[0].distance here (the
      // raycast only reaches this branch when something was actually hit), so the camera never
      // ends up beyond what the ray hit, no matter how close that hit is.
      const clampedDistance = Math.max(0.05, hits[0].distance - CAMERA_CLEARANCE);
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

    const isClimbingInFoxEye = this._viewMode === 'foxEye' && mode === 'climbing';
    if (this._viewMode === 'foxEye' && this._wasClimbingInFoxEye && !isClimbingInFoxEye) {
      // Just finished climbing while foxEye was selected — refresh so the resumed first-person
      // view doesn't inherit whatever yaw drifted while the fallback camera was on screen.
      this._foxEyeYawBase = this._orbitYaw;
    }
    this._wasClimbingInFoxEye = isClimbingInFoxEye;

    if (activeViewMode === 'foxEye') this.camera.layers.disable(1);
    else this.camera.layers.enable(1);

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
      // Dense canopy or a low mountain overhang can clamp hawkEye's high offset all the way
      // down near chest height — same self-clip risk as follow/closeUp, same fix.
      if (this.camera.position.distanceTo(lookOrigin) < NEAR_SELF_HIDE_DISTANCE) {
        this.camera.layers.disable(1);
      }
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
      const eyeHeightPoint = targetPosition.clone().add(new THREE.Vector3(0, FOX_EYE_HEIGHT, 0));
      const desiredEye = eyeHeightPoint
        .clone()
        .add(new THREE.Vector3(Math.sin(facing) * FOX_EYE_FORWARD_NUDGE, 0, Math.cos(facing) * FOX_EYE_FORWARD_NUDGE));
      // The forward nudge (1.0m) exceeds the player's own collision radius (0.35m), so without
      // this the eye point could end up past a tree trunk or wall the fox's body is still
      // blocked by. Reuses the same raycast-clamp obstacle avoidance as every other view mode —
      // raycasting FROM eye height (not the feet) so a blocked ray pulls the eye straight back
      // along the same height, never dragging it down into the fox's own head/body.
      const eyePosition = this.clampAgainstObstacles(eyeHeightPoint, desiredEye, obstacles);
      this.camera.position.copy(eyePosition);

      // orbitYaw is shared, unbounded state — only the (clamped) delta since foxEye was
      // entered is applied, so first-person look always starts straight ahead regardless of
      // whatever yaw was accumulated in another mode.
      const yawOffset = THREE.MathUtils.clamp(this._orbitYaw - this._foxEyeYawBase, -FOX_EYE_LOOK_YAW_RANGE, FOX_EYE_LOOK_YAW_RANGE);
      const lookAngle = facing + yawOffset;
      // Sign matches the orbit path's convention (positive pitch -> camera rises -> lookAt tilts
      // DOWN): dragging the mouse down must look down in first-person the same way it does in
      // third-person, not the opposite.
      const lookDir = new THREE.Vector3(
        Math.cos(this._orbitPitch) * Math.sin(lookAngle),
        -Math.sin(this._orbitPitch),
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

    // An obstacle can now clamp the third-person camera very close to the fox (the floor that
    // used to prevent this was lowered to fix foxEye's own, much closer, obstacle clearance —
    // see NEAR_SELF_HIDE_DISTANCE). Rather than clip through the fox's own geometry at close
    // range, hide it via the same layer foxEye already uses — the world beyond stays visible.
    // Distance from lookOrigin (chest height), not targetPosition (the root/feet) — lookOrigin
    // is already offset 1m up, so even a maximally-clamped camera sits >=1m from the root
    // while sitting right on top of the fox's own head/chest geometry; measuring from the root
    // would never trigger this at all.
    if (this.camera.position.distanceTo(lookOrigin) < NEAR_SELF_HIDE_DISTANCE) {
      this.camera.layers.disable(1);
    }

    const targetFov = mode === 'combat' ? COMBAT_FOV : GROUNDED_FOV;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 1 - Math.pow(1 - FOLLOW_LERP, delta * 60));
    this.camera.updateProjectionMatrix();

    this.camera.lookAt(lookOrigin);
  }
}
