import { describe, it, expect } from 'vitest';
import { idleClip, lungeClip } from '../crocodileClips';

describe('crocodile clips', () => {
  it('idleClip loops and only sways the tail — deliberately the subtlest idle in the game, matching a real ambush predator staying almost perfectly still', () => {
    expect(idleClip.loop).toBe(true);
    expect(idleClip.keyframes.every((k) => k.joint === 'tail1')).toBe(true);
  });

  it('lungeClip is a non-looping telegraph-then-lunge motion driving spine, jaw, and tail together', () => {
    expect(lungeClip.loop).toBe(false);
    const joints = new Set(lungeClip.keyframes.map((k) => k.joint));
    expect(joints.has('spine')).toBe(true);
    expect(joints.has('jaw')).toBe(true);
    expect(joints.has('tail1')).toBe(true);
  });

  it('the jaw opens during the telegraph and is shut again by the strike — a real bite, not a static prop', () => {
    const jawKeyframes = lungeClip.keyframes.filter((k) => k.joint === 'jaw');
    const openFrame = jawKeyframes.find((k) => k.time === 0.5);
    const closedFrame = jawKeyframes.find((k) => k.time === 0.62);
    expect(openFrame?.rotation?.[0]).toBeLessThan(-0.3);
    expect(closedFrame?.rotation?.[0]).toBe(0);
  });

  it('a real death roll follows the bite: the tail kicks to one side before the spine completes a full barrel roll', () => {
    expect(lungeClip.duration).toBeGreaterThan(1.4);
    const spineKeyframes = lungeClip.keyframes.filter((k) => k.joint === 'spine' && k.time > 0.9);
    expect(spineKeyframes.length).toBeGreaterThan(0);
    const finalSpineRoll = spineKeyframes[spineKeyframes.length - 1];
    expect(finalSpineRoll.rotation?.[2]).toBeCloseTo(Math.PI * 2, 3);
    const tailKick = lungeClip.keyframes.find((k) => k.joint === 'tail1' && k.time > 0.9 && k.time < 1.2);
    expect(tailKick?.rotation?.[1]).toBeLessThan(0);
  });
});
