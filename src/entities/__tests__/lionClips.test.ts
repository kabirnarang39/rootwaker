import { describe, it, expect } from 'vitest';
import { idleClip, pounceClip } from '../lionClips';

describe('lion clips', () => {
  it('idleClip breathes the spine and sways the tail, looping', () => {
    expect(idleClip.loop).toBe(true);
    const joints = new Set(idleClip.keyframes.map((k) => k.joint));
    expect(joints.has('spine')).toBe(true);
    expect(joints.has('tail0')).toBe(true);
  });

  it('pounceClip is a non-looping leap-then-bite motion driving spine, tail, head, and jaw together', () => {
    expect(pounceClip.loop).toBe(false);
    const joints = new Set(pounceClip.keyframes.map((k) => k.joint));
    expect(joints.has('spine')).toBe(true);
    expect(joints.has('tail0')).toBe(true);
    expect(joints.has('head')).toBe(true);
    expect(joints.has('jaw')).toBe(true);
  });

  it('the leap goes airborne (a real vertical hop) before landing low and forward', () => {
    const spineKeyframes = pounceClip.keyframes.filter((k) => k.joint === 'spine');
    const airborne = spineKeyframes.find((k) => k.time === 0.55);
    const landed = spineKeyframes.find((k) => k.time === 0.7);
    expect(airborne?.position?.[1]).toBeGreaterThan(0);
    expect(landed?.position?.[1]).toBe(0);
  });

  it('a real throat bite-and-hold follows the landing: head/jaw stay neutral through the leap, then clamp down and hold before releasing', () => {
    expect(pounceClip.duration).toBeGreaterThan(1.1);
    const headKeyframes = pounceClip.keyframes.filter((k) => k.joint === 'head');
    const atLanding = headKeyframes.find((k) => k.time === 0.7);
    const clamped = headKeyframes.find((k) => k.time === 0.78);
    const released = headKeyframes[headKeyframes.length - 1];
    expect(atLanding?.rotation?.[0]).toBe(0); // no bite motion during the leap itself
    expect(clamped?.rotation?.[0]).toBeLessThan(-0.3);
    expect(released.rotation?.[0]).toBe(0);

    const jawKeyframes = pounceClip.keyframes.filter((k) => k.joint === 'jaw');
    const jawClamped = jawKeyframes.find((k) => k.time === 0.78);
    expect(jawClamped?.rotation?.[0]).toBeLessThan(0);
  });
});
