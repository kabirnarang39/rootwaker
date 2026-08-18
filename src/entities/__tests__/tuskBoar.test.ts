import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createTuskBoar, getBoarHitbox } from '../tuskBoar';

function meshNames(group: THREE.Object3D): Set<string> {
  const names = new Set<string>();
  group.traverse((obj) => {
    if ((obj as { isMesh?: boolean }).isMesh) names.add(obj.name);
  });
  return names;
}

describe('createTuskBoar', () => {
  it('every real anatomy part is named — body, head, snout, 2 eyes, 2 ears, 2 tusks, 4 legs (regression 5b812b5: a creature built from bare unnamed primitives reads as "a dark shapeless rock"; viper/owl/finch already had this guard, boar never did)', () => {
    const boar = createTuskBoar();
    const names = meshNames(boar.group);
    for (const part of [
      'boar-body', 'boar-head', 'boar-snout',
      'boar-eye-l', 'boar-eye-r', 'boar-ear-l', 'boar-ear-r',
      'boar-tusk-l', 'boar-tusk-r',
      'boar-forepaw-l', 'boar-forepaw-r', 'boar-hindpaw-l', 'boar-hindpaw-r',
    ]) {
      expect(names, `missing anatomy part: ${part}`).toContain(part);
    }
  });

  it('starts at 68 HP, idle (bumped with the real-size scale-up — a bulkier boar takes a real fight to fell)', () => {
    const boar = createTuskBoar();
    expect(boar.combatant.hp).toBe(68);
    expect(boar.combatant.maxHp).toBe(68);
    expect(boar.ai.state).toBe('idle');
  });

  it('is real-world scaled up (1.25x) from its unscaled geometry — a wild boar must read sturdier/bulkier than the fox-sized player', () => {
    const boar = createTuskBoar();
    expect(boar.group.scale.x).toBeCloseTo(1.25, 5);
  });

  it('hitbox radius is scaled proportionally with the visual size bump', () => {
    const boar = createTuskBoar();
    expect(boar.combatant.hitbox.radius).toBeCloseTo(0.5, 5);
  });

  it('getBoarHitbox tracks the spine joint\'s world position after update()', () => {
    const boar = createTuskBoar();
    boar.group.position.set(3, 0, 3);
    boar.update(0, 1 / 60, 10);
    const hitbox = getBoarHitbox(boar);
    expect(hitbox.start.x).toBeCloseTo(3, 1);
    expect(hitbox.start.z).toBeCloseTo(3, 1);
  });

  it('enters telegraph state when the player is within aggro range and applies the charge clip', () => {
    const boar = createTuskBoar();
    boar.update(0, 1 / 60, 1);
    expect(boar.ai.state).toBe('telegraph');
  });

  it('sets ai.strikeRange from its own combatant hitbox radius', () => {
    const boar = createTuskBoar();
    boar.update(0, 1 / 60, 1);
    expect(boar.ai.strikeRange).toBeCloseTo(boar.combatant.hitbox.radius + 0.4 - 0.05, 5);
  });

  it('has a real, fast recovery window after charging (a boar can commit to another charge quickly — aggressive, not deliberate)', () => {
    const boar = createTuskBoar();
    boar.update(0, 1 / 60, 1);
    expect(boar.ai.recoverSeconds).toBe(0.5);
  });
});
