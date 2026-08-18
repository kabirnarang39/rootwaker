import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createGroveHare } from '../groveHare';

function meshNames(group: THREE.Object3D): Set<string> {
  const names = new Set<string>();
  group.traverse((obj) => {
    if ((obj as { isMesh?: boolean }).isMesh) names.add(obj.name);
  });
  return names;
}

describe('createGroveHare', () => {
  it('starts grazing, at the spawn position', () => {
    const spawn = new THREE.Vector3(2, 0, -4);
    const hare = createGroveHare(spawn);
    expect(hare.ai.state).toBe('graze');
    expect(hare.position.equals(spawn)).toBe(true);
  });

  it('has every real hare part named — a body, head, two ears, four legs (regression: this project has caught silent "unnamed mesh reads as a shapeless rock" bugs before, see commit 5b812b5; the hare had zero named parts until this fix)', () => {
    const names = meshNames(createGroveHare(new THREE.Vector3()).group);
    for (const part of [
      'hare-body', 'hare-head', 'hare-ear-l', 'hare-ear-r',
      'hare-leg-hindpawL', 'hare-leg-hindpawR', 'hare-leg-forepawL', 'hare-leg-forepawR',
    ]) {
      expect(names, `missing anatomy part: ${part}`).toContain(part);
    }
  });

  it('applying the graze pose at rest leaves the spine on its real bind-pose Y, not a raw clip keyframe (regression: clips author position/rotation deltas around the bind pose — without captureBasePose the first frame would snap to raw clip values)', () => {
    const hare = createGroveHare(new THREE.Vector3());
    hare.update(0, 1 / 60, 20, 0); // far + no approach -> stays grazing
    expect(hare.ai.state).toBe('graze');
    const spine = hare.group.getObjectByName('spine');
    expect(spine).toBeDefined();
    expect(spine!.position.y).toBeCloseTo(0.16, 5); // bind pose, set via rig.setLocalPosition
  });

  it('reaches real fleeing state after a sustained close/fast approach (the same 2-tick alert->fleeing transition every WildlifeAI-driven species uses)', () => {
    const hare = createGroveHare(new THREE.Vector3());
    hare.update(0, 1 / 60, 1, 5); // close + fast approach -> alert
    expect(hare.ai.state).toBe('alert');
    hare.update(0.016, 0.5, 1, 5); // held past ALERT_REACTION_SECONDS -> fleeing
    expect(hare.ai.state).toBe('fleeing');
  });

  it('the flee gait bounces the spine within its real authored range (groveHareClips\' fleeClip amplitude, 0..0.08m) and never beyond it — bounded oscillation, not unbounded drift', () => {
    const hare = createGroveHare(new THREE.Vector3());
    hare.update(0, 1 / 60, 1, 5);
    hare.update(0.016, 0.5, 1, 5);
    expect(hare.ai.state).toBe('fleeing');
    const spine = hare.group.getObjectByName('spine')!;
    for (let i = 0; i < 300; i++) {
      hare.update(0.5 + i * 0.016, 0.016, 1, 5); // stays fleeing (still close+fast) the whole loop
      expect(spine.position.y).toBeGreaterThanOrEqual(0.16 - 1e-6);
      expect(spine.position.y).toBeLessThanOrEqual(0.16 + 0.08 + 1e-6);
    }
  });

  it('fleeStep does nothing while not fleeing', () => {
    const hare = createGroveHare(new THREE.Vector3());
    const before = hare.position.clone();
    hare.fleeStep(0.1, new THREE.Vector3(1, 0, 0));
    expect(hare.position.equals(before)).toBe(true);
  });

  it('real distance covered while fleeing scales with FLEE_SPEED (3.2 m/s) — not some other arbitrary rate', () => {
    const hare = createGroveHare(new THREE.Vector3());
    hare.update(0, 1 / 60, 1, 5);
    hare.update(0.016, 0.5, 1, 5);
    expect(hare.ai.state).toBe('fleeing');

    const awayDir = new THREE.Vector3(1, 0, 0);
    const dt = 1 / 60;
    for (let i = 0; i < 60; i++) hare.fleeStep(dt, awayDir); // 1 real second of fleeing
    expect(hare.position.x).toBeCloseTo(3.2, 1);
  });
});
