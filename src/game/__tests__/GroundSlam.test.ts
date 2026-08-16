import { describe, it, expect } from 'vitest';
import { GroundSlam } from '../GroundSlam';

describe('GroundSlam', () => {
  it('starts idle and does no damage', () => {
    const slam = new GroundSlam();
    expect(slam.state).toBe('idle');
    expect(slam.isDamaging()).toBe(false);
  });

  it('arm() moves idle -> telegraph, not straight to active (fairness: a real warning window)', () => {
    const slam = new GroundSlam();
    slam.arm();
    expect(slam.state).toBe('telegraph');
    expect(slam.isDamaging()).toBe(false);
  });

  it('telegraph -> active after its warning window elapses, then isDamaging() is true', () => {
    const slam = new GroundSlam();
    slam.arm();
    for (let i = 0; i < 60; i++) slam.update(1 / 60); // 1 second, comfortably past a sub-1s telegraph
    expect(slam.state).toBe('active');
    expect(slam.isDamaging()).toBe(true);
  });

  it('active -> idle after its damage window elapses, isDamaging() returns to false', () => {
    const slam = new GroundSlam();
    slam.arm();
    for (let i = 0; i < 120; i++) slam.update(1 / 60); // 2 seconds, past telegraph + active
    expect(slam.state).toBe('idle');
    expect(slam.isDamaging()).toBe(false);
  });

  it('arm() while already telegraphing or active is a no-op (safe to call every frame from the king)', () => {
    const slam = new GroundSlam();
    slam.arm();
    slam.update(1 / 60);
    const stateAfterFirstArm = slam.state;
    slam.arm(); // called again mid-telegraph
    expect(slam.state).toBe(stateAfterFirstArm); // unchanged, didn't reset the telegraph timer
  });
});
