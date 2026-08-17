import { describe, it, expect } from 'vitest';
import { WeatherSystem } from '../WeatherSystem';

describe('WeatherSystem', () => {
  it('starts clear with zero rain and default multipliers', () => {
    const weather = new WeatherSystem(0, () => 0.5);
    const snap = weather.update(0);
    expect(snap.condition).toBe('clear');
    expect(snap.params.rainIntensity).toBe(0);
    expect(snap.params.fogMultiplier).toBe(1);
    expect(snap.params.lightMultiplier).toBe(1);
    expect(snap.params.tideAmplitudeMultiplier).toBe(1);
  });

  it('holds the starting condition until the (seeded) hold duration elapses', () => {
    // rng()=0 -> holdUntil = 0 + HOLD_MIN_SECONDS(90)
    const weather = new WeatherSystem(0, () => 0);
    expect(weather.update(50).condition).toBe('clear');
    expect(weather.update(89).condition).toBe('clear');
  });

  it('begins transitioning to a neighboring condition once the hold elapses, never jumping straight to a non-adjacent one', () => {
    // rng()=0 throughout: holdUntil=90, pickNext() picks the first neighbor index -> 'overcast' (idx 0's only neighbor going up)
    const weather = new WeatherSystem(0, () => 0);
    const snap = weather.update(90);
    expect(snap.condition).toBe('overcast');
    expect(snap.params.rainIntensity).toBeGreaterThanOrEqual(0); // mid-crossfade, still near 0 this early
  });

  it('crossfades params gradually during a transition, not an instant snap', () => {
    const weather = new WeatherSystem(0, () => 0);
    weather.update(90); // transition starts here (transitionStart=90), target 'overcast'
    const midway = weather.update(90 + 22.5); // ~half of the 45s TRANSITION_SECONDS
    // overcast's rainIntensity is 0 same as clear's, but lightMultiplier differs (1.0 -> 0.72) —
    // a real mid-transition value should sit strictly between the two, not already at the target.
    expect(midway.params.lightMultiplier).toBeLessThan(1);
    expect(midway.params.lightMultiplier).toBeGreaterThan(0.72);
  });

  it('completes the transition and settles on the new condition\'s exact params once the full transition duration elapses', () => {
    const weather = new WeatherSystem(0, () => 0);
    weather.update(90);
    const settled = weather.update(90 + 45);
    expect(settled.condition).toBe('overcast');
    expect(settled.params.lightMultiplier).toBeCloseTo(0.72, 5);
  });

  it('a storm produces real, distinctly harsher params than clear weather on every axis (fog thicker, light dimmer, tide higher, rain heavier)', () => {
    // Walk rng()=0.999 repeatedly to always pick the UPPER neighbor: clear -> overcast -> rain ->
    // storm. Real per-frame-sized steps (5s), like production's actual call pattern — a single
    // update() call only ever advances the state machine by one phase (start OR complete a
    // transition), so a coarse step can straddle a start without also completing it; small steps
    // avoid that entirely and mirror how this is really driven.
    const weather = new WeatherSystem(0, () => 0.999);
    let t = 0;
    let snap = weather.update(t);
    for (let i = 0; i < 3000 && snap.condition !== 'storm'; i++) {
      t += 5;
      snap = weather.update(t);
    }
    expect(snap.condition).toBe('storm');
    expect(snap.params.fogMultiplier).toBeGreaterThan(1);
    expect(snap.params.lightMultiplier).toBeLessThan(1);
    expect(snap.params.tideAmplitudeMultiplier).toBeGreaterThan(1);
    expect(snap.params.rainIntensity).toBeGreaterThan(0);
  });

  it('never throws across a long simulated real-time range at real per-frame granularity', () => {
    const weather = new WeatherSystem(0);
    expect(() => {
      for (let t = 0; t < 3600; t += 1 / 60) weather.update(t);
    }).not.toThrow();
  });
});
