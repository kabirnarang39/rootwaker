import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { capsuleVsCapsule, capsuleVsBox, type Capsule, type Box } from '../collision';

describe('collision', () => {
  it('capsuleVsCapsule: overlapping capsules report hit with correct depth', () => {
    const a: Capsule = { start: new THREE.Vector3(0, 0, 0), end: new THREE.Vector3(0, 1, 0), radius: 0.5 };
    const b: Capsule = { start: new THREE.Vector3(0.6, 0, 0), end: new THREE.Vector3(0.6, 1, 0), radius: 0.5 };
    const result = capsuleVsCapsule(a, b);
    expect(result.hit).toBe(true);
    expect(result.depth).toBeCloseTo(0.4, 5);
  });

  it('capsuleVsCapsule: far-apart capsules do not hit', () => {
    const a: Capsule = { start: new THREE.Vector3(0, 0, 0), end: new THREE.Vector3(0, 1, 0), radius: 0.3 };
    const b: Capsule = { start: new THREE.Vector3(5, 0, 0), end: new THREE.Vector3(5, 1, 0), radius: 0.3 };
    expect(capsuleVsCapsule(a, b).hit).toBe(false);
  });

  it('capsuleVsBox: capsule resting inside a box overlaps', () => {
    const cap: Capsule = { start: new THREE.Vector3(0, 0, 0), end: new THREE.Vector3(0, 1, 0), radius: 0.4 };
    const box: Box = { min: new THREE.Vector3(-1, -1, -1), max: new THREE.Vector3(1, 2, 1) };
    expect(capsuleVsBox(cap, box).hit).toBe(true);
  });

  it('capsuleVsBox: capsule well outside the box does not overlap', () => {
    const cap: Capsule = { start: new THREE.Vector3(10, 0, 0), end: new THREE.Vector3(10, 1, 0), radius: 0.3 };
    const box: Box = { min: new THREE.Vector3(-1, -1, -1), max: new THREE.Vector3(1, 2, 1) };
    expect(capsuleVsBox(cap, box).hit).toBe(false);
  });
});
