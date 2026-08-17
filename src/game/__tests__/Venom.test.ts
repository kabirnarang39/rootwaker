import { describe, it, expect } from 'vitest';
import { VenomTracker, VENOM_SECONDS, VENOM_TICK_SECONDS } from '../Venom';

const EXPECTED_TICKS = VENOM_SECONDS / VENOM_TICK_SECONDS; // 6

describe('VenomTracker', () => {
  it('fires exactly 6 ticks over 6 seconds stepping in 0.5s frame deltas', () => {
    const tracker = new VenomTracker();
    const target = {};
    let ticks = 0;
    let now = 0;
    tracker.apply(target, now);
    for (let i = 0; i < 20; i++) {
      now += 0.5;
      tracker.update(now, () => ticks++);
    }
    expect(ticks).toBe(EXPECTED_TICKS);
  });

  it('fires exactly 6 ticks over 6 seconds stepping in 1/60s frame deltas (same total as the 0.5s run)', () => {
    const tracker = new VenomTracker();
    const target = {};
    let ticks = 0;
    let now = 0;
    tracker.apply(target, now);
    for (let i = 0; i < 400; i++) {
      now += 1 / 60;
      tracker.update(now, () => ticks++);
    }
    expect(ticks).toBe(EXPECTED_TICKS);
  });

  it('never ticks after expiry — a target left in the tracker well past 6s stays at 6 ticks', () => {
    const tracker = new VenomTracker();
    const target = {};
    let ticks = 0;
    tracker.apply(target, 0);
    tracker.update(100, () => ticks++);
    tracker.update(1000, () => ticks++);
    expect(ticks).toBe(EXPECTED_TICKS);
  });

  it('never double-ticks within a single elapsed second', () => {
    const tracker = new VenomTracker();
    const target = {};
    let ticks = 0;
    tracker.apply(target, 0);
    tracker.update(1, () => ticks++);
    tracker.update(1, () => ticks++); // same instant called again — no re-fire
    expect(ticks).toBe(1);
  });

  it('clear() stops ticks immediately, even mid-duration', () => {
    const tracker = new VenomTracker();
    const target = {};
    let ticks = 0;
    tracker.apply(target, 0);
    tracker.update(2, () => ticks++);
    expect(ticks).toBe(2);
    tracker.clear(target);
    tracker.update(6, () => ticks++);
    expect(ticks).toBe(2);
  });

  it('tracks multiple targets independently, keyed on object identity', () => {
    const tracker = new VenomTracker();
    const a = {};
    const b = {};
    const hits: object[] = [];
    tracker.apply(a, 0);
    tracker.apply(b, 3); // envenomed 3s later
    tracker.update(4, (t) => hits.push(t));
    expect(hits).toEqual([a, a, a, a, b]);
  });

  it('re-applying venom restarts the full duration from the new time', () => {
    const tracker = new VenomTracker();
    const target = {};
    let ticks = 0;
    tracker.apply(target, 0);
    tracker.update(3, () => ticks++);
    expect(ticks).toBe(3);
    tracker.apply(target, 3); // refreshed
    tracker.update(9, () => ticks++);
    expect(ticks).toBe(3 + EXPECTED_TICKS);
  });
});
