import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { PlayerController } from '../PlayerController';
import type { WaterBody } from '../WaterBody';

const water: WaterBody = {
  bounds: new THREE.Box3(new THREE.Vector3(-5, -3, -5), new THREE.Vector3(5, 0, 5)),
  surfaceY: 0,
  current: new THREE.Vector3(1, 0, 0),
};

describe('PlayerController swimming', () => {
  it('beginSwim switches mode to swimming', () => {
    const pc = new PlayerController(new THREE.Vector3(0, -1, 0));
    pc.beginSwim();
    expect(pc.mode).toBe('swimming');
  });

  it('buoyancy pulls a submerged player back toward the surface over time', () => {
    const pc = new PlayerController(new THREE.Vector3(0, -2, 0));
    pc.beginSwim();
    for (let i = 0; i < 180; i++) pc.updateSwim({ x: 0, z: 0, jump: false }, 1 / 60, water);
    expect(pc.body.position.y).toBeGreaterThan(-2);
    expect(pc.body.position.y).toBeLessThanOrEqual(water.surfaceY + 0.05);
  });

  it('the current pushes the player horizontally even with no input', () => {
    const pc = new PlayerController(new THREE.Vector3(0, -1, 0));
    pc.beginSwim();
    for (let i = 0; i < 60; i++) pc.updateSwim({ x: 0, z: 0, jump: false }, 1 / 60, water);
    expect(pc.body.position.x).toBeGreaterThan(0);
  });

  it('rising above the surface dismounts back to grounded', () => {
    const pc = new PlayerController(new THREE.Vector3(0, -0.05, 0));
    pc.beginSwim();
    for (let i = 0; i < 120; i++) pc.updateSwim({ x: 0, z: 0, jump: false }, 1 / 60, water);
    expect(pc.mode).toBe('grounded');
  });
});
