import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { isInsideWaterBody, type WaterBody } from '../WaterBody';

describe('WaterBody', () => {
  const water: WaterBody = {
    bounds: new THREE.Box3(new THREE.Vector3(-2, -1, -2), new THREE.Vector3(2, 0.2, 2)),
    surfaceY: 0,
    current: new THREE.Vector3(0.5, 0, 0),
  };

  it('reports inside for a point within bounds', () => {
    expect(isInsideWaterBody(new THREE.Vector3(0, -0.5, 0), water)).toBe(true);
  });

  it('reports outside for a point above the surface', () => {
    expect(isInsideWaterBody(new THREE.Vector3(0, 1, 0), water)).toBe(false);
  });

  it('reports outside for a point outside the horizontal bounds', () => {
    expect(isInsideWaterBody(new THREE.Vector3(10, -0.5, 0), water)).toBe(false);
  });
});
