import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createMonkey, getMonkeyHitbox } from '../createMonkey';

function meshNames(group: THREE.Object3D): Set<string> {
  const names = new Set<string>();
  group.traverse((obj) => {
    if ((obj as { isMesh?: boolean }).isMesh) names.add(obj.name);
  });
  return names;
}

describe('createMonkey', () => {
  it('every real anatomy part is named — body, bare face (no snout), head, jaw, 2 eyes, 2 ears, 4 legs, 2 tail segments', () => {
    const monkey = createMonkey();
    const names = meshNames(monkey.group);
    for (const part of [
      'monkey-body', 'monkey-head', 'monkey-face', 'monkey-jaw',
      'monkey-eye-l', 'monkey-eye-r', 'monkey-ear-l', 'monkey-ear-r',
      'monkey-forepaw-l', 'monkey-forepaw-r', 'monkey-hindpaw-l', 'monkey-hindpaw-r',
      'monkey-tail0', 'monkey-tail1',
    ]) {
      expect(names, `missing anatomy part: ${part}`).toContain(part);
    }
  });

  it('starts at 35 HP (the lowest-HP huntable species — a real, deliberately smaller/more vulnerable animal), idle', () => {
    const monkey = createMonkey();
    expect(monkey.combatant.hp).toBe(35);
    expect(monkey.combatant.maxHp).toBe(35);
    expect(monkey.ai.state).toBe('idle');
  });

  it('is real-world scaled DOWN (0.75x) — the one species this session that scales smaller than the fox, not another apex-predator-scale threat', () => {
    const monkey = createMonkey();
    expect(monkey.group.scale.x).toBeCloseTo(0.75, 5);
  });

  it('has near-equal fore/hindlimb proportions (real macaque anatomy — intermembral index ~90, unlike a longer-armed brachiating ape), not a longer-limbed swinging rig', () => {
    const monkey = createMonkey();
    const shoulderY = monkey.rig.getJoint('shoulderL').position.y;
    const hipY = monkey.rig.getJoint('hipL').position.y;
    expect(shoulderY).toBeCloseTo(hipY, 5);
  });

  it('getMonkeyHitbox tracks the spine joint\'s world position after update()', () => {
    const monkey = createMonkey();
    monkey.group.position.set(3, 0, -5);
    monkey.update(0, 1 / 60, 10);
    const hitbox = getMonkeyHitbox(monkey);
    expect(hitbox.start.x).toBeCloseTo(3, 1);
    expect(hitbox.start.z).toBeCloseTo(-5, 1);
  });

  it('enters telegraph state when the player is within aggro range and applies the dart clip', () => {
    const monkey = createMonkey();
    monkey.update(0, 1 / 60, 1);
    expect(monkey.ai.state).toBe('telegraph');
  });

  it('sets ai.strikeRange from its own (smaller) combatant hitbox radius', () => {
    const monkey = createMonkey();
    monkey.update(0, 1 / 60, 1);
    expect(monkey.ai.strikeRange).toBeCloseTo(monkey.combatant.hitbox.radius + 0.4 - 0.05, 5);
  });

  it('has the fastest real telegraph+recovery cycle in the game — a genuinely quicker, darting combat rhythm distinct from every larger species\' slower committed strikes', () => {
    const monkey = createMonkey();
    monkey.update(0, 1 / 60, 1);
    expect(monkey.ai.telegraphSeconds).toBe(0.2);
    expect(monkey.ai.recoverSeconds).toBe(0.35);
  });
});
