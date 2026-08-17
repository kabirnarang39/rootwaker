import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createFishSchool } from '../createFishSchool';

describe('createFishSchool', () => {
  it('builds `count` fish, each swimming as its own group under the shared school group', () => {
    const school = createFishSchool(new THREE.Vector3(0, -1.2, 0), 6);
    expect(school.group.children.length).toBe(6);
  });

  it('is pure ambience — no combatant/AI properties leak into the returned shape', () => {
    const school = createFishSchool(new THREE.Vector3(), 4) as unknown as Record<string, unknown>;
    expect(school.combatant).toBeUndefined();
    expect(school.ai).toBeUndefined();
  });

  it('update() keeps every fish within the school radius of its center, never wandering off', () => {
    const center = new THREE.Vector3(5, -1.2, -3);
    const school = createFishSchool(center, 8);
    for (let i = 0; i < 200; i++) school.update(i * 0.05);
    for (const fish of school.group.children) {
      const horizontalDist = Math.hypot(fish.position.x - center.x, fish.position.z - center.z);
      expect(horizontalDist).toBeLessThan(3); // SCHOOL_RADIUS(2.2) * max radiusScale(1.1) + margin
    }
  });

  it('update() keeps every fish below the school center (under the sea surface, never poking through)', () => {
    const center = new THREE.Vector3(0, -1.2, 0);
    const school = createFishSchool(center, 5);
    for (let i = 0; i < 50; i++) school.update(i * 0.1);
    for (const fish of school.group.children) {
      expect(fish.position.y).toBeLessThan(center.y);
    }
  });

  it('does not throw across a long simulated run (no NaN/undefined creeping into position or rotation)', () => {
    const school = createFishSchool(new THREE.Vector3(1, -1, 1), 8);
    expect(() => {
      for (let i = 0; i < 1000; i++) school.update(i * 0.033);
    }).not.toThrow();
    for (const fish of school.group.children) {
      expect(Number.isFinite(fish.position.x)).toBe(true);
      expect(Number.isFinite(fish.rotation.y)).toBe(true);
    }
  });
});
