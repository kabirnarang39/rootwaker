import * as THREE from 'three';
import { describe, it, expect } from 'vitest';
import { createPlayableBoar } from '../createPlayableBoar';
import { BOAR_SKINS } from '../skins';

describe('createPlayableBoar', () => {
  it('builds a rig with the enemy boar\'s full anatomy joint set', () => {
    const boar = createPlayableBoar();
    for (const joint of ['root', 'spine', 'head', 'tuskL', 'tuskR', 'earL', 'earR', 'shoulderL', 'shoulderR', 'forepawL', 'forepawR', 'hipL', 'hipR', 'hindpawL', 'hindpawR'] as const) {
      expect(boar.rig.hasJoint(joint)).toBe(true);
    }
  });

  it('update() at moveSpeed 0 does not throw and leaves the rig posed', () => {
    const boar = createPlayableBoar();
    expect(() => boar.update(0, 1 / 60, 0)).not.toThrow();
  });

  it('update() at a real walking speed drives the trot walk clip without throwing', () => {
    const boar = createPlayableBoar();
    for (let i = 0; i < 30; i++) boar.update(i / 60, 1 / 60, 4.5);
    expect(Math.abs(boar.rig.getJoint('forepawL').rotation.x)).toBeGreaterThan(0.01);
  });

  it('revealCrown() makes the crown visible, hidden by default', () => {
    const boar = createPlayableBoar();
    expect(boar.crownGroup.visible).toBe(false);
    boar.revealCrown();
    expect(boar.crownGroup.visible).toBe(true);
  });

  it('blocking=true applies a real defensive brace, distinct from the normal idle pose', () => {
    const boar = createPlayableBoar();
    boar.update(0, 1 / 60, 0, false);
    const idleHeadX = boar.rig.getJoint('head').rotation.x;
    boar.update(0, 1 / 60, 0, true);
    expect(boar.rig.getJoint('head').rotation.x).not.toBeCloseTo(idleHeadX, 2);
  });

  it('accepts a real skin and applies its glow color to the chest light', () => {
    const boar = createPlayableBoar(BOAR_SKINS[1]);
    let light: THREE.PointLight | undefined;
    boar.group.traverse((obj) => {
      if ((obj as THREE.PointLight).isPointLight) light = obj as THREE.PointLight;
    });
    expect(light?.color.getHex()).toBe(BOAR_SKINS[1].glowColor);
  });
});
