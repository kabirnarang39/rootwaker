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

  it('without a pathAt argument, climbing is byte-identical to before (no Z drift at all)', () => {
    const pc = new PlayerController(new THREE.Vector3(0, 0, 5));
    pc.beginClimb(new THREE.Vector3(0, 0, 1), 5); // 2-arg call, exactly like every pre-existing call site
    pc.updateClimb({ x: 0, z: 1, jump: false }, 1);
    expect(pc.body.position.z).toBeCloseTo(5, 10);
  });

  it('with a pathAt argument, Z follows the path as height increases', () => {
    const pc = new PlayerController(new THREE.Vector3(0, 0, 5));
    const path = (h: number) => ({ dx: 0, dz: h * 0.1 }); // simple linear drift for a deterministic test
    pc.beginClimb(new THREE.Vector3(0, 0, 1), 5, undefined, path);
    pc.updateClimb({ x: 0, z: 1, jump: false }, 1);
    const heightClimbed = pc.body.position.y; // started at y=0
    expect(pc.body.position.z).toBeCloseTo(5 + heightClimbed * 0.1, 5);
  });

  it('zero z-input means zero height change, which means zero path drift, even with a real pathAt set (stillness stays still)', () => {
    const pc = new PlayerController(new THREE.Vector3(0, 0, 5));
    const path = (h: number) => ({ dx: 0, dz: h * 0.1 });
    pc.beginClimb(new THREE.Vector3(0, 0, 1), 5, undefined, path);
    pc.updateClimb({ x: 0, z: 0, jump: false }, 1);
    expect(pc.body.position.z).toBeCloseTo(5, 10);
  });

  it('the existing manual X wobble still works exactly as before, independent of and in addition to the new Z path-following', () => {
    const pc = new PlayerController(new THREE.Vector3(0, 0, 5));
    const path = (h: number) => ({ dx: 0, dz: h * 0.1 });
    pc.beginClimb(new THREE.Vector3(0, 0, 1), 5, undefined, path);
    const xBefore = pc.body.position.x;
    pc.updateClimb({ x: 1, z: 1, jump: false }, 1);
    expect(pc.body.position.x).toBeGreaterThan(xBefore); // unchanged existing behavior
  });
});
