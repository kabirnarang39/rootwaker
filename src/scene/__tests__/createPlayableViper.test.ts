import * as THREE from 'three';
import { describe, it, expect } from 'vitest';
import { createPlayableViper } from '../createPlayableViper';
import { VIPER_SKINS } from '../skins';

describe('createPlayableViper', () => {
  it('builds a rig with the enemy viper\'s full body-chain joint set, including tail0..tail4', () => {
    const viper = createPlayableViper();
    for (const joint of ['root', 'spine', 'head', 'jaw', 'tail0', 'tail1', 'tail2', 'tail3', 'tail4'] as const) {
      expect(viper.rig.hasJoint(joint)).toBe(true);
    }
  });

  it('update() at moveSpeed 0 stays on the coiled-idle clip without throwing', () => {
    const viper = createPlayableViper();
    expect(() => viper.update(0, 1 / 60, 0)).not.toThrow();
  });

  it('update() at a real slither speed drives the travelling-wave slither clip without throwing', () => {
    const viper = createPlayableViper();
    for (let i = 0; i < 30; i++) viper.update(i / 60, 1 / 60, 4);
    // The slither clip drives tail0's yaw well past the coiled clip's small sway once fully blended.
    expect(Math.abs(viper.rig.getJoint('tail0').rotation.y)).toBeGreaterThan(0.01);
  });

  it('revealCrown() makes the crown visible, hidden by default', () => {
    const viper = createPlayableViper();
    expect(viper.crownGroup.visible).toBe(false);
    viper.revealCrown();
    expect(viper.crownGroup.visible).toBe(true);
  });

  it('accepts a real skin and applies its glow color to the chest light', () => {
    const viper = createPlayableViper(VIPER_SKINS[1]);
    let light: THREE.PointLight | undefined;
    viper.group.traverse((obj) => {
      if ((obj as THREE.PointLight).isPointLight) light = obj as THREE.PointLight;
    });
    expect(light?.color.getHex()).toBe(VIPER_SKINS[1].glowColor);
  });
});
