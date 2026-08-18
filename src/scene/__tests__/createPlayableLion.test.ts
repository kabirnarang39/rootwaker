import * as THREE from 'three';
import { describe, it, expect } from 'vitest';
import { createPlayableLion } from '../createPlayableLion';
import { LION_SKINS } from '../skins';

describe('createPlayableLion', () => {
  it('builds a rig with the enemy lion\'s full anatomy joint set, including the real tail no other quadruped has', () => {
    const lion = createPlayableLion();
    for (const joint of ['root', 'spine', 'head', 'jaw', 'earL', 'earR', 'shoulderL', 'shoulderR', 'forepawL', 'forepawR', 'hipL', 'hipR', 'hindpawL', 'hindpawR', 'tail0', 'tail1'] as const) {
      expect(lion.rig.hasJoint(joint)).toBe(true);
    }
  });

  it('update() at moveSpeed 0 does not throw and leaves the rig posed', () => {
    const lion = createPlayableLion();
    expect(() => lion.update(0, 1 / 60, 0)).not.toThrow();
  });

  it('update() at a real walking speed drives the stride walk clip without throwing', () => {
    const lion = createPlayableLion();
    for (let i = 0; i < 30; i++) lion.update(i / 60, 1 / 60, 5.5);
    expect(Math.abs(lion.rig.getJoint('forepawL').rotation.x)).toBeGreaterThan(0.01);
  });

  it('revealCrown() makes the crown visible, hidden by default', () => {
    const lion = createPlayableLion();
    expect(lion.crownGroup.visible).toBe(false);
    lion.revealCrown();
    expect(lion.crownGroup.visible).toBe(true);
  });

  it('blocking=true applies a real defensive brace, distinct from the normal idle pose', () => {
    const lion = createPlayableLion();
    lion.update(0, 1 / 60, 0, false);
    const idleSpineX = lion.rig.getJoint('spine').rotation.x;
    lion.update(0, 1 / 60, 0, true);
    expect(lion.rig.getJoint('spine').rotation.x).not.toBeCloseTo(idleSpineX, 2);
    expect(lion.rig.getJoint('spine').rotation.x).toBeGreaterThan(0);
  });

  it('hurt=true applies a real recoil flinch, distinct from and overriding a held block', () => {
    const lion = createPlayableLion();
    lion.update(0, 1 / 60, 0, false, false);
    const idleSpineX = lion.rig.getJoint('spine').rotation.x;
    lion.update(0, 1 / 60, 0, false, true);
    const hurtSpineX = lion.rig.getJoint('spine').rotation.x;
    expect(hurtSpineX).not.toBeCloseTo(idleSpineX, 2);
    lion.update(0, 1 / 60, 0, true, true); // hurt must still win when blocking is also true
    expect(lion.rig.getJoint('spine').rotation.x).toBeCloseTo(hurtSpineX, 5);
  });

  it('accepts a real skin and applies its glow color to the chest light', () => {
    const lion = createPlayableLion(LION_SKINS[1]);
    let light: THREE.PointLight | undefined;
    lion.group.traverse((obj) => {
      if ((obj as THREE.PointLight).isPointLight) light = obj as THREE.PointLight;
    });
    expect(light?.color.getHex()).toBe(LION_SKINS[1].glowColor);
  });
});
