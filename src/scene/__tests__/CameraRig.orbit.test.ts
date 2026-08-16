import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CameraRig } from '../CameraRig';
import { toCameraRelative } from '../../game/CameraRelativeMove';

describe('CameraRig orbit', () => {
  it('orbitYaw starts at 0 (reproduces existing fixed-offset behavior)', () => {
    const rig = new CameraRig();
    expect(rig.orbitYaw).toBe(0);
  });

  it('applyLookDelta accumulates yaw', () => {
    const rig = new CameraRig();
    rig.applyLookDelta(0.5, 0);
    expect(rig.orbitYaw).toBeCloseTo(0.5, 5);
    rig.applyLookDelta(0.3, 0);
    expect(rig.orbitYaw).toBeCloseTo(0.8, 5);
  });

  it('orbiting 180 degrees (PI) puts the camera roughly on the opposite side of the target on the horizontal plane', () => {
    const rig = new CameraRig();
    const target = new THREE.Vector3(0, 0, 0);
    for (let i = 0; i < 30; i++) rig.update(target, 'grounded', 1 / 60);
    const zAtYaw0 = rig.camera.position.z;
    rig.applyLookDelta(Math.PI, 0);
    for (let i = 0; i < 60; i++) rig.update(target, 'grounded', 1 / 60);
    // starting offset is (0, y, +4.2) i.e. behind target on +z; after a PI yaw the camera
    // should have swung to the -z side (opposite sign), while roughly preserving distance from target on the XZ plane
    expect(Math.sign(rig.camera.position.z)).not.toBe(Math.sign(zAtYaw0));
  });

  it('cycleViewMode advances from follow to closeUp (full 4-mode cycle covered in CameraRig.viewmodes.test.ts)', () => {
    const rig = new CameraRig();
    expect(rig.viewMode).toBe('follow');
    rig.cycleViewMode();
    expect(rig.viewMode).toBe('closeUp');
  });

  it('closeUp view mode results in a smaller distance from the target than follow mode', () => {
    const target = new THREE.Vector3(0, 0, 0);
    const followRig = new CameraRig();
    for (let i = 0; i < 60; i++) followRig.update(target, 'grounded', 1 / 60);
    const followDist = followRig.camera.position.distanceTo(target);

    const closeRig = new CameraRig();
    closeRig.cycleViewMode();
    for (let i = 0; i < 60; i++) closeRig.update(target, 'grounded', 1 / 60);
    const closeDist = closeRig.camera.position.distanceTo(target);

    expect(closeDist).toBeLessThan(followDist);
  });

  it('toCameraRelative agrees with the camera-derived forward direction at an arbitrary yaw (binds the two independently-encoded rotation conventions together)', () => {
    const target = new THREE.Vector3(0, 0, 0);
    const rig = new CameraRig();
    rig.applyLookDelta(0.9, 0); // arbitrary non-axis-aligned yaw
    for (let i = 0; i < 120; i++) rig.update(target, 'grounded', 1 / 60);

    const forwardFromCamera = target.clone().sub(rig.camera.position);
    forwardFromCamera.y = 0;
    forwardFromCamera.normalize();

    const inputForward = toCameraRelative(0, 1, rig.orbitYaw);

    expect(inputForward.x).toBeCloseTo(forwardFromCamera.x, 2);
    expect(inputForward.z).toBeCloseTo(forwardFromCamera.z, 2);
  });
});
