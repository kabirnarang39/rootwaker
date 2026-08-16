import { describe, it, expect } from 'vitest';
import { walkClip, idleClip } from '../foxClips';

describe('fox clips', () => {
  it('walkClip has keyframes for all four legs and loops', () => {
    const legJoints = new Set(walkClip.keyframes.map((k) => k.joint));
    expect(legJoints.has('forepawL')).toBe(true);
    expect(legJoints.has('forepawR')).toBe(true);
    expect(legJoints.has('hindpawL')).toBe(true);
    expect(legJoints.has('hindpawR')).toBe(true);
    expect(walkClip.loop).toBe(true);
  });

  it('idleClip breathes the spine gently and loops', () => {
    expect(idleClip.keyframes.some((k) => k.joint === 'spine')).toBe(true);
    expect(idleClip.loop).toBe(true);
  });
});
