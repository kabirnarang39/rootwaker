import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { PlayerController } from '../PlayerController';

const flatGround = () => 0;

describe('PlayerController grounded movement', () => {
  it('moves horizontally per input, scaled by delta and move speed', () => {
    const pc = new PlayerController(new THREE.Vector3(0, 0, 0));
    pc.update({ x: 1, z: 0, jump: false }, 0.5, flatGround);
    expect(pc.body.position.x).toBeGreaterThan(0);
  });

  it('stays clamped to ground height when not jumping', () => {
    const pc = new PlayerController(new THREE.Vector3(0, 5, 0));
    for (let i = 0; i < 60; i++) pc.update({ x: 0, z: 0, jump: false }, 1 / 60, flatGround);
    expect(pc.body.position.y).toBeCloseTo(0, 1);
  });

  it('jump gives upward velocity that arcs back down onto the ground', () => {
    const pc = new PlayerController(new THREE.Vector3(0, 0, 0));
    pc.update({ x: 0, z: 0, jump: true }, 1 / 60, flatGround);
    expect(pc.body.velocity.y).toBeGreaterThan(0);
    for (let i = 0; i < 120; i++) pc.update({ x: 0, z: 0, jump: false }, 1 / 60, flatGround);
    expect(pc.body.position.y).toBeCloseTo(0, 1);
  });

  it('starts in grounded mode', () => {
    const pc = new PlayerController(new THREE.Vector3());
    expect(pc.mode).toBe('grounded');
  });
});
