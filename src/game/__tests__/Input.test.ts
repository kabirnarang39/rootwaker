import { describe, it, expect } from 'vitest';
import { resolveMoveVector } from '../Input';

describe('resolveMoveVector', () => {
  it('W/ArrowUp moves forward (+z... actually -z is camera-forward, but resolver returns raw intent)', () => {
    expect(resolveMoveVector(new Set(['KeyW']))).toEqual({ x: 0, z: 1 });
  });

  it('opposing keys cancel out', () => {
    expect(resolveMoveVector(new Set(['KeyW', 'KeyS']))).toEqual({ x: 0, z: 0 });
  });

  it('diagonal input is not normalized by the resolver (normalization is the controller\'s job)', () => {
    expect(resolveMoveVector(new Set(['KeyW', 'KeyD']))).toEqual({ x: 1, z: 1 });
  });

  it('no relevant keys held returns zero vector', () => {
    expect(resolveMoveVector(new Set(['ShiftLeft']))).toEqual({ x: 0, z: 0 });
  });
});
