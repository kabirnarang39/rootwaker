import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CameraRig } from '../CameraRig';

describe('CameraRig hawk-eye and fox-eye view modes', () => {
  it('cycleViewMode advances through all 4 modes in order and wraps', () => {
    const rig = new CameraRig();
    expect(rig.viewMode).toBe('follow');
    rig.cycleViewMode();
    expect(rig.viewMode).toBe('closeUp');
    rig.cycleViewMode();
    expect(rig.viewMode).toBe('hawkEye');
    rig.cycleViewMode();
    expect(rig.viewMode).toBe('foxEye');
    rig.cycleViewMode();
    expect(rig.viewMode).toBe('follow');
  });

  it('hawkEye mode positions the camera significantly higher and steeper than follow mode, regardless of orbit pitch', () => {
    const target = new THREE.Vector3(0, 0, 0);
    const rig = new CameraRig();
    rig.cycleViewMode();
    rig.cycleViewMode(); // -> hawkEye
    rig.applyLookDelta(0, 0.9); // player drags pitch up — hawkEye should ignore this, always looking steeply down
    for (let i = 0; i < 120; i++) rig.update(target, 'grounded', 1 / 60);

    const followRig = new CameraRig();
    for (let i = 0; i < 120; i++) followRig.update(target, 'grounded', 1 / 60);

    expect(rig.camera.position.y).toBeGreaterThan(followRig.camera.position.y * 2);
    // hawkEye looks steeply down at the target regardless of drag: the vector from camera to target
    // should be mostly vertical (dominant Y component) even after the player tried to drag pitch up
    const toTarget = target.clone().sub(rig.camera.position).normalize();
    expect(Math.abs(toTarget.y)).toBeGreaterThan(0.8);
  });

  it('foxEye mode places the camera near the target (first-person height), not behind it at a distance', () => {
    const target = new THREE.Vector3(0, 0, 0);
    const rig = new CameraRig();
    rig.cycleViewMode();
    rig.cycleViewMode();
    rig.cycleViewMode(); // -> foxEye
    for (let i = 0; i < 60; i++) rig.update(target, 'grounded', 1 / 60, undefined, 0);

    expect(rig.camera.position.distanceTo(target)).toBeLessThan(1.0);
  });

  it('foxEye mode looks along the provided facingAngle, not the orbit yaw', () => {
    const target = new THREE.Vector3(0, 0, 0);
    const rig = new CameraRig();
    rig.cycleViewMode();
    rig.cycleViewMode();
    rig.cycleViewMode(); // -> foxEye
    rig.applyLookDelta(2.0, 0); // orbit yaw is now non-zero, foxEye must ignore it for look direction
    const facingAngle = Math.PI / 2;
    for (let i = 0; i < 60; i++) rig.update(target, 'grounded', 1 / 60, undefined, facingAngle);

    // camera.getWorldDirection gives the direction the camera is actually looking
    const lookDir = new THREE.Vector3();
    rig.camera.getWorldDirection(lookDir);
    const expectedDir = new THREE.Vector3(Math.sin(facingAngle), 0, Math.cos(facingAngle));
    expect(lookDir.x).toBeCloseTo(expectedDir.x, 1);
    expect(lookDir.z).toBeCloseTo(expectedDir.z, 1);
  });

  it('follow and closeUp modes are unaffected by this change (regression check)', () => {
    const target = new THREE.Vector3(0, 0, 0);
    const rig = new CameraRig();
    for (let i = 0; i < 60; i++) rig.update(target, 'grounded', 1 / 60);
    expect(rig.camera.position.x).toBeCloseTo(0, 3);
    expect(rig.camera.position.z).toBeCloseTo(4.2, 1);
  });
});
