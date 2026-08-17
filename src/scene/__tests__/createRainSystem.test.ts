import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createRainSystem } from '../createRainSystem';

describe('createRainSystem', () => {
  it('builds a real InstancedMesh named "rain" under the returned group', () => {
    const rain = createRainSystem();
    const mesh = rain.group.getObjectByName('rain') as THREE.InstancedMesh;
    expect(mesh).toBeDefined();
    expect((mesh as unknown as { isInstancedMesh?: boolean }).isInstancedMesh).toBe(true);
  });

  it('update() does not throw across a long simulated run at any intensity', () => {
    const rain = createRainSystem();
    const center = new THREE.Vector3(3, 0, -2);
    expect(() => {
      for (let i = 0; i < 500; i++) rain.update(center, (i % 100) / 100, 1 / 60);
    }).not.toThrow();
  });

  it('at zero intensity, every drop instance is a real zero-scale (degenerate, invisible) matrix parked off-screen', () => {
    // Matrix4.decompose() can't recover a scale from a singular (zero-scale) matrix — its own
    // determinant-is-0 branch just reports scale=(1,1,1) back, per three.js's own source — so
    // this checks the position sentinel and the raw scale-column matrix entries directly instead
    // of trusting decompose() for the zero case.
    const rain = createRainSystem();
    const mesh = rain.group.getObjectByName('rain') as THREE.InstancedMesh;
    rain.update(new THREE.Vector3(), 0, 1 / 60);
    const m = new THREE.Matrix4();
    mesh.getMatrixAt(0, m);
    const e = m.elements;
    expect(e[13]).toBe(-9999); // position.y sentinel
    expect(Math.hypot(e[0], e[1], e[2])).toBeCloseTo(0, 5); // scale-X column length
    expect(Math.hypot(e[4], e[5], e[6])).toBeCloseTo(0, 5); // scale-Y column length
    expect(Math.hypot(e[8], e[9], e[10])).toBeCloseTo(0, 5); // scale-Z column length
  });

  it('at full intensity, at least one drop instance is a real, non-zero-scaled streak positioned near the given center', () => {
    const rain = createRainSystem();
    const mesh = rain.group.getObjectByName('rain') as THREE.InstancedMesh;
    const center = new THREE.Vector3(5, 0, 5);
    rain.update(center, 1, 1 / 60);
    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    mesh.getMatrixAt(0, m);
    m.decompose(pos, quat, scale);
    expect(scale.length()).toBeGreaterThan(0);
    expect(Math.abs(pos.x - center.x)).toBeLessThan(20); // within the real spawn radius of the center
  });
});
