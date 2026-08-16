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
  | 'tail4';

/**
 * A named set of THREE.Group pivots any procedural character is built
 * from. No skeleton/skinning — meshes attach directly to a joint group,
 * and clips (see Clip.ts) drive the joints' local transforms per frame.
 */
export class Rig {
  readonly root: THREE.Group;
  private joints = new Map<JointName, THREE.Group>();

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
}
