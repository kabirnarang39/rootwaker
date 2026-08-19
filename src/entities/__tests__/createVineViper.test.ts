import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createVineViper, getVineViperHitbox } from '../createVineViper';
import { slitherClip, coilClip, TAIL_CURL_PER_JOINT } from '../vineViperClips';
import { sampleClip } from '../../scene/rig/Clip';

function meshNames(group: THREE.Object3D): Set<string> {
  const names = new Set<string>();
  group.traverse((obj) => {
    if ((obj as { isMesh?: boolean }).isMesh) names.add(obj.name);
  });
  return names;
}

describe('createVineViper', () => {
  it('starts at 26 HP with a 0.22m hitbox radius, idle', () => {
    const viper = createVineViper();
    expect(viper.combatant.hp).toBe(26);
    expect(viper.combatant.maxHp).toBe(26);
    expect(viper.combatant.hitbox.radius).toBeCloseTo(0.22, 5);
    expect(viper.ai.state).toBe('idle');
  });

  it('has every real viper part — a tapering spine->tail0..tail4 body chain, a head, jaw, two fangs, a forked tongue, and two slit eyes (regression 5b812b5: a creature built from bare primitives shipped and read as "a dark shapeless rock")', () => {
    const names = meshNames(createVineViper().group);
    for (const part of [
      'viper-body-spine', 'viper-body-tail0', 'viper-body-tail1', 'viper-body-tail2', 'viper-body-tail3', 'viper-body-tail4',
      'viper-head', 'viper-jaw',
      'viper-fang-l', 'viper-fang-r',
      'viper-tongue-l', 'viper-tongue-r',
      'viper-eye-l', 'viper-eye-r',
      'viper-pit-l', 'viper-pit-r',
    ]) {
      expect(names, `missing anatomy part: ${part}`).toContain(part);
    }
  });

  it('has a real pit-viper heat-sensing pit organ, distinct from the eye — placed forward of it toward the snout, not overlapping', () => {
    const viper = createVineViper();
    const head = viper.rig.getJoint('head');
    const byName = (name: string) => head.children.find((c) => c.name === name)!;
    const eyeL = byName('viper-eye-l');
    const pitL = byName('viper-pit-l');
    expect(pitL.position.z).toBeGreaterThan(eyeL.position.z);
  });

  it('applying the strike clip at t=0 leaves the head on its bind pose, not at the clip\'s raw keyframe value (regression: clips author position keyframes as deltas around zero, so without captureBasePose the first frame would drop the head to [0,0,0] in local space)', () => {
    const viper = createVineViper();
    viper.update(0, 1 / 60, 0.1); // within aggro range and strikeRange -> telegraph, strike clip applied at t=0
    expect(viper.ai.state).toBe('telegraph');
    const head = viper.group.getObjectByName('head');
    expect(head).toBeDefined();
    expect(head!.position.x).toBeCloseTo(0, 5);
    expect(head!.position.y).toBeCloseTo(0.02, 5);
    expect(head!.position.z).toBeCloseTo(0.14, 5);
    const spine = viper.group.getObjectByName('spine');
    expect(spine!.position.y).toBeCloseTo(0.12, 5);
  });

  it('the bind pose survives hundreds of alternating idle/attack frames without cumulative drift', () => {
    const viper = createVineViper();
    for (let i = 0; i < 300; i++) viper.update(i * 0.016, 0.016, i % 60 < 30 ? 0.1 : 8);
    const head = viper.group.getObjectByName('head');
    // Largest authored head position-offset y-component in either clip is 0.03m; anything beyond
    // that is cumulative drift, not an authored keyframe.
    expect(Math.abs(head!.position.y - 0.02)).toBeLessThanOrEqual(0.031);
  });

  it('sets ai.telegraphSeconds and ai.strikeRange from its own hitbox before ai.update() advances the state machine', () => {
    const viper = createVineViper();
    viper.update(0, 1 / 60, 0.1);
    expect(viper.ai.telegraphSeconds).toBeCloseTo(0.32, 5);
    expect(viper.ai.strikeRange).toBeCloseTo(0.22 + 0.4 - 0.05, 5); // computeStrikeRange(0.22)
  });

  it('has a real recovery window after a strike (a real snake re-coils before it can strike again — not a spammable poke)', () => {
    const viper = createVineViper();
    viper.update(0, 1 / 60, 0.1);
    expect(viper.ai.recoverSeconds).toBe(1.0);
  });

  it('a telegraph that completes while the player is still beyond strikeRange never deals damage (real pursuit contract: the viper must actually close the distance, not strike from its perch)', () => {
    const viper = createVineViper();
    const farButAggroed = 3; // inside EnemyAI's aggro range (4), well beyond strikeRange (0.57)
    let damageFrames = 0;
    for (let i = 0; i < 180; i++) {
      viper.update(i * 0.016, 0.016, farButAggroed);
      if (viper.ai.shouldDealDamageThisFrame()) damageFrames++;
    }
    expect(damageFrames).toBe(0);

    // Control: the identical loop at contact distance does land hits, so the assertion above is
    // testing the range gate and not a dead state machine.
    const closeViper = createVineViper();
    let closeDamageFrames = 0;
    for (let i = 0; i < 180; i++) {
      closeViper.update(i * 0.016, 0.016, 0.3);
      if (closeViper.ai.shouldDealDamageThisFrame()) closeDamageFrames++;
    }
    expect(closeDamageFrames).toBeGreaterThan(0);
  });

  it('getVineViperHitbox tracks the spine joint\'s world position after update() and spans 0.25m upward', () => {
    const viper = createVineViper();
    viper.group.position.set(4, 3.2, -2);
    viper.update(0, 1 / 60, 10);
    const hitbox = getVineViperHitbox(viper);
    expect(hitbox.start.x).toBeCloseTo(4, 1);
    expect(hitbox.start.z).toBeCloseTo(-2, 1);
    expect(hitbox.start.y).toBeCloseTo(3.32, 1); // group y + spine bind height (0.12)
    expect(hitbox.end.y - hitbox.start.y).toBeCloseTo(0.25, 5);
  });

  it('the coiled idle pose is a real curled spiral, not a straight tube (regression: coilClip used to pin the whole tail chain to identity, so a resting viper read as a flat segmented rod with a wedge head, not a snake)', () => {
    const t = 0; // the coil pin is a single fixed keyframe, sampled at any time
    const sample = sampleClip(coilClip, t);
    const tailJoints = ['tail0', 'tail1', 'tail2', 'tail3', 'tail4'] as const;
    for (const joint of tailJoints) {
      expect(sample.get(joint)!.rotation![1]).toBeCloseTo(TAIL_CURL_PER_JOINT, 5);
    }
    // A real coil is a smooth, non-zero curl — not just "some rotation," but the SAME repeated
    // local increment down the chain, which is what makes it read as one continuous arc rather
    // than a random kink at one joint.
    expect(TAIL_CURL_PER_JOINT).toBeGreaterThan(0.1);
  });

  it('the slither clip drives a real travelling S-wave: joints down the body chain get different lateral rotations at the same sample time, not a uniform whole-body swing', () => {
    const t = slitherClip.duration * 0.27; // an arbitrary, non-symmetric sample point
    const sample = sampleClip(slitherClip, t);
    const spineYaw = sample.get('spine')!.rotation![1];
    const tail0Yaw = sample.get('tail0')!.rotation![1];
    const tail2Yaw = sample.get('tail2')!.rotation![1];
    const tail4Yaw = sample.get('tail4')!.rotation![1];
    // Every joint must actually differ from its neighbor — a chain that yaws in unison (all four
    // values equal) is not serpentine, it's a rigid plank swinging on one hinge.
    const yaws = [spineYaw, tail0Yaw, tail2Yaw, tail4Yaw];
    for (let i = 0; i < yaws.length; i++) {
      for (let j = i + 1; j < yaws.length; j++) {
        expect(Math.abs(yaws[i] - yaws[j])).toBeGreaterThan(0.01);
      }
    }
  });

  it('tail joints settle back to the real coiled resting pose (not a stale mid-slither kink) after a full slither -> strike -> recover -> idle cycle (regression: slitherClip loops and gets cut off mid-wave at an arbitrary phase; neither coilClip nor strikeClip used to touch tail0..tail4 at all, so the lower body stayed kinked forever after the viper\'s first fight)', () => {
    const viper = createVineViper();
    const tailJoints = ['tail0', 'tail1', 'tail2', 'tail3', 'tail4'] as const;
    let t = 0;
    const dt = 0.016;

    // Phase 1: aggroed but well outside strike range -> telegraph, slithering. Run long enough for
    // the S-wave to move visibly off zero, then cut it off mid-cycle (not at a loop boundary).
    for (let i = 0; i < 15; i++) {
      viper.update(t, dt, 2.0);
      t += dt;
    }
    expect(viper.ai.state).toBe('telegraph');
    // Sanity: prove the slither actually moved a tail joint before the cutover — otherwise this
    // test would pass even without the fix.
    expect(tailJoints.some((j) => Math.abs(viper.group.getObjectByName(j)!.rotation.y) > 0.01)).toBe(true);

    // Phase 2: close the distance until a real strike actually lands and recovers (state-driven,
    // not a fixed frame count, so this doesn't depend on exact timing assumptions).
    let guard = 0;
    while (viper.ai.state !== 'attacking' && guard++ < 300) {
      viper.update(t, dt, 0.3);
      t += dt;
    }
    expect(viper.ai.state).toBe('attacking');
    guard = 0;
    while (viper.ai.state !== 'recovering' && guard++ < 300) {
      viper.update(t, dt, 0.3);
      t += dt;
    }
    expect(viper.ai.state).toBe('recovering');

    // Phase 3: player is far away for the rest of recovery -> lands cleanly back on 'idle'.
    guard = 0;
    while (viper.ai.state !== 'idle' && guard++ < 300) {
      viper.update(t, dt, 100);
      t += dt;
    }
    expect(viper.ai.state).toBe('idle');

    for (const joint of tailJoints) {
      expect(viper.group.getObjectByName(joint)!.rotation.y).toBeCloseTo(TAIL_CURL_PER_JOINT, 5);
    }
  });
});
