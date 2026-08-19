import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { PlayerController } from '../PlayerController';

const flatGroundAt = () => 0;

describe('PlayerController flying', () => {
  it('beginFly switches mode to flying and only from grounded', () => {
    const pc = new PlayerController(new THREE.Vector3(0, 0, 0));
    pc.beginFly();
    expect(pc.mode).toBe('flying');
  });

  it('beginFly is a no-op from a non-grounded mode (e.g. already climbing)', () => {
    const pc = new PlayerController(new THREE.Vector3(0, 0, 0));
    pc.beginClimb(new THREE.Vector3(1, 0, 0), 5);
    pc.beginFly();
    expect(pc.mode).toBe('climbing');
  });

  it('real horizontal cruise: holding forward input moves the player forward while airborne', () => {
    const pc = new PlayerController(new THREE.Vector3(0, 5, 0));
    pc.beginFly();
    for (let i = 0; i < 60; i++) pc.updateFly({ x: 0, z: 1, jump: false }, 1 / 60, false, false, flatGroundAt);
    expect(pc.body.position.z).toBeGreaterThan(0);
  });

  it('holding ascend real climbs altitude over time', () => {
    const pc = new PlayerController(new THREE.Vector3(0, 5, 0));
    pc.beginFly();
    for (let i = 0; i < 60; i++) pc.updateFly({ x: 0, z: 0, jump: false }, 1 / 60, true, false, flatGroundAt);
    expect(pc.body.position.y).toBeGreaterThan(5);
  });

  it('a real safety floor stops cruising flight from clipping through the terrain below, even with no vertical input at all', () => {
    const pc = new PlayerController(new THREE.Vector3(0, 0.05, 0));
    pc.beginFly();
    for (let i = 0; i < 30; i++) pc.updateFly({ x: 0, z: 0, jump: false }, 1 / 60, false, false, flatGroundAt);
    expect(pc.body.position.y).toBeGreaterThanOrEqual(0.6 - 1e-6);
    expect(pc.mode).toBe('flying'); // cruising near the floor never involuntarily lands the player
  });

  it('never exceeds the real altitude ceiling even with ascend held the whole time', () => {
    const pc = new PlayerController(new THREE.Vector3(0, 5, 0));
    pc.beginFly();
    for (let i = 0; i < 600; i++) pc.updateFly({ x: 0, z: 0, jump: false }, 1 / 60, true, false, flatGroundAt);
    expect(pc.body.position.y).toBeLessThanOrEqual(40 + 1e-6);
  });

  it('a real controlled descent lands the player once close enough to the ground, dismounting back to grounded', () => {
    const pc = new PlayerController(new THREE.Vector3(0, 5, 0));
    pc.beginFly();
    for (let i = 0; i < 600; i++) {
      pc.updateFly({ x: 0, z: 0, jump: false }, 1 / 60, false, true, flatGroundAt);
      if (pc.mode === 'grounded') break;
    }
    expect(pc.mode).toBe('grounded');
    expect(pc.body.position.y).toBeCloseTo(0, 5);
  });

  it('holding descend actually breaks through the cruising safety floor — landing must be reachable, not fought by the same clamp that protects cruising flight', () => {
    const pc = new PlayerController(new THREE.Vector3(0, 0.6, 0));
    pc.beginFly();
    let landed = false;
    for (let i = 0; i < 300; i++) {
      pc.updateFly({ x: 0, z: 0, jump: false }, 1 / 60, false, true, flatGroundAt);
      if (pc.mode === 'grounded') {
        landed = true;
        break;
      }
    }
    expect(landed).toBe(true);
  });
});
