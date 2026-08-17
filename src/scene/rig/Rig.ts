import * as THREE from 'three';

export type JointName =
  | 'root'
  | 'spine'
  | 'head'
  | 'jaw'
  | 'earL'
  | 'earR'
  | 'shoulderL'
  | 'shoulderR'
  | 'forepawL'
  | 'forepawR'
  | 'hipL'
  | 'hipR'
  | 'hindpawL'
  | 'hindpawR'
  | 'tail0'
  | 'tail1'
  | 'tail2'
  | 'tail3'
  | 'tail4'
  | 'tuskL'
  | 'tuskR'
  // Flyers only (canopy owl, dusk finches). Deliberately not reusing shoulderL/R: a wing pivots
  // from a different place than a quadruped's shoulder, and sharing the name would make a wing
  // clip silently animate a bear's foreleg if the two ever got blended.
  | 'wingL'
  | 'wingR';

/**
 * A named set of THREE.Group pivots any procedural character is built
 * from. No skeleton/skinning — meshes attach directly to a joint group,
 * and clips (see Clip.ts) drive the joints' local transforms per frame.
 */
export class Rig {
  readonly root: THREE.Group;
  private joints = new Map<JointName, THREE.Group>();
  private basePositions = new Map<JointName, THREE.Vector3>();

  constructor(jointNames: JointName[]) {
    this.root = new THREE.Group();
    this.root.name = 'rig-root';
    for (const name of jointNames) {
      const joint = new THREE.Group();
      joint.name = name;
      this.joints.set(name, joint);
      this.root.add(joint);
    }
  }

  getJoint(name: JointName): THREE.Group {
    const joint = this.joints.get(name);
    if (!joint) throw new Error(`Rig: unknown joint "${name}"`);
    return joint;
  }

  /** True if this rig was built with the given joint. Lets a shared clip (e.g. the eat ritual,
   * authored against the fox's full joint set) skip joints a leaner rig doesn't have — a bear has
   * no real tail to animate, so its rig simply omits tail0 rather than faking one. */
  hasJoint(name: JointName): boolean {
    return this.joints.has(name);
  }

  /** Reparents `child` under `parent` — builds chains like the tail. */
  attach(child: JointName, parent: JointName): void {
    this.getJoint(parent).add(this.getJoint(child));
  }

  setLocalRotation(name: JointName, x: number, y: number, z: number): void {
    this.getJoint(name).rotation.set(x, y, z);
  }

  setLocalPosition(name: JointName, x: number, y: number, z: number): void {
    this.getJoint(name).position.set(x, y, z);
  }

  /**
   * Snapshots every joint's current local position as its bind pose. Call once, after every
   * setLocalPosition() that establishes the rest pose, before any clip ever runs. Clips author
   * position keyframes as small deltas around zero (e.g. a spine bob of [0,0,0]->[0,0.04,0]),
   * intending them as offsets from the rest pose — applyPositionOffset() honors that; without
   * this capture, a clip's first frame would silently overwrite the whole bind-pose offset.
   */
  captureBasePose(): void {
    for (const [name, joint] of this.joints) {
      this.basePositions.set(name, joint.position.clone());
    }
  }

  /** Sets a joint's local position to its captured bind pose plus (dx,dy,dz) — used by Clip.ts
   * instead of setLocalPosition, so applying a clip never wipes the rest pose. Falls back to a
   * zero base if captureBasePose() was never called (defensive; every creature should call it). */
  applyPositionOffset(name: JointName, dx: number, dy: number, dz: number): void {
    const base = this.basePositions.get(name) ?? new THREE.Vector3();
    this.getJoint(name).position.set(base.x + dx, base.y + dy, base.z + dz);
  }
}
