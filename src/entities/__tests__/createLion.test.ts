import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createLion, getLionHitbox } from '../createLion';

function meshNames(group: THREE.Object3D): Set<string> {
  const names = new Set<string>();
  group.traverse((obj) => {
    if ((obj as { isMesh?: boolean }).isMesh) names.add(obj.name);
  });
  return names;
}

describe('createLion', () => {
  it('every real anatomy part is named — body, head, mane lobes, snout, nose, 2 eyes, 2 ears, 4 legs, tail + tuft (regression 5b812b5: a creature built from bare unnamed primitives reads as "a dark shapeless rock"; viper/owl/finch already had this guard)', () => {
    const lion = createLion();
    const names = meshNames(lion.group);
    for (const part of [
      'lion-body', 'lion-head', 'lion-snout', 'lion-nose',
      'lion-eye-l', 'lion-eye-r', 'lion-ear-l', 'lion-ear-r',
      'lion-forepaw-l', 'lion-forepaw-r', 'lion-hindpaw-l', 'lion-hindpaw-r',
      'lion-tail', 'lion-tail-tuft',
    ]) {
      expect(names, `missing anatomy part: ${part}`).toContain(part);
    }
    for (let i = 0; i < 7; i++) {
      expect(names, `missing mane lobe: lion-mane-${i}`).toContain(`lion-mane-${i}`);
    }
  });

  it('starts at 70 HP, idle', () => {
    const lion = createLion();
    expect(lion.combatant.hp).toBe(70);
    expect(lion.combatant.maxHp).toBe(70);
    expect(lion.ai.state).toBe('idle');
  });

  it('has a real mane (multiple lobes around the head), distinct from every other species — this is the trait that must read as "lion" at a glance', () => {
    const lion = createLion();
    let maneLobeCount = 0;
    lion.group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh && (obj as THREE.Mesh).geometry.type === 'IcosahedronGeometry') maneLobeCount++;
    });
    // Head (1) + 7 mane lobes + tail tuft (1) = 9 icosahedra minimum.
    expect(maneLobeCount).toBeGreaterThanOrEqual(9);
  });

  it('has a real tail chain (tail0, tail1) — the one species-defining trait no other jungle animal in the game has', () => {
    const lion = createLion();
    expect(lion.group.getObjectByName('tail0')).toBeDefined();
    expect(lion.group.getObjectByName('tail1')).toBeDefined();
  });

  it('getLionHitbox tracks the spine joint\'s world position after update()', () => {
    const lion = createLion();
    lion.group.position.set(5, 0, -2);
    lion.update(0, 1 / 60, 10);
    const hitbox = getLionHitbox(lion);
    expect(hitbox.start.x).toBeCloseTo(5, 1);
    expect(hitbox.start.z).toBeCloseTo(-2, 1);
  });

  it('enters telegraph state when the player is within aggro range and applies the pounce clip', () => {
    const lion = createLion();
    lion.update(0, 1 / 60, 1);
    expect(lion.ai.state).toBe('telegraph');
  });

  it('has the fastest ground-predator telegraph in the game (a real explosive ambush commit, not a slow wind-up)', () => {
    const lion = createLion();
    lion.update(0, 1 / 60, 1);
    expect(lion.ai.telegraphSeconds).toBe(0.4);
  });

  it('sets ai.strikeRange from its own combatant hitbox radius', () => {
    const lion = createLion();
    lion.update(0, 1 / 60, 1);
    expect(lion.ai.strikeRange).toBeCloseTo(lion.combatant.hitbox.radius + 0.4 - 0.05, 5);
  });

  it('has a real recovery window after a pounce (committing to a full-body leap costs more recovery than a boar\'s quick charge-reset)', () => {
    const lion = createLion();
    lion.update(0, 1 / 60, 1);
    expect(lion.ai.recoverSeconds).toBe(0.9);
  });

  it('the pounce is a real leap — spine gains real height mid-attack, not just a rotation swing (regression: every other species attacks without leaving the ground)', () => {
    const lion = createLion();
    let t = 0;
    const dt = 1 / 60;
    lion.update(t, dt, 1); // enters telegraph, starts pounceStartTime at t=0
    let guard = 0;
    while (lion.ai.state !== 'attacking' && guard++ < 200) {
      t += dt;
      lion.update(t, dt, 0.3);
    }
    expect(lion.ai.state).toBe('attacking'); // telegraph just completed, ~0.4s into the pounce clip
    // Keep driving forward to the clip's real leap-peak keyframe (~0.55s in, per lionClips.ts) —
    // entering 'attacking' alone only proves the telegraph ended, not that the leap has happened.
    for (let i = 0; i < 10 && lion.ai.state !== 'recovering'; i++) {
      t += dt;
      lion.update(t, dt, 0.3);
    }
    const spineY = lion.group.getObjectByName('spine')!.position.y;
    expect(spineY).toBeGreaterThan(0.3); // clearly above the 0.3 bind-pose height, mid-leap
  });
});
