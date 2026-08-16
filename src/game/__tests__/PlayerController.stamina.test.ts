import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { PlayerController } from '../PlayerController';

describe('PlayerController stamina', () => {
  it('starts at full stamina (100)', () => {
    const pc = new PlayerController(new THREE.Vector3(0, 0, 0));
    expect(pc.stamina).toBe(100);
  });

  it('climbing drains stamina over time', () => {
    const pc = new PlayerController(new THREE.Vector3(0, 0, 0));
    pc.beginClimb(new THREE.Vector3(0, 0, 1), 100);
    pc.updateClimb({ x: 0, z: 1, jump: false }, 1);
    expect(pc.stamina).toBeLessThan(100);
  });

  it('restStamina() recovers stamina over time, capped at 100', () => {
    const pc = new PlayerController(new THREE.Vector3(0, 0, 0));
    pc.beginClimb(new THREE.Vector3(0, 0, 1), 100);
    pc.updateClimb({ x: 0, z: 1, jump: false }, 5);
    const drained = pc.stamina;
    expect(drained).toBeLessThan(100);
    pc.restStamina(20);
    expect(pc.stamina).toBe(100);
  });

  it('stamina reaching 0 during a climb triggers a fall to the last ledge, exits climbing mode', () => {
    const pc = new PlayerController(new THREE.Vector3(0, 0, 0));
    const ledgeY = 2;
    pc.beginClimb(new THREE.Vector3(0, 0, 1), 100, new THREE.Vector3(0, ledgeY, 0));
    for (let i = 0; i < 200; i++) pc.updateClimb({ x: 0, z: 1, jump: false }, 1);
    expect(pc.stamina).toBe(0);
    expect(pc.mode).toBe('grounded');
    expect(pc.body.position.y).toBeCloseTo(ledgeY, 5);
  });
});
