import { describe, it, expect } from 'vitest';
import { grazeClip, fleeClip } from '../groveHareClips';

describe('grove-hare clips', () => {
  it('grazeClip gently bobs the head/spine and loops', () => {
    expect(grazeClip.loop).toBe(true);
    expect(grazeClip.keyframes.some((k) => k.joint === 'spine')).toBe(true);
  });

  it('fleeClip drives leg-joint motion fast and loops', () => {
    expect(fleeClip.loop).toBe(true);
    expect(fleeClip.duration).toBeLessThan(grazeClip.duration);
    const legJoints = new Set(fleeClip.keyframes.map((k) => k.joint));
    expect(legJoints.has('hindpawL')).toBe(true);
    expect(legJoints.has('hindpawR')).toBe(true);
  });
});
