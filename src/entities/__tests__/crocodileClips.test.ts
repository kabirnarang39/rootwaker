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
});
