import { describe, it, expect } from 'vitest';
import { createFox } from '../createFox';

describe('createFox', () => {
  it('every mesh is on render layer 1 only (own-body exclusion for the foxEye camera), never the default layer 0 — a mesh left on layer 0 would leak into the first-person view; a shadow-casting mesh needs layer 1 explicitly re-enabled on the light\'s shadow camera in Game.ts, or it silently stops casting a shadow in every view mode', () => {
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

  it('the bind pose survives repeated update() calls (regression: clip application used to silently overwrite each joint\'s bind-pose local position, since clips author position keyframes as deltas around zero but the old code applied them as absolute overwrites)', () => {
    const fox = createFox();
    for (let i = 0; i < 200; i++) fox.update(i * 0.016, 0.016, i % 40 < 20 ? 0 : 5.5);

    // bind-pose values from createFox.ts's own setLocalPosition calls — a bob/blend clip should
    // move these by a small amount, never zero them out or leave them at the raw clip value
    expect(fox.rig.getJoint('spine').position.y).toBeGreaterThan(0.5); // bind 0.55, small bob on top
    expect(fox.rig.getJoint('head').position.z).toBeCloseTo(0.45, 2); // bind (0,0.23,0.45), no clip touches head position
    expect(fox.rig.getJoint('hipL').position.x).toBeCloseTo(-0.16, 2); // bind (-0.16,0.24,-0.22)
  });
});
