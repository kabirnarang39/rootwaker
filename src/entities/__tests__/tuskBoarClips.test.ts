import { describe, it, expect } from 'vitest';
import { idleClip, chargeClip } from '../tuskBoarClips';

describe('tusk-boar clips', () => {
  it('idleClip loops and sways the spine gently', () => {
    expect(idleClip.loop).toBe(true);
    expect(idleClip.keyframes.some((k) => k.joint === 'spine')).toBe(true);
  });

  it('chargeClip is a non-looping telegraph-then-charge motion', () => {
    expect(chargeClip.loop).toBe(false);
    expect(chargeClip.keyframes.length).toBeGreaterThanOrEqual(3);
  });

  it('a real tusk-toss at impact: the head drives down through the charge, then whips sharply upward at the moment of impact', () => {
    const headKeyframes = chargeClip.keyframes.filter((k) => k.joint === 'head');
    const drivingDown = headKeyframes.find((k) => k.time === 0.5);
    const tossUp = headKeyframes.find((k) => k.time === 0.65);
    expect(drivingDown?.rotation?.[0]).toBeGreaterThan(0);
    expect(tossUp?.rotation?.[0]).toBeLessThan(0);
  });

  it('the tusks flare outward on the same toss — a real goring spread, not a straight punch', () => {
    const tuskL = chargeClip.keyframes.find((k) => k.joint === 'tuskL' && k.time === 0.65);
    const tuskR = chargeClip.keyframes.find((k) => k.joint === 'tuskR' && k.time === 0.65);
    expect(tuskL?.rotation?.[2]).toBeGreaterThan(0);
    expect(tuskR?.rotation?.[2]).toBeLessThan(0);
  });
});
