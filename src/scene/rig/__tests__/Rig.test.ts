import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Rig } from '../Rig';

describe('Rig', () => {
  it('creates a joint per name, all under root by default', () => {
    const rig = new Rig(['root', 'spine', 'head']);
    expect(rig.root.children.length).toBe(3);
    expect(rig.getJoint('head').name).toBe('head');
  });

  it('throws on an unregistered joint name', () => {
    const rig = new Rig(['root']);
    // @ts-expect-error intentionally invalid joint name for the test
    expect(() => rig.getJoint('nope')).toThrow();
  });

  it('attach() reparents a joint and world position reflects the chain', () => {
    const rig = new Rig(['root', 'spine', 'head']);
    rig.attach('spine', 'root');
    rig.attach('head', 'spine');
    rig.setLocalPosition('spine', 0, 1, 0);
    rig.setLocalPosition('head', 0, 1, 0);
    rig.root.updateMatrixWorld(true);
    const headWorld = new THREE.Vector3();
    rig.getJoint('head').getWorldPosition(headWorld);
    expect(headWorld.y).toBeCloseTo(2, 5);
  });

  it('setLocalRotation sets the joint euler angles', () => {
    const rig = new Rig(['root']);
    rig.setLocalRotation('root', 0, Math.PI / 2, 0);
    expect(rig.getJoint('root').rotation.y).toBeCloseTo(Math.PI / 2, 5);
  });
});
