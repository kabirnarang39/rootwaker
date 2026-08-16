import * as THREE from 'three';
import { Rig } from '../scene/rig/Rig';
import { applyClipToRig } from '../scene/rig/Clip';
import { idleClip, calmSwipeClip, enragedSwipeClip } from './elderBearKingClips';
import { EnemyAI, type AiState } from './EnemyAI';
import { computeBossPhase, BOSS_PHASE_PARAMS } from './BossPhaseController';
import { GroundSlam } from '../game/GroundSlam';
import type { Combatant } from '../game/Combat';
import type { Capsule } from '../game/collision';

// Darker, greyed fur vs. the Grove Bear's warmer brown — reads as elder, not a recolor.
const KING_FUR_COLOR = 0x2e241a;
const KING_CLAW_COLOR = 0x1a140d;
const KING_HP = 220; // matches the old humanoid King exactly — visual redesign, not a rebalance

export interface ElderBearKing {
  group: THREE.Group;
  ai: EnemyAI;
  combatant: Combatant;
  groundSlam: GroundSlam;
  update(time: number, delta: number, distanceToPlayer: number): void;
}

export function createElderBearKing(): ElderBearKing {
  const rig = new Rig(['root', 'spine', 'head', 'shoulderL', 'shoulderR']);
  rig.attach('spine', 'root');
  rig.attach('head', 'spine');
  rig.attach('shoulderL', 'spine');
  rig.attach('shoulderR', 'spine');

  // Scaled up from the Grove Bear's proportions (spine 0.32 / head 0.05,0.32 / shoulders
  // 0.22,0.14) to read as genuinely larger and elder, not a recolor.
  rig.setLocalPosition('spine', 0, 0.62, 0);
  rig.setLocalPosition('head', 0, 0.1, 0.6);
  rig.setLocalPosition('shoulderL', -0.42, -0.04, 0.26);
  rig.setLocalPosition('shoulderR', 0.42, -0.04, 0.26);
  rig.captureBasePose();

  const furMat = new THREE.MeshStandardMaterial({ color: KING_FUR_COLOR, flatShading: true, roughness: 0.95 });
  const clawMat = new THREE.MeshStandardMaterial({ color: KING_CLAW_COLOR, flatShading: true, roughness: 0.5 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.6, 0.9, 2, 6), furMat);
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  rig.getJoint('spine').add(body);

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 0), furMat);
  head.castShadow = true;
  rig.getJoint('head').add(head);

  const clawGeo = new THREE.ConeGeometry(0.08, 0.24, 4);
  const clawL = new THREE.Mesh(clawGeo, clawMat);
  clawL.rotation.z = Math.PI / 2;
  rig.getJoint('shoulderL').add(clawL);
  const clawR = new THREE.Mesh(clawGeo, clawMat);
  clawR.rotation.z = -Math.PI / 2;
  rig.getJoint('shoulderR').add(clawR);

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

    groundSlam.update(delta);
    rig.root.updateMatrixWorld(true);
    syncHitbox();
  }

  return { group: rig.root, ai, combatant, groundSlam, update };
}

export function getElderBearKingHitbox(king: ElderBearKing): Capsule {
  return king.combatant.hitbox;
}
