import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CameraRig } from '../CameraRig';

describe('CameraRig obstacle avoidance', () => {
  it('pulls the camera in when an obstacle blocks the desired position', () => {
    const rig = new CameraRig();
    const target = new THREE.Vector3(0, 0, 0);

    // a large box directly between the target and the default grounded camera offset
    const blocker = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 0.5), new THREE.MeshBasicMaterial());
    blocker.position.set(0, 1, 2); // sits between target (z=0) and camera offset (z≈4.2)

    for (let i = 0; i < 30; i++) rig.update(target, 'grounded', 1 / 60, [blocker]);
    const distanceToTarget = rig.camera.position.distanceTo(target);

    // without the obstacle the grounded offset distance is ~sqrt(2.4^2+4.2^2)≈4.83; with the blocker at z=2 the camera should be pulled in closer than that
    expect(distanceToTarget).toBeLessThan(4.5);
  });

  it('omitting the obstacles parameter behaves exactly as before (no crash, normal follow distance)', () => {
    const rig = new CameraRig();
    const target = new THREE.Vector3(0, 0, 0);
    for (let i = 0; i < 30; i++) rig.update(target, 'grounded', 1 / 60);
    expect(rig.camera.position.y).toBeGreaterThan(target.y);
  });
});
