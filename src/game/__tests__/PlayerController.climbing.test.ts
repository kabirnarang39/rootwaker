import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { PlayerController } from '../PlayerController';

describe('PlayerController climbing', () => {
  it('beginClimb switches mode to climbing and suspends gravity', () => {
    const pc = new PlayerController(new THREE.Vector3(0, 0, 0));
    pc.beginClimb(new THREE.Vector3(0, 0, 1), 5);
    expect(pc.mode).toBe('climbing');
    const yBefore = pc.body.position.y;
    pc.updateClimb({ x: 0, z: 0, jump: false }, 0.5);
    // no forward/up input -> no gravity fall, no drift
    expect(pc.body.position.y).toBeCloseTo(yBefore, 5);
  });

  it('positive z input climbs upward along the wall', () => {
    const pc = new PlayerController(new THREE.Vector3(0, 0, 0));
    pc.beginClimb(new THREE.Vector3(0, 0, 1), 5);
    pc.updateClimb({ x: 0, z: 1, jump: false }, 1);
    expect(pc.body.position.y).toBeGreaterThan(0);
  });

  it('reaching topY dismounts back to grounded', () => {
    const pc = new PlayerController(new THREE.Vector3(0, 4.9, 0));
    pc.beginClimb(new THREE.Vector3(0, 0, 1), 5);
    pc.updateClimb({ x: 0, z: 1, jump: false }, 1);
    expect(pc.mode).toBe('grounded');
  });
});
