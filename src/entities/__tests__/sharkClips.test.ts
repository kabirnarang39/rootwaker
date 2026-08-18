import { describe, it, expect } from 'vitest';
import { cruiseClip, lungeClip } from '../sharkClips';

describe('shark clips', () => {
  it('cruiseClip loops and drives the tail chain plus a subtle pectoral-fin wobble — real continuous locomotion, not a stillness pose', () => {
    expect(cruiseClip.loop).toBe(true);
    const joints = new Set(cruiseClip.keyframes.map((k) => k.joint));
    expect(joints.has('tail0')).toBe(true);
    expect(joints.has('tail1')).toBe(true);
    expect(joints.has('tail2')).toBe(true);
    expect(joints.has('wingL')).toBe(true);
    expect(joints.has('wingR')).toBe(true);
  });

  it('the tail chain amplitude increases toward the tip (tail0 < tail1 < tail2) — a real travelling-wave whip, not a rigid rod', () => {
    const amplitudeOf = (joint: string) => {
      const k = cruiseClip.keyframes.find((kf) => kf.joint === joint && kf.time === 0.8);
      return Math.abs(k?.rotation?.[1] ?? 0);
    };
    expect(amplitudeOf('tail0')).toBeLessThan(amplitudeOf('tail1'));
    expect(amplitudeOf('tail1')).toBeLessThan(amplitudeOf('tail2'));
  });

  it('lungeClip is a non-looping telegraph-then-ram motion driving spine, jaw, and tail together', () => {
    expect(lungeClip.loop).toBe(false);
    const joints = new Set(lungeClip.keyframes.map((k) => k.joint));
    expect(joints.has('spine')).toBe(true);
    expect(joints.has('jaw')).toBe(true);
    expect(joints.has('tail2')).toBe(true);
  });

  it('the jaw opens wide at the real strike instant and is shut again after — a real bite, not a static prop', () => {
    const jawKeyframes = lungeClip.keyframes.filter((k) => k.joint === 'jaw');
    const strikeFrame = jawKeyframes.find((k) => k.time === 0.62);
    const closedFrame = jawKeyframes.find((k) => k.time === 0.9);
    expect(strikeFrame?.rotation?.[0]).toBeLessThan(-0.5);
    expect(closedFrame?.rotation?.[0]).toBe(0);
  });

  it('the spine actually surges forward (real position offset) at the ram instant, not just a rotation — a real ram needs real forward displacement', () => {
    const spineKeyframes = lungeClip.keyframes.filter((k) => k.joint === 'spine');
    const ramFrame = spineKeyframes.find((k) => k.time === 0.62);
    expect(ramFrame?.position?.[2]).toBeGreaterThan(0.3);
  });
});
