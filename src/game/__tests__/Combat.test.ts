import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { applyDamage, isDefeated, resolveMeleeHit, CLAW_SWIPE, COMBO_STRIKE_2, COMBO_FINISHER, COMBO_MOVES, COMBO_KNOCKBACK, type Combatant } from '../Combat';
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

describe('COMBO_MOVES', () => {
  it('stage 0 is exactly CLAW_SWIPE (the same object) — a single tap must stay byte-identical to the pre-combo game', () => {
    expect(COMBO_MOVES[0]).toBe(CLAW_SWIPE);
  });

  it('damage escalates through the 3 real stages — the finisher must be worth committing to', () => {
    expect(COMBO_STRIKE_2.damage).toBeGreaterThan(CLAW_SWIPE.damage);
    expect(COMBO_FINISHER.damage).toBeGreaterThan(COMBO_STRIKE_2.damage);
  });

  it('recovery cost escalates too — real risk for committing to a later combo stage, not a free damage upgrade', () => {
    expect(COMBO_STRIKE_2.recoverySeconds).toBeGreaterThan(CLAW_SWIPE.recoverySeconds);
    expect(COMBO_FINISHER.recoverySeconds).toBeGreaterThan(COMBO_STRIKE_2.recoverySeconds);
  });

  it('has exactly 3 real stages', () => {
    expect(COMBO_MOVES.length).toBe(3);
  });

  it('COMBO_KNOCKBACK escalates alongside the moves themselves, one entry per stage', () => {
    expect(COMBO_KNOCKBACK.length).toBe(COMBO_MOVES.length);
    expect(COMBO_KNOCKBACK[1]).toBeGreaterThan(COMBO_KNOCKBACK[0]);
    expect(COMBO_KNOCKBACK[2]).toBeGreaterThan(COMBO_KNOCKBACK[1]);
  });
});

function capsuleAt(x: number): Capsule {
  return { start: new THREE.Vector3(x, 0, 0), end: new THREE.Vector3(x, 1, 0), radius: 0.4 };
}
