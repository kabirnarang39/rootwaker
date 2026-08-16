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

    expect(rig.camera.position.distanceTo(target)).toBeLessThan(1.5);
  });

  it('foxEye eye point clears the real fox snout tip with real margin (regression: the camera used to sit inside/behind the fox\'s own head geometry)', () => {
    const target = new THREE.Vector3(0, 0, 0);
    const rig = new CameraRig();
    rig.cycleViewMode();
    rig.cycleViewMode();
    rig.cycleViewMode(); // -> foxEye
    for (let i = 0; i < 60; i++) rig.update(target, 'grounded', 1 / 60, undefined, 0);

    // createFox.ts's real rig (measured via root-relative world mesh bounding boxes, not raw
    // local joint offsets — the spine's own +0.55m offset makes those two very different
    // numbers) puts the forwardmost mesh (the snout tip) at z=0.880 and the eye spheres at
    // y 0.785-0.855. The eye point must clear both with real margin, not just barely exceed
    // the single snout-tip figure.
    expect(rig.camera.position.z).toBeGreaterThan(0.95); // >0.07m past the snout tip
    expect(rig.camera.position.y).toBeGreaterThan(0.78); // at true eye height, not shin height
  });

  it('foxEye layers the player\'s mouse-look on top of facingAngle, so dragging genuinely changes the view', () => {
    const target = new THREE.Vector3(0, 0, 0);
    const rig = new CameraRig();
    rig.cycleViewMode();
    rig.cycleViewMode();
    rig.cycleViewMode(); // -> foxEye
    const facingAngle = Math.PI / 2;
    rig.applyLookDelta(0.3, 0); // player drags to look slightly off of straight-ahead
    for (let i = 0; i < 60; i++) rig.update(target, 'grounded', 1 / 60, undefined, facingAngle);

    const lookDir = new THREE.Vector3();
    rig.camera.getWorldDirection(lookDir);
    const expectedAngle = facingAngle + 0.3;
    const expectedDir = new THREE.Vector3(Math.sin(expectedAngle), 0, Math.cos(expectedAngle));
    expect(lookDir.x).toBeCloseTo(expectedDir.x, 1);
    expect(lookDir.z).toBeCloseTo(expectedDir.z, 1);

    // and it's genuinely different from pure facingAngle — proves the drag had a visible effect,
    // closing the bug where mouse-look silently re-based movement with zero visual feedback
    const pureFacingDir = new THREE.Vector3(Math.sin(facingAngle), 0, Math.cos(facingAngle));
    expect(lookDir.distanceTo(pureFacingDir)).toBeGreaterThan(0.05);
  });

  it('foxEye always starts looking straight ahead on entry, regardless of yaw already accumulated in another mode', () => {
    const target = new THREE.Vector3(0, 0, 0);
    const rig = new CameraRig();
    rig.applyLookDelta(2.5, 0); // orbit heavily in follow mode first
    rig.cycleViewMode();
    rig.cycleViewMode();
    rig.cycleViewMode(); // -> foxEye (orbitYaw is still 2.5, but entry should re-zero the offset)
    for (let i = 0; i < 60; i++) rig.update(target, 'grounded', 1 / 60, undefined, 0); // facing = 0

    const lookDir = new THREE.Vector3();
    rig.camera.getWorldDirection(lookDir);
    // must look straight ahead along facing (0,0,1), not toward the inherited 2.5rad orbit yaw
    // (which would mean staring at the fox's own body from 1m in front of it)
    expect(lookDir.z).toBeGreaterThan(0.9);
  });

  it('foxEye pitch matches the same drag-down-looks-down convention as follow/closeUp (regression: was inverted)', () => {
    const target = new THREE.Vector3(0, 0, 0);

    const followRig = new CameraRig();
    followRig.applyLookDelta(0, 0.5);
    for (let i = 0; i < 60; i++) followRig.update(target, 'grounded', 1 / 60);
    const followLookDir = new THREE.Vector3();
    followRig.camera.getWorldDirection(followLookDir);

    const foxRig = new CameraRig();
    foxRig.cycleViewMode();
    foxRig.cycleViewMode();
    foxRig.cycleViewMode(); // -> foxEye
    foxRig.applyLookDelta(0, 0.5);
    for (let i = 0; i < 60; i++) foxRig.update(target, 'grounded', 1 / 60, undefined, 0);
    const foxLookDir = new THREE.Vector3();
    foxRig.camera.getWorldDirection(foxLookDir);

    // the same positive pitch delta must look the same vertical direction in both modes
    expect(followLookDir.y).toBeLessThan(0);
    expect(foxLookDir.y).toBeLessThan(0);
  });

  it('foxEye eye point is pulled back by the same obstacle raycast as every other mode if something sits between the fox and the intended eye point', () => {
    const target = new THREE.Vector3(0, 0, 0);
    const blocker = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 0.1), new THREE.MeshBasicMaterial());
    blocker.position.set(0, 0.82, 0.5); // directly between the fox and the eye point at facing=0
    blocker.updateMatrixWorld(true);

    const rigBlocked = new CameraRig();
    rigBlocked.cycleViewMode();
    rigBlocked.cycleViewMode();
    rigBlocked.cycleViewMode();
    for (let i = 0; i < 30; i++) rigBlocked.update(target, 'grounded', 1 / 60, [blocker], 0);

    const rigClear = new CameraRig();
    rigClear.cycleViewMode();
    rigClear.cycleViewMode();
    rigClear.cycleViewMode();
    for (let i = 0; i < 30; i++) rigClear.update(target, 'grounded', 1 / 60, undefined, 0);

    expect(rigBlocked.camera.position.z).toBeLessThan(rigClear.camera.position.z - 0.1);
  });

  it('foxEye falls back to the follow/climb camera while climbing (looking straight into the wall the player is climbing would otherwise be permanent)', () => {
    const target = new THREE.Vector3(0, 0, 0);
    const rig = new CameraRig();
    rig.cycleViewMode();
    rig.cycleViewMode();
    rig.cycleViewMode(); // -> foxEye
    for (let i = 0; i < 60; i++) rig.update(target, 'climbing', 1 / 60, undefined, 0);

    // CLIMB_OFFSET pulls the camera back to a normal following distance, not glued to the target
    expect(rig.camera.position.distanceTo(target)).toBeGreaterThan(2);
  });

  it('hawkEye is pulled in by the same obstacle raycast as follow/closeUp when an overhanging obstacle blocks its sightline', () => {
    const target = new THREE.Vector3(0, 0, 0);

    const blocker = new THREE.Mesh(new THREE.BoxGeometry(20, 0.5, 20), new THREE.MeshBasicMaterial());
    blocker.position.set(0, 4, 0); // a slab hovering between the target and the high hawk-eye offset
    blocker.updateMatrixWorld(true);

    const rigWithObstacle = new CameraRig();
    rigWithObstacle.cycleViewMode();
    rigWithObstacle.cycleViewMode(); // -> hawkEye
    for (let i = 0; i < 120; i++) rigWithObstacle.update(target, 'grounded', 1 / 60, [blocker]);

    const rigNoObstacle = new CameraRig();
    rigNoObstacle.cycleViewMode();
    rigNoObstacle.cycleViewMode(); // -> hawkEye
    for (let i = 0; i < 120; i++) rigNoObstacle.update(target, 'grounded', 1 / 60);

    // blocked: pulled in well below the slab; unobstructed: sits at the full ~9m hawk-eye height
    expect(rigWithObstacle.camera.position.y).toBeLessThan(rigNoObstacle.camera.position.y - 1);
  });

  it('follow and closeUp modes are unaffected by this change (regression check)', () => {
    const target = new THREE.Vector3(0, 0, 0);
    const rig = new CameraRig();
    for (let i = 0; i < 60; i++) rig.update(target, 'grounded', 1 / 60);
    expect(rig.camera.position.x).toBeCloseTo(0, 3);
    expect(rig.camera.position.z).toBeCloseTo(4.2, 1);
  });
});
