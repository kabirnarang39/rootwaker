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
});
