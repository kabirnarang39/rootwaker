import { describe, it, expect } from 'vitest';
import { canTransition } from '../LocomotionState';

describe('LocomotionState transitions', () => {
  it('allows grounded <-> climbing, swimming, combat, flying', () => {
    expect(canTransition('grounded', 'climbing')).toBe(true);
    expect(canTransition('climbing', 'grounded')).toBe(true);
    expect(canTransition('grounded', 'swimming')).toBe(true);
    expect(canTransition('swimming', 'grounded')).toBe(true);
    expect(canTransition('grounded', 'combat')).toBe(true);
    expect(canTransition('combat', 'grounded')).toBe(true);
    expect(canTransition('grounded', 'flying')).toBe(true);
    expect(canTransition('flying', 'grounded')).toBe(true);
  });

  it('disallows direct climbing <-> swimming, climbing <-> combat, or flying <-> any non-grounded mode', () => {
    expect(canTransition('climbing', 'swimming')).toBe(false);
    expect(canTransition('swimming', 'climbing')).toBe(false);
    expect(canTransition('climbing', 'combat')).toBe(false);
    expect(canTransition('combat', 'climbing')).toBe(false);
    expect(canTransition('flying', 'climbing')).toBe(false);
    expect(canTransition('flying', 'swimming')).toBe(false);
    expect(canTransition('climbing', 'flying')).toBe(false);
  });

  it('a mode transitioning to itself is a no-op allowed transition', () => {
    expect(canTransition('grounded', 'grounded')).toBe(true);
  });
});
