import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createDuskFinchFlock } from '../createDuskFinchFlock';

function meshNames(group: THREE.Object3D): Set<string> {
  const names = new Set<string>();
  group.traverse((obj) => {
    if ((obj as { isMesh?: boolean }).isMesh) names.add(obj.name);
  });
  return names;
}

describe('createDuskFinchFlock', () => {
  it('starts perched with `count` finch rigs, each with real anatomy — body, head, beak, two wings, two eyes, and a tail (regression 5b812b5: a creature built from bare primitives reads as "a dark shapeless rock")', () => {
    const flock = createDuskFinchFlock(new THREE.Vector3(0, 0, 0), 5);
    expect(flock.state).toBe('perched');
    expect(flock.group.children.length).toBe(5);
    const names = meshNames(flock.group);
    for (const part of [
      'finch-body', 'finch-head', 'finch-beak',
      'finch-eye-l', 'finch-eye-r',
      'finch-wing-l', 'finch-wing-r',
      'finch-tail',
    ]) {
      expect(names, `missing anatomy part: ${part}`).toContain(part);
    }
  });

  it('is pure ambience — no combatant/AI properties leak into the returned shape', () => {
    const flock = createDuskFinchFlock(new THREE.Vector3(), 5) as unknown as Record<string, unknown>;
    expect(flock.combatant).toBeUndefined();
    expect(flock.ai).toBeUndefined();
  });

  it('stays perched while the player is far away', () => {
    const flock = createDuskFinchFlock(new THREE.Vector3(), 5);
    for (let i = 0; i < 60; i++) flock.update(i * 0.016, 0.016, 20);
    expect(flock.state).toBe('perched');
  });

  it('runs the full cycle: perched -> flushed at 4m -> circling -> perched again at 15m', () => {
    const center = new THREE.Vector3(10, 0, 5);
    const flock = createDuskFinchFlock(center, 5);
    let t = 0;
    const dt = 0.016;

    // Far away: stays perched.
    for (let i = 0; i < 10; i++) {
      flock.update(t, dt, 20);
      t += dt;
    }
    expect(flock.state).toBe('perched');

    // Player closes to 4m, inside the 5m flush range -> explosive group takeoff.
    flock.update(t, dt, 4);
    t += dt;
    expect(flock.state).toBe('flushed');

    // Run long enough for the flush window (0.5s) to complete -> circling.
    let guard = 0;
    while (flock.state !== 'circling' && guard++ < 200) {
      flock.update(t, dt, 4);
      t += dt;
    }
    expect(flock.state).toBe('circling');

    // Keep circling while the player is still close.
    for (let i = 0; i < 30; i++) {
      flock.update(t, dt, 4);
      t += dt;
    }
    expect(flock.state).toBe('circling');

    // Player retreats to 15m, beyond the 12m resettle range -> back to perched.
    flock.update(t, dt, 15);
    t += dt;
    expect(flock.state).toBe('perched');
  });

  it('the flush is an explosive GROUP takeoff — every bird starts rising in the same frame the flock flushes, not a staggered trickle', () => {
    const center = new THREE.Vector3();
    const flock = createDuskFinchFlock(center, 5);
    const startYs = flock.group.children.map((c) => c.position.y);

    flock.update(0, 0.016, 4); // triggers flush this frame
    flock.update(0.016, 0.05, 4); // one real step into the flush window

    const afterYs = flock.group.children.map((c) => c.position.y);
    for (let i = 0; i < afterYs.length; i++) {
      expect(afterYs[i]).toBeGreaterThan(startYs[i]);
    }
  });

  it('wings return to rest after a full flush -> circling -> resettle cycle (regression: flapClip drives wingL/wingR only while airborne; without an explicit reset on resettle, a bird\'s wings would freeze at whatever mid-flap rotation they had when it last landed — the same "joint stuck at a stale value" bug class Task 3 found and fixed in the viper\'s tail, 0ec0b0f)', () => {
    const center = new THREE.Vector3();
    const flock = createDuskFinchFlock(center, 5);
    let t = 0;
    const dt = 0.016;

    flock.update(t, dt, 4);
    t += dt;
    let guard = 0;
    while (flock.state !== 'circling' && guard++ < 200) {
      flock.update(t, dt, 4);
      t += dt;
    }
    for (let i = 0; i < 20; i++) {
      flock.update(t, dt, 4);
      t += dt;
    }
    // Sanity: prove a wing actually moved off rest before resettling, otherwise this test would
    // pass even without the fix.
    const wingMovedBeforeResettle = flock.group.children.some((child) => {
      const wing = child.getObjectByName('finch-wing-l');
      return wing && Math.abs(wing.parent!.rotation.z) > 0.01;
    });
    expect(wingMovedBeforeResettle).toBe(true);

    flock.update(t, dt, 15); // resettle
    t += dt;
    expect(flock.state).toBe('perched');
    flock.update(t, dt, 15);

    for (const rigRoot of flock.group.children) {
      const wingL = rigRoot.getObjectByName('wingL');
      const wingR = rigRoot.getObjectByName('wingR');
      expect(Math.abs(wingL!.rotation.z)).toBeLessThan(1e-6);
      expect(Math.abs(wingR!.rotation.z)).toBeLessThan(1e-6);
    }
  });
});
