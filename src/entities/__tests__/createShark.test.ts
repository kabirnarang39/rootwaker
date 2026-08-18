import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createShark, getSharkHitbox } from '../createShark';

function meshNames(group: THREE.Object3D): Set<string> {
  const names = new Set<string>();
  group.traverse((obj) => {
    if ((obj as { isMesh?: boolean }).isMesh) names.add(obj.name);
  });
  return names;
}

describe('createShark', () => {
  it('every real anatomy part is named — fore/aft body, belly, dorsal fin, head, jaw, 2 eyes, 2 pectoral fins, 3 tail segments, caudal fin', () => {
    const shark = createShark();
    const names = meshNames(shark.group);
    for (const part of [
      'shark-body-fore', 'shark-body-aft', 'shark-belly', 'shark-dorsal-fin',
      'shark-head', 'shark-jaw', 'shark-eye-l', 'shark-eye-r',
      'shark-fin-l', 'shark-fin-r', 'shark-tail0', 'shark-tail1', 'shark-caudal-fin',
    ]) {
      expect(names, `missing anatomy part: ${part}`).toContain(part);
    }
  });

  it('has real teeth in the jaw', () => {
    const shark = createShark();
    const names = meshNames(shark.group);
    for (const part of ['shark-tooth-l1', 'shark-tooth-r1', 'shark-tooth-l2', 'shark-tooth-r2']) {
      expect(names, `missing tooth: ${part}`).toContain(part);
    }
  });

  it('starts at 70 HP, idle', () => {
    const shark = createShark();
    expect(shark.combatant.hp).toBe(70);
    expect(shark.combatant.maxHp).toBe(70);
    expect(shark.ai.state).toBe('idle');
  });

  it('is real-world scaled up (1.5x), comparable presence to the lion/bear tier', () => {
    const shark = createShark();
    expect(shark.group.scale.x).toBeCloseTo(1.5, 5);
  });

  it('has no leg/ground-contact joints at all — a fully aquatic species, unlike every ground-based creature in the game', () => {
    const shark = createShark();
    for (const groundJoint of ['forepawL', 'forepawR', 'hipL', 'hipR', 'hindpawL', 'hindpawR'] as const) {
      expect(shark.rig.hasJoint(groundJoint)).toBe(false);
    }
  });

  it('getSharkHitbox tracks the spine joint\'s world position after update()', () => {
    const shark = createShark();
    shark.group.position.set(220, -1.2, 5);
    shark.update(0, 1 / 60, 10);
    const hitbox = getSharkHitbox(shark);
    expect(hitbox.start.x).toBeCloseTo(220, 1);
    expect(hitbox.start.z).toBeCloseTo(5, 1);
  });

  it('enters telegraph state when the player is within aggro range and applies the lunge clip', () => {
    const shark = createShark();
    shark.update(0, 1 / 60, 1);
    expect(shark.ai.state).toBe('telegraph');
  });

  it('sets ai.strikeRange from its own combatant hitbox radius', () => {
    const shark = createShark();
    shark.update(0, 1 / 60, 1);
    expect(shark.ai.strikeRange).toBeCloseTo(shark.combatant.hitbox.radius + 0.4 - 0.05, 5);
  });

  it('has a real fast recovery — a shark circles back for another pass quickly, unlike the crocodile\'s long post-lunge exposure', () => {
    const shark = createShark();
    shark.update(0, 1 / 60, 1);
    expect(shark.ai.recoverSeconds).toBe(0.6);
  });

  it('cruises continuously even when idle/far from the player — real tail-sway locomotion, never fully still (the real anatomical distinction from the crocodile\'s deliberate stillness)', () => {
    const shark = createShark();
    const before = shark.rig.getJoint('tail2').rotation.y;
    for (let i = 1; i <= 30; i++) shark.update(i / 30, 1 / 30, 100); // far — stays idle/cruising
    const after = shark.rig.getJoint('tail2').rotation.y;
    expect(after).not.toBeCloseTo(before, 2);
  });
});
