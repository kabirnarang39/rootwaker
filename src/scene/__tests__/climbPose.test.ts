import { describe, it, expect } from 'vitest';
import { Rig } from '../rig/Rig';
import { applyClimbPose } from '../climbPose';

function quadrupedRig(): Rig {
  return new Rig(['root', 'spine', 'forepawL', 'forepawR', 'hipL', 'hipR', 'hindpawL', 'hindpawR']);
}

function leglessRig(): Rig {
  return new Rig(['root', 'spine', 'tail0', 'tail1', 'tail2']);
}

describe('applyClimbPose', () => {
  it('a real quadruped reaches diagonally: forepawL/hindpawR move together, opposite forepawR/hindpawL', () => {
    const rig = quadrupedRig();
    applyClimbPose(rig, 0.3);
    const forepawL = rig.getJoint('forepawL').rotation.x;
    const hindpawR = rig.getJoint('hindpawR').rotation.x;
    const forepawR = rig.getJoint('forepawR').rotation.x;
    const hindpawL = rig.getJoint('hindpawL').rotation.x;
    expect(forepawL).toBeCloseTo(hindpawR, 5);
    expect(forepawR).toBeCloseTo(hindpawL, 5);
    expect(forepawL).toBeCloseTo(-forepawR, 5);
    expect(forepawL).not.toBe(0);
  });

  it('a legless rig (viper) gets a real body ripple instead — no forepaw joints to reach for, calling applyClimbPose must not throw', () => {
    const rig = leglessRig();
    expect(() => applyClimbPose(rig, 0.3)).not.toThrow();
    const tail0 = rig.getJoint('tail0').rotation.y;
    const tail1 = rig.getJoint('tail1').rotation.y;
    expect(tail0).not.toBe(0);
    expect(tail0).toBeCloseTo(-tail1, 5);
  });

  it('the pose changes over time — a real animated scramble, not a frozen static pose', () => {
    const rig = quadrupedRig();
    applyClimbPose(rig, 0);
    const at0 = rig.getJoint('forepawL').rotation.x;
    applyClimbPose(rig, 0.7);
    const at07 = rig.getJoint('forepawL').rotation.x;
    expect(at0).not.toBeCloseTo(at07, 3);
  });

  it('leans the spine forward into the rock face when a spine joint exists', () => {
    const rig = quadrupedRig();
    applyClimbPose(rig, 0);
    expect(rig.getJoint('spine').rotation.x).toBeLessThan(0);
  });

  it('never throws on a rig with no spine/legless joints at all (minimal rig)', () => {
    const rig = new Rig(['root']);
    expect(() => applyClimbPose(rig, 0.3)).not.toThrow();
  });
});
