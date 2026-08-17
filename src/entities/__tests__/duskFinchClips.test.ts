import { describe, it, expect } from 'vitest';
import { flapClip } from '../duskFinchClips';
import { perchClip } from '../canopyOwlClips';

describe('dusk-finch clips', () => {
  it('flapClip loops and drives both wing joints', () => {
    expect(flapClip.loop).toBe(true);
    const joints = new Set(flapClip.keyframes.map((k) => k.joint));
    expect(joints.has('wingL')).toBe(true);
    expect(joints.has('wingR')).toBe(true);
  });

  it('flaps much faster than the owl\'s wing-settle cycle', () => {
    expect(flapClip.duration).toBeLessThan(perchClip.duration / 10);
  });

  it('the two wings move in opposite senses (a real flap, not both wings swinging the same way)', () => {
    const mid = flapClip.keyframes.find((k) => k.joint === 'wingL' && k.time === flapClip.duration / 2)!;
    const midR = flapClip.keyframes.find((k) => k.joint === 'wingR' && k.time === flapClip.duration / 2)!;
    expect(Math.sign(mid.rotation![2])).not.toBe(Math.sign(midR.rotation![2]));
  });
});
