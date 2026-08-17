import * as THREE from 'three';
import { Rig } from '../scene/rig/Rig';
import { applyClipToRig } from '../scene/rig/Clip';
import { idleClip, calmSwipeClip, enragedSwipeClip } from './elderBearKingClips';
import { EnemyAI, type AiState } from './EnemyAI';
import { computeBossPhase, BOSS_PHASE_PARAMS } from './BossPhaseController';
import { GroundSlam } from '../game/GroundSlam';
import type { Combatant } from '../game/Combat';
import type { Capsule } from '../game/collision';
import { computeStrikeRange } from '../game/EnemyChase';

// Darker, greyed fur vs. the Grove Bear's warmer brown — reads as elder, not a recolor.
const KING_FUR_COLOR = 0x3e3226;
const KING_FUR_DARK = 0x241c12;
const KING_CLAW_COLOR = 0x1a140d;
const KING_EYE_COLOR = 0xffcf6b;
const KING_HP = 220; // matches the old humanoid King exactly — visual redesign, not a rebalance

export interface ElderBearKing {
  group: THREE.Group;
  ai: EnemyAI;
  combatant: Combatant;
  groundSlam: GroundSlam;
  update(time: number, delta: number, distanceToPlayer: number): void;
}

export function createElderBearKing(): ElderBearKing {
  const rig = new Rig([
    'root', 'spine', 'head', 'jaw', 'earL', 'earR',
    'shoulderL', 'shoulderR', 'forepawL', 'forepawR',
    'hipL', 'hipR', 'hindpawL', 'hindpawR',
  ]);
  rig.attach('spine', 'root');
  rig.attach('head', 'spine');
  rig.attach('jaw', 'head');
  rig.attach('earL', 'head');
  rig.attach('earR', 'head');
  for (const side of ['L', 'R'] as const) {
    rig.attach(`shoulder${side}`, 'spine');
    rig.attach(`forepaw${side}`, `shoulder${side}`);
    rig.attach(`hip${side}`, 'spine');
    rig.attach(`hindpaw${side}`, `hip${side}`);
  }

  // Scaled up from the Grove Bear's proportions (spine 0.32 / head 0.05,0.32 / shoulders
  // 0.22,0.14) to read as genuinely larger and elder, not a recolor. Body underside sits at
  // spine.y - radius (0.62 - 0.6 = 0.02, near ground) — legs bridge shoulder/hip height down.
  rig.setLocalPosition('spine', 0, 0.62, 0);
  rig.setLocalPosition('head', 0, 0.1, 0.6);
  rig.setLocalPosition('jaw', 0, -0.15, 0.3);
  rig.setLocalPosition('earL', -0.24, 0.3, -0.04);
  rig.setLocalPosition('earR', 0.24, 0.3, -0.04);
  rig.setLocalPosition('shoulderL', -0.4, -0.06, 0.26);
  rig.setLocalPosition('shoulderR', 0.4, -0.06, 0.26);
  rig.setLocalPosition('forepawL', 0, -0.3, 0);
  rig.setLocalPosition('forepawR', 0, -0.3, 0);
  rig.setLocalPosition('hipL', -0.4, -0.06, -0.34);
  rig.setLocalPosition('hipR', 0.4, -0.06, -0.34);
  rig.setLocalPosition('hindpawL', 0, -0.3, 0);
  rig.setLocalPosition('hindpawR', 0, -0.3, 0);
  rig.captureBasePose();

  const furMat = new THREE.MeshStandardMaterial({ color: KING_FUR_COLOR, flatShading: true, roughness: 0.85 });
  const furDarkMat = new THREE.MeshStandardMaterial({ color: KING_FUR_DARK, flatShading: true, roughness: 0.9 });
  const clawMat = new THREE.MeshStandardMaterial({ color: KING_CLAW_COLOR, flatShading: true, roughness: 0.5 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: KING_EYE_COLOR, emissive: KING_EYE_COLOR, emissiveIntensity: 1.1, flatShading: true });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.6, 0.9, 2, 6), furMat);
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  rig.getJoint('spine').add(body);

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 0), furMat);
  head.scale.set(1, 0.9, 1.05);
  head.castShadow = true;
  rig.getJoint('head').add(head);

  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.21, 0.34, 6), furDarkMat);
  snout.rotation.x = Math.PI / 2;
  rig.getJoint('jaw').add(snout);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), clawMat);
  nose.position.set(0, 0.02, 0.18);
  rig.getJoint('jaw').add(nose);

  const eyeGeo = new THREE.SphereGeometry(0.05, 6, 6);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.18, 0.04, 0.29);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.18;
  rig.getJoint('head').add(eyeL, eyeR);

  const earGeo = new THREE.SphereGeometry(0.12, 6, 6);
  const earL = new THREE.Mesh(earGeo, furDarkMat);
  earL.scale.set(1, 1, 0.6);
  const earR = earL.clone();
  rig.getJoint('earL').add(earL);
  rig.getJoint('earR').add(earR);

  const clawGeo = new THREE.ConeGeometry(0.08, 0.24, 4);
  const clawL = new THREE.Mesh(clawGeo, clawMat);
  clawL.rotation.z = Math.PI / 2;
  rig.getJoint('shoulderL').add(clawL);
  const clawR = new THREE.Mesh(clawGeo, clawMat);
  clawR.rotation.z = -Math.PI / 2;
  rig.getJoint('shoulderR').add(clawR);

  const legGeo = new THREE.CylinderGeometry(0.13, 0.16, 0.6, 6);
  const forepawL = new THREE.Mesh(legGeo, furDarkMat);
  rig.getJoint('forepawL').add(forepawL);
  const forepawR = new THREE.Mesh(legGeo.clone(), furDarkMat);
  rig.getJoint('forepawR').add(forepawR);
  const hindpawL = new THREE.Mesh(legGeo.clone(), furDarkMat);
  rig.getJoint('hindpawL').add(hindpawL);
  const hindpawR = new THREE.Mesh(legGeo.clone(), furDarkMat);
  rig.getJoint('hindpawR').add(hindpawR);

  const ai = new EnemyAI();
  const groundSlam = new GroundSlam();
  const combatant: Combatant = {
    hp: KING_HP,
    maxHp: KING_HP,
    hitbox: { start: new THREE.Vector3(), end: new THREE.Vector3(), radius: 0.75 },
  };

  function syncHitbox() {
    const worldPos = new THREE.Vector3();
    rig.getJoint('spine').getWorldPosition(worldPos);
    combatant.hitbox.start.copy(worldPos);
    combatant.hitbox.end.copy(worldPos).add(new THREE.Vector3(0, 0.85, 0));
  }

  let swipeStartTime = -1;

  function update(time: number, delta: number, distanceToPlayer: number) {
    const prevAiState: AiState = ai.state;
    // Set BEFORE ai.update() runs — see createMountainKing.ts's own fix history (a real bug
    // in the throne-room chapter's final review): reading the phase after ai.update() would
    // lag one frame behind an HP-threshold crossing.
    const phase = computeBossPhase(combatant.hp, combatant.maxHp);
    const params = BOSS_PHASE_PARAMS[phase];
    ai.telegraphSeconds = params.telegraphSeconds;
    ai.strikeRange = computeStrikeRange(combatant.hitbox.radius);
    ai.update(distanceToPlayer, delta);

    const isIdle = ai.state === 'idle' || ai.state === 'aggro';
    if (isIdle) {
      applyClipToRig(rig, idleClip, time);
      swipeStartTime = -1;
    } else {
      if (ai.state === 'telegraph' && prevAiState !== 'telegraph') {
        swipeStartTime = time;
        if (params.groundSlamArmed) groundSlam.arm();
      }
      const swipeClip = phase === 'enraged' ? enragedSwipeClip : calmSwipeClip;
      applyClipToRig(rig, swipeClip, time - swipeStartTime);
    }

    // Gated on the King not being stunned: EnemyAI.stun() (King's Roar) freezes ai.update()'s own
    // state progression, but before this fix nothing stopped an ALREADY-armed ground slam from
    // continuing to telegraph->active on its own timer regardless — the boss's most dangerous move
    // kept landing through a stagger meant to interrupt it. Now the slam's own clock pauses too,
    // and resumes exactly where it left off once the stun wears off.
    if (!ai.isStunned()) groundSlam.update(delta);
    rig.root.updateMatrixWorld(true);
    syncHitbox();
  }

  return { group: rig.root, ai, combatant, groundSlam, update };
}

export function getElderBearKingHitbox(king: ElderBearKing): Capsule {
  return king.combatant.hitbox;
}
