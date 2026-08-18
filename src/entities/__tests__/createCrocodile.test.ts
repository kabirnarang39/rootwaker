import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createCrocodile, getCrocodileHitbox } from '../createCrocodile';

function meshNames(group: THREE.Object3D): Set<string> {
  const names = new Set<string>();
  group.traverse((obj) => {
    if ((obj as { isMesh?: boolean }).isMesh) names.add(obj.name);
  });
  return names;
}

describe('createCrocodile', () => {
  it('every real anatomy part is named — body, belly, head, jaw, 2 eyes, 2 eye ridges, 4 legs, 3 tail segments, back ridges (regression 5b812b5: a creature built from bare unnamed primitives reads as "a dark shapeless rock")', () => {
    const croc = createCrocodile();
    const names = meshNames(croc.group);
    for (const part of [
      'crocodile-body', 'crocodile-belly', 'crocodile-head', 'crocodile-jaw',
      'crocodile-eye-l', 'crocodile-eye-r', 'crocodile-eye-ridge-l', 'crocodile-eye-ridge-r',
      'crocodile-forepaw-l', 'crocodile-forepaw-r', 'crocodile-hindpaw-l', 'crocodile-hindpaw-r',
      'crocodile-tail0', 'crocodile-tail1', 'crocodile-tail2',
      'crocodile-ridge-0', 'crocodile-ridge-1', 'crocodile-ridge-2',
    ]) {
      expect(names, `missing anatomy part: ${part}`).toContain(part);
    }
  });

  it('has real teeth in the jaw — a distinct anatomy trait from every other species', () => {
    const croc = createCrocodile();
    const names = meshNames(croc.group);
    for (const part of ['crocodile-tooth-l1', 'crocodile-tooth-r1', 'crocodile-tooth-l2', 'crocodile-tooth-r2']) {
      expect(names, `missing tooth: ${part}`).toContain(part);
    }
  });

  it('starts at 60 HP, idle', () => {
    const croc = createCrocodile();
    expect(croc.combatant.hp).toBe(60);
    expect(croc.combatant.maxHp).toBe(60);
    expect(croc.ai.state).toBe('idle');
  });

  it('is real-world scaled up (1.4x) from its unscaled geometry — a real ambush predator must read as large and imposing', () => {
    const croc = createCrocodile();
    expect(croc.group.scale.x).toBeCloseTo(1.4, 5);
  });

  it('the body is long and low — a real crocodile silhouette, distinct from every upright/roundish species already in the game', () => {
    const croc = createCrocodile();
    const body = croc.group.getObjectByName('crocodile-body') as THREE.Mesh;
    const geo = body.geometry as THREE.CapsuleGeometry;
    // A capsule lying on its side (body.rotation.z = PI/2): real length is 2*radius + the
    // cylinder length, real height is just the diameter.
    const realLength = geo.parameters.radius * 2 + geo.parameters.height;
    const realHeight = geo.parameters.radius * 2;
    expect(realLength).toBeGreaterThan(realHeight * 3); // long relative to its own height
  });

  it('hitbox radius is scaled proportionally with the visual size bump', () => {
    const croc = createCrocodile();
    expect(croc.combatant.hitbox.radius).toBeCloseTo(0.55, 5);
  });

  it('getCrocodileHitbox tracks the spine joint\'s world position after update()', () => {
    const croc = createCrocodile();
    croc.group.position.set(4, 0, -2);
    croc.update(0, 1 / 60, 10);
    const hitbox = getCrocodileHitbox(croc);
    expect(hitbox.start.x).toBeCloseTo(4, 1);
    expect(hitbox.start.z).toBeCloseTo(-2, 1);
  });

  it('enters telegraph state when the player is within aggro range and applies the lunge clip', () => {
    const croc = createCrocodile();
    croc.update(0, 1 / 60, 1);
    expect(croc.ai.state).toBe('telegraph');
  });

  it('sets ai.strikeRange from its own combatant hitbox radius', () => {
    const croc = createCrocodile();
    croc.update(0, 1 / 60, 1);
    expect(croc.ai.strikeRange).toBeCloseTo(croc.combatant.hitbox.radius + 0.4 - 0.05, 5);
  });

  it('has a real, slow recovery after lunging — a committed strike leaves it briefly exposed, unlike the boar\'s fast re-charge', () => {
    const croc = createCrocodile();
    croc.update(0, 1 / 60, 1);
    expect(croc.ai.recoverSeconds).toBe(1.1);
  });

  it('applying the idle pose at full weight leaves the spine on its real bind pose, not a raw clip keyframe (regression: clips author position/rotation deltas around the bind pose — without captureBasePose the first frame would snap to raw clip values)', () => {
    const croc = createCrocodile();
    croc.update(0, 1 / 60, 100); // far — stays idle
    const spine = croc.group.getObjectByName('spine');
    expect(spine).toBeDefined();
    expect(spine!.position.y).toBeCloseTo(0.14, 5);
  });
});
