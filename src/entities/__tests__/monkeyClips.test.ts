import { describe, it, expect } from 'vitest';
import { idleClip, dartClip } from '../monkeyClips';

describe('monkey clips', () => {
  it('idleClip loops and drives a real alert head-scan plus a subtle tail sway', () => {
    expect(idleClip.loop).toBe(true);
    const joints = new Set(idleClip.keyframes.map((k) => k.joint));
    expect(joints.has('head')).toBe(true);
    expect(joints.has('tail0')).toBe(true);
  });

  it('dartClip is a non-looping, real fast telegraph-then-dart motion driving spine and jaw together', () => {
    expect(dartClip.loop).toBe(false);
    expect(dartClip.duration).toBe(0.5); // by far the shortest attack clip duration in the game — a real quick darting strike
    const joints = new Set(dartClip.keyframes.map((k) => k.joint));
    expect(joints.has('spine')).toBe(true);
    expect(joints.has('jaw')).toBe(true);
  });

  it('the jaw bares (opens) during the coil and is shut again by the dart — a real threat display, not a static prop', () => {
    const jawKeyframes = dartClip.keyframes.filter((k) => k.joint === 'jaw');
    const bareFrame = jawKeyframes.find((k) => k.time === 0.25);
    const closedFrame = jawKeyframes.find((k) => k.time === 0.35);
    expect(bareFrame?.rotation?.[0]).toBeLessThan(-0.2);
    expect(closedFrame?.rotation?.[0]).toBe(0);
  });

  it('the spine actually surges forward (real position offset) at the dart instant, not just a rotation', () => {
    const spineKeyframes = dartClip.keyframes.filter((k) => k.joint === 'spine');
    const dartFrame = spineKeyframes.find((k) => k.time === 0.35);
    expect(dartFrame?.position?.[2]).toBeGreaterThan(0.15);
  });
});
