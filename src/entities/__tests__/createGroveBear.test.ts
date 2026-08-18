import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createGroveBear, getGroveBearHitbox } from '../createGroveBear';

function meshNames(group: THREE.Object3D): Set<string> {
  const names = new Set<string>();
  group.traverse((obj) => {
    if ((obj as { isMesh?: boolean }).isMesh) names.add(obj.name);
  });
  return names;
}

describe('createGroveBear', () => {
  it('every real anatomy part is named — body, head, snout, nose, 2 eyes, 2 ears, 2 claws, 4 legs (regression 5b812b5: a creature built from bare unnamed primitives reads as "a dark shapeless rock"; viper/owl/finch already had this guard, bear never did)', () => {
    const bear = createGroveBear();
    const names = meshNames(bear.group);
    for (const part of [
      'bear-body', 'bear-head', 'bear-snout', 'bear-nose',
      'bear-eye-l', 'bear-eye-r', 'bear-ear-l', 'bear-ear-r',
      'bear-claw-l', 'bear-claw-r',
      'bear-forepaw-l', 'bear-forepaw-r', 'bear-hindpaw-l', 'bear-hindpaw-r',
    ]) {
      expect(names, `missing anatomy part: ${part}`).toContain(part);
    }
  });

  it('starts at 90 HP (bumped with the real-size scale-up — a visibly bigger bear takes a real fight to fell)', () => {
    const bear = createGroveBear();
    expect(bear.combatant.hp).toBe(90);
    expect(bear.combatant.maxHp).toBe(90);
    expect(bear.ai.state).toBe('idle');
  });

  it('is real-world scaled up (1.6x) from its unscaled geometry — a bear must read meaningfully bigger than the fox-sized player, not near-identical', () => {
    const bear = createGroveBear();
    expect(bear.group.scale.x).toBeCloseTo(1.6, 5);
    expect(bear.group.scale.y).toBeCloseTo(1.6, 5);
    expect(bear.group.scale.z).toBeCloseTo(1.6, 5);
  });

  it('hitbox radius is scaled proportionally with the visual size bump — hit detection must match what the player actually sees', () => {
    const bear = createGroveBear();
    expect(bear.combatant.hitbox.radius).toBeCloseTo(0.72, 5);
  });

  it('getGroveBearHitbox tracks the spine joint\'s world position after update()', () => {
    const bear = createGroveBear();
    bear.group.position.set(3, 0, 3);
    bear.update(0, 1 / 60, 10);
    const hitbox = getGroveBearHitbox(bear);
    expect(hitbox.start.x).toBeCloseTo(3, 1);
    expect(hitbox.start.z).toBeCloseTo(3, 1);
  });

  it('enters telegraph state when the player is within aggro range and applies the claw-swipe clip', () => {
    const bear = createGroveBear();
    bear.update(0, 1 / 60, 1); // within EnemyAI's default aggro range
    expect(bear.ai.state).toBe('telegraph');
  });

  it('sets ai.strikeRange from its own combatant hitbox radius (real pursuit: a telegraph completing while still far away must not guarantee a hit)', () => {
    const bear = createGroveBear();
    bear.update(0, 1 / 60, 1);
    expect(bear.ai.strikeRange).toBeCloseTo(bear.combatant.hitbox.radius + 0.4 - 0.05, 5);
  });

  it('has a real, heavy recovery window after attacking (a bear cannot spam swipes the way a boar charges again)', () => {
    const bear = createGroveBear();
    bear.update(0, 1 / 60, 1);
    expect(bear.ai.recoverSeconds).toBe(1.3);
  });
});
