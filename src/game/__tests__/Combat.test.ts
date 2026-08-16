import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { applyDamage, isDefeated, resolveMeleeHit, type Combatant } from '../Combat';
import type { Capsule } from '../collision';

describe('Combat', () => {
  it('applyDamage reduces hp, floored at 0', () => {
    const c: Combatant = { hp: 10, maxHp: 10, hitbox: capsuleAt(0) };
    applyDamage(c, 15);
    expect(c.hp).toBe(0);
  });

  it('isDefeated is true once hp reaches 0', () => {
    const c: Combatant = { hp: 0, maxHp: 10, hitbox: capsuleAt(0) };
    expect(isDefeated(c)).toBe(true);
  });

  it('resolveMeleeHit connects when the attack capsule overlaps the target hitbox', () => {
    const target: Combatant = { hp: 10, maxHp: 10, hitbox: capsuleAt(0) };
    const attackHitbox = capsuleAt(0.3);
    expect(resolveMeleeHit(attackHitbox, target)).toBe(true);
  });

  it('resolveMeleeHit misses when out of range', () => {
    const target: Combatant = { hp: 10, maxHp: 10, hitbox: capsuleAt(0) };
    const attackHitbox = capsuleAt(10);
    expect(resolveMeleeHit(attackHitbox, target)).toBe(false);
  });
});

function capsuleAt(x: number): Capsule {
  return { start: new THREE.Vector3(x, 0, 0), end: new THREE.Vector3(x, 1, 0), radius: 0.4 };
}
