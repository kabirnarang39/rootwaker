import { describe, it, expect } from 'vitest';
import { WindGust } from '../WindGust';

const TELEGRAPH_SECONDS = 1.2;
const GUST_SECONDS = 0.8;
const CALM_SECONDS = 4;

describe('WindGust', () => {
  it('starts calm', () => {
    const gust = new WindGust();
    expect(gust.state).toBe('calm');
  });

  it('cycles calm -> telegraph -> gusting -> calm on its own timers', () => {
    const gust = new WindGust();
    gust.update(CALM_SECONDS + 0.01);
    expect(gust.state).toBe('telegraph');
    gust.update(TELEGRAPH_SECONDS + 0.01);
    expect(gust.state).toBe('gusting');
    gust.update(GUST_SECONDS + 0.01);
    expect(gust.state).toBe('calm');
  });

  it('forceVector is zero outside the gusting state', () => {
    const gust = new WindGust();
    expect(gust.forceVector().length()).toBe(0);
  });

  it('forceVector is nonzero while gusting', () => {
    const gust = new WindGust();
    gust.update(CALM_SECONDS + 0.01);
    gust.update(TELEGRAPH_SECONDS + 0.01);
    expect(gust.state).toBe('gusting');
    expect(gust.forceVector().length()).toBeGreaterThan(0);
  });
});
