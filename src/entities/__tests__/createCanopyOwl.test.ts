import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createCanopyOwl, getCanopyOwlHitbox } from '../createCanopyOwl';

function meshNames(group: THREE.Object3D): Set<string> {
  const names = new Set<string>();
  group.traverse((obj) => {
    if ((obj as { isMesh?: boolean }).isMesh) names.add(obj.name);
  });
  return names;
}

describe('createCanopyOwl', () => {
  it('starts at 34 HP with a 0.32m hitbox radius, idle, perched at an unset height until the level assigns one', () => {
    const owl = createCanopyOwl();
    expect(owl.combatant.hp).toBe(34);
    expect(owl.combatant.maxHp).toBe(34);
    expect(owl.combatant.hitbox.radius).toBeCloseTo(0.32, 5);
    expect(owl.ai.state).toBe('idle');
    expect(owl.perchY).toBe(0);
  });

  it('has every real owl part — facial disc, hooked beak, two forward eyes, two ear tufts, two swept wings, a fanned tail, and two talon legs with claws (regression 5b812b5: a creature built from one capsule plus one icosahedron shipped and read as "a dark shapeless rock")', () => {
    const names = meshNames(createCanopyOwl().group);
    for (const part of [
      'owl-body', 'owl-head', 'owl-facial-disc',
      'owl-beak', 'owl-beak-hook',
      'owl-eye-l', 'owl-eye-r',
      'owl-ear-tuft-l', 'owl-ear-tuft-r',
      'owl-wing-l', 'owl-wing-r', 'owl-primaries-l', 'owl-primaries-r',
      'owl-tail-fan',
      'owl-leg-l', 'owl-leg-r', 'owl-foot-l', 'owl-foot-r',
    ]) {
      expect(names, `missing anatomy part: ${part}`).toContain(part);
    }
    // Three visible claws per foot — the strike surface the dive clip thrusts forward.
    for (const side of ['l', 'r']) {
      for (let i = 0; i < 3; i++) expect(names).toContain(`owl-claw-${side}-${i}`);
    }
  });

  it('applying the dive clip at t=0 leaves the spine on its bind pose, not at the clip\'s raw keyframe value (regression: clips author position keyframes as deltas around zero, so without captureBasePose the first frame would drop the whole body to y=0)', () => {
    const owl = createCanopyOwl();
    owl.update(0, 1 / 60, 1); // within aggro range -> telegraph, so diveClip is applied at t=0
    expect(owl.ai.state).toBe('telegraph');
    const spine = owl.group.getObjectByName('spine');
    expect(spine).toBeDefined();
    expect(spine!.position.y).toBeCloseTo(0.3, 5);
    expect(spine!.position.x).toBeCloseTo(0, 5);
    expect(spine!.position.z).toBeCloseTo(0, 5);
  });

  it('the bind pose survives hundreds of alternating idle/attack frames without cumulative drift', () => {
    const owl = createCanopyOwl();
    for (let i = 0; i < 300; i++) owl.update(i * 0.016, 0.016, i % 60 < 30 ? 1 : 8);
    const spine = owl.group.getObjectByName('spine');
    // Largest authored spine offset in either clip is 0.06m; anything beyond that is drift.
    expect(Math.abs(spine!.position.y - 0.3)).toBeLessThanOrEqual(0.061);
  });

  it('sets ai.telegraphSeconds and ai.strikeRange from its own hitbox before ai.update() advances the state machine', () => {
    const owl = createCanopyOwl();
    owl.update(0, 1 / 60, 1);
    expect(owl.ai.telegraphSeconds).toBeCloseTo(0.5, 5);
    expect(owl.ai.strikeRange).toBeCloseTo(0.32 + 0.4 - 0.05, 5); // computeStrikeRange(0.32)
  });

  it('a telegraph that completes while the player is still beyond strikeRange never deals damage (real pursuit contract: the owl must actually close the distance, not swing from its perch)', () => {
    const owl = createCanopyOwl();
    const farButAggroed = 3; // inside EnemyAI's aggro range (4), well beyond strikeRange (0.67)
    let damageFrames = 0;
    for (let i = 0; i < 180; i++) {
      owl.update(i * 0.016, 0.016, farButAggroed);
      if (owl.ai.shouldDealDamageThisFrame()) damageFrames++;
    }
    expect(damageFrames).toBe(0);

    // Control: the identical loop at contact distance does land hits, so the assertion above is
    // testing the range gate and not a dead state machine.
    const closeOwl = createCanopyOwl();
    let closeDamageFrames = 0;
    for (let i = 0; i < 180; i++) {
      closeOwl.update(i * 0.016, 0.016, 0.5);
      if (closeOwl.ai.shouldDealDamageThisFrame()) closeDamageFrames++;
    }
    expect(closeDamageFrames).toBeGreaterThan(0);
  });

  it('getCanopyOwlHitbox tracks the spine joint\'s world position after update() and spans 0.4m upward', () => {
    const owl = createCanopyOwl();
    owl.group.position.set(4, 3.2, -2);
    owl.update(0, 1 / 60, 10);
    const hitbox = getCanopyOwlHitbox(owl);
    expect(hitbox.start.x).toBeCloseTo(4, 1);
    expect(hitbox.start.z).toBeCloseTo(-2, 1);
    expect(hitbox.start.y).toBeCloseTo(3.5, 1); // group y + spine bind height (0.3)
    expect(hitbox.end.y - hitbox.start.y).toBeCloseTo(0.4, 5);
  });
});
