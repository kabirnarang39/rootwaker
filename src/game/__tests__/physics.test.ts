import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { GRAVITY_MPS2, applyGravity, integrate, damp, type PhysicsBody } from '../physics';

describe('physics', () => {
  it('applyGravity accelerates velocity.y downward proportional to delta', () => {
    const body: PhysicsBody = { position: new THREE.Vector3(), velocity: new THREE.Vector3() };
    applyGravity(body, 0.5);
    expect(body.velocity.y).toBeCloseTo(-GRAVITY_MPS2 * 0.5, 5);
  });

  it('applyGravity respects a scale factor (e.g. buoyancy reducing effective gravity)', () => {
    const body: PhysicsBody = { position: new THREE.Vector3(), velocity: new THREE.Vector3() };
    applyGravity(body, 1, 0.25);
    expect(body.velocity.y).toBeCloseTo(-GRAVITY_MPS2 * 0.25, 5);
  });

  it('integrate moves position by velocity * delta', () => {
    const body: PhysicsBody = { position: new THREE.Vector3(0, 0, 0), velocity: new THREE.Vector3(2, -1, 0) };
    integrate(body, 0.5);
    expect(body.position.x).toBeCloseTo(1, 5);
    expect(body.position.y).toBeCloseTo(-0.5, 5);
  });

  it('damp reduces velocity multiplicatively, dragPerSecond=0 leaves it unchanged', () => {
    const v = new THREE.Vector3(10, 0, 0);
    damp(v, 0, 1);
    expect(v.x).toBeCloseTo(10, 5);
  });

  it('damp with dragPerSecond close to 1 kills velocity over one second', () => {
    const v = new THREE.Vector3(10, 0, 0);
    damp(v, 0.99, 1);
    expect(v.x).toBeCloseTo(0.1, 5);
  });
});
