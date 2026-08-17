import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createGroveSquirrel } from '../createGroveSquirrel';

function meshNames(group: THREE.Object3D): Set<string> {
  const names = new Set<string>();
  group.traverse((obj) => {
    if ((obj as { isMesh?: boolean }).isMesh) names.add(obj.name);
  });
  return names;
}

describe('createGroveSquirrel', () => {
  it('starts grazing, at the spawn position', () => {
    const spawn = new THREE.Vector3(3, 0, -1);
    const squirrel = createGroveSquirrel(spawn);
    expect(squirrel.ai.state).toBe('graze');
    expect(squirrel.position.equals(spawn)).toBe(true);
  });

  it('has every real squirrel part — a body, head with cheeks, chisel-tooth muzzle and a single ivory tooth, two small round ears, two dark bead eyes, four legs, and a three-segment bushy tail', () => {
    const names = meshNames(createGroveSquirrel(new THREE.Vector3()).group);
    for (const part of [
      'squirrel-body', 'squirrel-head',
      'squirrel-cheek-l', 'squirrel-cheek-r',
      'squirrel-muzzle', 'squirrel-tooth',
      'squirrel-ear-l', 'squirrel-ear-r',
      'squirrel-eye-l', 'squirrel-eye-r',
      'squirrel-leg-hindpawL', 'squirrel-leg-hindpawR',
      'squirrel-leg-forepawL', 'squirrel-leg-forepawR',
      'squirrel-tail-tail0', 'squirrel-tail-tail1', 'squirrel-tail-tail2',
    ]) {
      expect(names, `missing anatomy part: ${part}`).toContain(part);
    }
  });

  it('the bushy tail widens toward the tip — the opposite taper from the fox\'s tail', () => {
    const squirrel = createGroveSquirrel(new THREE.Vector3());
    const radiusOf = (name: string) => {
      const mesh = squirrel.group.getObjectByName(name) as THREE.Mesh;
      const geo = mesh.geometry as THREE.CylinderGeometry;
      return (geo.parameters.radiusTop + geo.parameters.radiusBottom) / 2;
    };
    const r0 = radiusOf('squirrel-tail-tail0');
    const r1 = radiusOf('squirrel-tail-tail1');
    const r2 = radiusOf('squirrel-tail-tail2');
    expect(r1).toBeGreaterThan(r0);
    expect(r2).toBeGreaterThan(r1);
  });

  it('applying the alert pose at full weight leaves the head on its bind pose, not at a raw clip keyframe (regression: clips author position/rotation deltas around the bind pose, so without captureBasePose the first frame would snap joints to raw values)', () => {
    const squirrel = createGroveSquirrel(new THREE.Vector3());
    squirrel.update(0, 1 / 60, 3, 4.5); // close + fast approach -> alert
    expect(squirrel.ai.state).toBe('alert');
    const spine = squirrel.group.getObjectByName('spine');
    expect(spine).toBeDefined();
    // spine's bind-pose y is 0.13; alertClip only rotates spine, never repositions it, so the
    // position must be untouched.
    expect(spine!.position.y).toBeCloseTo(0.13, 5);
  });

  it('the bind pose survives hundreds of alternating graze/alert/flee frames without cumulative drift', () => {
    const squirrel = createGroveSquirrel(new THREE.Vector3());
    for (let i = 0; i < 300; i++) {
      squirrel.update(i * 0.016, 0.016, i % 90 < 30 ? 2 : 20, i % 90 < 30 ? 4.5 : 0);
    }
    const spine = squirrel.group.getObjectByName('spine');
    expect(spine!.position.y).toBeCloseTo(0.13, 5);
  });

  it('fleeStep does nothing while not fleeing', () => {
    const squirrel = createGroveSquirrel(new THREE.Vector3());
    const before = squirrel.position.clone();
    squirrel.fleeStep(0.1, new THREE.Vector3(1, 0, 0));
    expect(squirrel.position.equals(before)).toBe(true);
  });

  it('flees in burst/freeze cycles: displacement over a fixed interval is strictly less than the full burst speed times elapsed time, and at least one sub-interval has zero displacement', () => {
    const squirrel = createGroveSquirrel(new THREE.Vector3());
    // Force into 'fleeing' via the real AI: close + fast approach, then held past the reaction window.
    squirrel.update(0, 0.016, 2, 4.5);
    squirrel.update(0.016, 0.5, 2, 4.5);
    expect(squirrel.ai.state).toBe('fleeing');

    const awayDir = new THREE.Vector3(1, 0, 0);
    const dt = 1 / 60;
    const totalSeconds = 2;
    const steps = Math.round(totalSeconds / dt);
    let elapsed = 0;
    let sawZeroDisplacementStep = false;

    for (let i = 0; i < steps; i++) {
      const before = squirrel.position.x;
      squirrel.fleeStep(dt, awayDir);
      const stepDisplacement = squirrel.position.x - before;
      if (Math.abs(stepDisplacement) < 1e-9) sawZeroDisplacementStep = true;
      elapsed += dt;
    }

    const totalDisplacement = squirrel.position.x; // started at x=0
    expect(totalDisplacement).toBeLessThan(4.0 * elapsed);
    expect(sawZeroDisplacementStep).toBe(true);
  });
});
