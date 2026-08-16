import { describe, it, expect } from 'vitest';
import { idleClip, strikeClip } from '../mountainGuardClips';

describe('mountain-guard clips', () => {
  it('idleClip loops and sways the spine gently', () => {
    expect(idleClip.loop).toBe(true);
    expect(idleClip.keyframes.some((k) => k.joint === 'spine')).toBe(true);
  });

  it('strikeClip is a non-looping telegraph-then-strike motion', () => {
    expect(strikeClip.loop).toBe(false);
    expect(strikeClip.keyframes.length).toBeGreaterThanOrEqual(3);
  });
});
