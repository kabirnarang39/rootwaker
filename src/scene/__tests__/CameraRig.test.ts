import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CameraRig } from '../CameraRig';

describe('CameraRig', () => {
  it('follows the target from behind and above on the grounded offset', () => {
    const rig = new CameraRig();
    const target = new THREE.Vector3(0, 0, 0);
    for (let i = 0; i < 60; i++) rig.update(target, 'grounded', 1 / 60);
    expect(rig.camera.position.y).toBeGreaterThan(target.y);
    expect(rig.camera.position.z).toBeGreaterThan(target.z); // behind, since forward is -z
  });

  it('narrows field of view when entering combat', () => {
    const rig = new CameraRig();
    const target = new THREE.Vector3();
    for (let i = 0; i < 30; i++) rig.update(target, 'grounded', 1 / 60);
    const groundedFov = rig.camera.fov;
    for (let i = 0; i < 30; i++) rig.update(target, 'combat', 1 / 60);
    expect(rig.camera.fov).toBeLessThan(groundedFov);
  });
});
