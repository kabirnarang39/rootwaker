import { describe, it, expect } from 'vitest';
import { createFox } from '../createFox';

describe('createFox', () => {
  it('every mesh is on render layer 1 only (own-body exclusion for the foxEye camera), never the default layer 0 — a mesh left on layer 0 would leak into the first-person view. Shadow-casting is unaffected: THREE.WebGLShadowMap gates shadow-pass visibility on the MAIN render camera\'s layers, not shadow.camera.layers (verified directly against three.cjs\'s source — that property is never read), so the fox simply has no self-shadow in foxEye specifically, not a bug to work around.', () => {
    const fox = createFox();
    let meshCount = 0;
    fox.group.traverse((obj) => {
      if ((obj as { isMesh?: boolean }).isMesh) {
        meshCount++;
        expect(obj.layers.mask).toBe(2); // layer 1 only (bit 1 set, bit 0 clear)
      }
    });
    expect(meshCount).toBeGreaterThan(0);
  });

  it('the chest-glow light stays on the default layer 0, NOT swept onto layer 1 with the meshes (regression: THREE.WebGLRenderer.projectObject gates light contribution on the same object.layers.test(camera.layers) check used for mesh visibility — a light left on layer 1 would silently stop illuminating the rest of the scene whenever the camera loses layer 1, i.e. in foxEye specifically, making world lighting near the fox visibly shift with view mode)', () => {
    const fox = createFox();
    let lightCount = 0;
    fox.group.traverse((obj) => {
      if ((obj as { isLight?: boolean }).isLight) {
        lightCount++;
        expect(obj.layers.mask).toBe(1); // default layer 0 only — always visible to any camera
      }
    });
    expect(lightCount).toBeGreaterThan(0);
  });

  it('the bind pose survives repeated update() calls (regression: clip application used to silently overwrite each joint\'s bind-pose local position, since clips author position keyframes as deltas around zero but the old code applied them as absolute overwrites)', () => {
    const fox = createFox();
    for (let i = 0; i < 200; i++) fox.update(i * 0.016, 0.016, i % 40 < 20 ? 0 : 5.5);

    // bind-pose values from createFox.ts's own setLocalPosition calls — a bob/blend clip should
    // move these by a small amount, never zero them out or leave them at the raw clip value
    expect(fox.rig.getJoint('spine').position.y).toBeGreaterThan(0.5); // bind 0.55, small bob on top
    expect(fox.rig.getJoint('head').position.z).toBeCloseTo(0.45, 2); // bind (0,0.23,0.45), no clip touches head position
    expect(fox.rig.getJoint('hipL').position.x).toBeCloseTo(-0.16, 2); // bind (-0.16,0.24,-0.22)
  });

  it('the crown is hidden by default and only becomes visible after revealCrown()', () => {
    const fox = createFox();
    expect(fox.crownGroup.visible).toBe(false);
    fox.revealCrown();
    expect(fox.crownGroup.visible).toBe(true);
  });

  it('blocking=true applies a real defensive brace (spine/head pitch forward), a genuinely different pose from normal idle', () => {
    const fox = createFox();
    fox.update(0, 1 / 60, 0, false);
    const idleSpineX = fox.rig.getJoint('spine').rotation.x;
    fox.update(0, 1 / 60, 0, true);
    expect(fox.rig.getJoint('spine').rotation.x).not.toBeCloseTo(idleSpineX, 2);
    expect(fox.rig.getJoint('spine').rotation.x).toBeGreaterThan(0);
  });

  it('hurt=true applies a real recoil flinch, distinct from and overriding a held block', () => {
    const fox = createFox();
    fox.update(0, 1 / 60, 0, false, false);
    const idleSpineX = fox.rig.getJoint('spine').rotation.x;
    fox.update(0, 1 / 60, 0, false, true);
    const hurtSpineX = fox.rig.getJoint('spine').rotation.x;
    expect(hurtSpineX).not.toBeCloseTo(idleSpineX, 2);
    expect(hurtSpineX).toBeLessThan(0); // real recoil is a backward pitch, opposite the block's forward brace
    fox.update(0, 1 / 60, 0, true, true); // hurt must still win when blocking is also true
    expect(fox.rig.getJoint('spine').rotation.x).toBeCloseTo(hurtSpineX, 5);
  });

  it('blocking defaults to false when omitted — every pre-Block call site stays byte-identical', () => {
    const foxA = createFox();
    foxA.update(0, 1 / 60, 0);
    const foxB = createFox();
    foxB.update(0, 1 / 60, 0, false);
    expect(foxA.rig.getJoint('spine').rotation.x).toBeCloseTo(foxB.rig.getJoint('spine').rotation.x, 5);
  });
});
