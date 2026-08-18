import * as THREE from 'three';
import { describe, it, expect } from 'vitest';
import { createPlayableCrocodile } from '../createPlayableCrocodile';
import { CROCODILE_SKINS } from '../skins';

describe('createPlayableCrocodile', () => {
  it('builds a rig with the enemy crocodile\'s full anatomy joint set, including the real tail chain', () => {
    const croc = createPlayableCrocodile();
    for (const joint of ['root', 'spine', 'head', 'jaw', 'shoulderL', 'shoulderR', 'forepawL', 'forepawR', 'hipL', 'hipR', 'hindpawL', 'hindpawR', 'tail0', 'tail1', 'tail2'] as const) {
      expect(croc.rig.hasJoint(joint)).toBe(true);
    }
  });

  it('update() at moveSpeed 0 does not throw and leaves the rig posed', () => {
    const croc = createPlayableCrocodile();
    expect(() => croc.update(0, 1 / 60, 0)).not.toThrow();
  });

  it('update() at a real walking speed drives the sprawl walk clip without throwing', () => {
    const croc = createPlayableCrocodile();
    for (let i = 0; i < 45; i++) croc.update(i / 60, 1 / 60, 3.5);
    expect(Math.abs(croc.rig.getJoint('forepawL').rotation.x)).toBeGreaterThan(0.01);
  });

  it('revealCrown() makes the crown visible, hidden by default', () => {
    const croc = createPlayableCrocodile();
    expect(croc.crownGroup.visible).toBe(false);
    croc.revealCrown();
    expect(croc.crownGroup.visible).toBe(true);
  });

  it('blocking=true applies a real defensive brace, distinct from the normal idle pose', () => {
    const croc = createPlayableCrocodile();
    croc.update(0, 1 / 60, 0, false);
    const idleJawX = croc.rig.getJoint('jaw').rotation.x;
    croc.update(0, 1 / 60, 0, true);
    expect(croc.rig.getJoint('jaw').rotation.x).not.toBeCloseTo(idleJawX, 2);
  });

  it('accepts a real skin and applies its glow color to the chest light', () => {
    const croc = createPlayableCrocodile(CROCODILE_SKINS[1]);
    let light: THREE.PointLight | undefined;
    croc.group.traverse((obj) => {
      if ((obj as THREE.PointLight).isPointLight) light = obj as THREE.PointLight;
    });
    expect(light?.color.getHex()).toBe(CROCODILE_SKINS[1].glowColor);
  });
});
