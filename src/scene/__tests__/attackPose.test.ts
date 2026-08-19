import { describe, it, expect } from 'vitest';
import { Rig } from '../rig/Rig';
import { applyAttackPose } from '../attackPose';

function quadrupedRig(): Rig {
  return new Rig(['root', 'spine', 'head', 'forepawL', 'forepawR', 'hipL', 'hipR', 'hindpawL', 'hindpawR']);
}

function leglessRig(): Rig {
  return new Rig(['root', 'spine', 'head', 'jaw', 'tail0']);
}

describe('applyAttackPose', () => {
  it('a real quadruped commits its weight forward: spine/head pitch forward, forepaws strike', () => {
    const rig = quadrupedRig();
    applyAttackPose(rig);
    expect(rig.getJoint('spine').rotation.x).toBeGreaterThan(0);
    expect(rig.getJoint('head').rotation.x).toBeGreaterThan(0);
    expect(rig.getJoint('forepawL').rotation.x).toBeLessThan(0);
    expect(rig.getJoint('forepawR').rotation.x).toBeLessThan(0);
  });

  it('a legless rig (viper) still gets a real head/spine strike lunge — no forepaws needed', () => {
    const rig = leglessRig();
    expect(() => applyAttackPose(rig)).not.toThrow();
    expect(rig.getJoint('spine').rotation.x).toBeGreaterThan(0);
    expect(rig.getJoint('head').rotation.x).toBeGreaterThan(0);
  });

  it('commits in the opposite direction from a hurt recoil — attack leans in, hurt leans away', () => {
    const rig = quadrupedRig();
    applyAttackPose(rig);
    const attackSpineX = rig.getJoint('spine').rotation.x;
    rig.setLocalRotation('spine', -0.2, 0, 0); // a representative hurt-recoil value
    const hurtSpineX = rig.getJoint('spine').rotation.x;
    expect(Math.sign(attackSpineX)).not.toBe(Math.sign(hurtSpineX));
  });

  it('never throws on a minimal rig with no spine/head/legs at all', () => {
    const rig = new Rig(['root']);
    expect(() => applyAttackPose(rig)).not.toThrow();
  });
});
