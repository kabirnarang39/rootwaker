import * as THREE from 'three';
import { describe, it, expect } from 'vitest';
import { createPlayableBear } from '../createPlayableBear';
import { BEAR_SKINS } from '../skins';

describe('createPlayableBear', () => {
  it('builds a rig with the enemy bear\'s full anatomy joint set (no tail — see Rig.hasJoint/applyClipToRig\'s defensive skip)', () => {
    const bear = createPlayableBear();
    for (const joint of ['root', 'spine', 'head', 'jaw', 'earL', 'earR', 'shoulderL', 'shoulderR', 'forepawL', 'forepawR', 'hipL', 'hipR', 'hindpawL', 'hindpawR'] as const) {
      expect(bear.rig.hasJoint(joint)).toBe(true);
    }
    expect(bear.rig.hasJoint('tail0')).toBe(false);
  });

  it('update() at moveSpeed 0 does not throw and leaves the rig posed', () => {
    const bear = createPlayableBear();
    expect(() => bear.update(0, 1 / 60, 0)).not.toThrow();
  });

  it('update() at a real walking speed drives the pacing-gait walk clip without throwing', () => {
    const bear = createPlayableBear();
    for (let i = 0; i < 30; i++) bear.update(i / 60, 1 / 60, 5);
    // forepawL should be mid-swing, not sitting at the identity bind pose, once the walk clip
    // has had real time to blend in.
    expect(Math.abs(bear.rig.getJoint('forepawL').rotation.x)).toBeGreaterThan(0.01);
  });

  it('revealCrown() makes the crown visible, hidden by default (coronation applies to any species)', () => {
    const bear = createPlayableBear();
    expect(bear.crownGroup.visible).toBe(false);
    bear.revealCrown();
    expect(bear.crownGroup.visible).toBe(true);
  });

  it('blocking=true applies a real defensive brace (spine/head pitch forward), distinct from the normal idle pose', () => {
    const bear = createPlayableBear();
    bear.update(0, 1 / 60, 0, false);
    const idleSpineX = bear.rig.getJoint('spine').rotation.x;
    bear.update(0, 1 / 60, 0, true);
    expect(bear.rig.getJoint('spine').rotation.x).not.toBeCloseTo(idleSpineX, 2);
    expect(bear.rig.getJoint('spine').rotation.x).toBeGreaterThan(0);
  });

  it('blocking defaults to false when omitted — every existing single-player-era call site stays byte-identical', () => {
    const bear = createPlayableBear();
    bear.update(0, 1 / 60, 0);
    const withoutArg = bear.rig.getJoint('spine').rotation.x;
    const bear2 = createPlayableBear();
    bear2.update(0, 1 / 60, 0, false);
    expect(withoutArg).toBeCloseTo(bear2.rig.getJoint('spine').rotation.x, 5);
  });

  it('accepts a real skin and applies its glow color to the chest light (regression: a hardcoded color would ignore the skin parameter entirely)', () => {
    const bear = createPlayableBear(BEAR_SKINS[1]);
    let light: THREE.PointLight | undefined;
    bear.group.traverse((obj) => {
      if ((obj as THREE.PointLight).isPointLight) light = obj as THREE.PointLight;
    });
    expect(light?.color.getHex()).toBe(BEAR_SKINS[1].glowColor);
  });
});
