import { describe, it, expect } from 'vitest';
import { forageClip, alertClip } from '../groveSquirrelClips';
import { sampleClip } from '../../scene/rig/Clip';

describe('grove-squirrel clips', () => {
  it('forageClip loops and drives a nibbling head-bob', () => {
    expect(forageClip.loop).toBe(true);
    expect(forageClip.keyframes.some((k) => k.joint === 'head')).toBe(true);
  });

  it('alertClip loops and flicks the tail with growing amplitude toward the tip', () => {
    expect(alertClip.loop).toBe(true);
    const t = alertClip.duration * 0.25;
    const sample = sampleClip(alertClip, t);
    const tail0 = Math.abs(sample.get('tail0')!.rotation![1]);
    const tail1 = Math.abs(sample.get('tail1')!.rotation![1]);
    const tail2 = Math.abs(sample.get('tail2')!.rotation![1]);
    expect(tail1).toBeGreaterThan(tail0);
    expect(tail2).toBeGreaterThan(tail1);
  });

  it('every joint the other clip animates gets an explicit identity keyframe (regression: a joint stuck at a stale non-rest value, the exact bug class Task 3 found and fixed in the viper\'s tail, 0ec0b0f)', () => {
    // forageClip must pin every joint alertClip actually drives (spine, tail0..tail2).
    for (const joint of ['spine', 'tail0', 'tail1', 'tail2'] as const) {
      const kf = forageClip.keyframes.find((k) => k.joint === joint && k.time === 0);
      expect(kf, `forageClip missing identity pin for ${joint}`).toBeDefined();
      expect(kf!.rotation).toEqual([0, 0, 0]);
    }
    // alertClip must pin the one joint forageClip actually drives (head).
    const headPin = alertClip.keyframes.find((k) => k.joint === 'head' && k.time === 0);
    expect(headPin, 'alertClip missing identity pin for head').toBeDefined();
    expect(headPin!.rotation).toEqual([0, 0, 0]);
  });
});
