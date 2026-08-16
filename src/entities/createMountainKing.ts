import * as THREE from 'three';
import { Rig } from '../scene/rig/Rig';
import { applyClipToRig } from '../scene/rig/Clip';
import { idleClip, calmStrikeClip, enragedStrikeClip } from './mountainKingClips';
import { EnemyAI, type AiState } from './EnemyAI';
import { computeBossPhase, BOSS_PHASE_PARAMS } from './BossPhaseController';
import { GroundSlam } from '../game/GroundSlam';
import type { Combatant } from '../game/Combat';
import type { Capsule } from '../game/collision';

// Same stone/trim material family as mountainGuard.ts so the King visually reads as the
// guards' ruler, not an unrelated creature — but a distinct, deeper stone tone and a real
// crown silhouette mark him as the boss, not another guard.
const KING_STONE_COLOR = 0x3a3532;
const KING_TRIM_COLOR = 0xc9973a; // richer gold than the guards' bronze trim — a king's color
const KING_HP = 220; // ~3.4x mountainGuard's 65 — a real boss-length fight

export interface MountainKing {
  group: THREE.Group;
  ai: EnemyAI;
  combatant: Combatant;
  groundSlam: GroundSlam;
  update(time: number, delta: number, distanceToPlayer: number): void;
}

export function createMountainKing(): MountainKing {
  const rig = new Rig(['root', 'spine', 'head', 'shoulderL', 'shoulderR']);
  rig.attach('spine', 'root');
  rig.attach('head', 'spine');
  rig.attach('shoulderL', 'spine');
  rig.attach('shoulderR', 'spine');

  // Scaled up from mountainGuard's proportions (spine 0.4 / head 0.15,0.35 / shoulders 0.28,0.1)
  // to read as genuinely larger, not just a recolor.
  rig.setLocalPosition('spine', 0, 0.7, 0);
  rig.setLocalPosition('head', 0, 0.26, 0.55);
  rig.setLocalPosition('shoulderL', -0.45, 0, 0.16);
  rig.setLocalPosition('shoulderR', 0.45, 0, 0.16);
  rig.captureBasePose();

  const stoneMat = new THREE.MeshStandardMaterial({ color: KING_STONE_COLOR, flatShading: true, roughness: 0.9 });
  const trimMat = new THREE.MeshStandardMaterial({ color: KING_TRIM_COLOR, flatShading: true, roughness: 0.45, metalness: 0.5 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 1.15), stoneMat);
  body.castShadow = true;
  rig.getJoint('spine').add(body);

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.36, 0), stoneMat);
  head.castShadow = true;
  rig.getJoint('head').add(head);

  // Crown: a ring of small cones on top of the head — the one silhouette detail that reads
  // as "king" at a glance, distinct from every guard's bare head.
  const crownSpikeGeo = new THREE.ConeGeometry(0.05, 0.16, 4);
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const spike = new THREE.Mesh(crownSpikeGeo, trimMat);
    spike.position.set(Math.cos(angle) * 0.22, 0.34, Math.sin(angle) * 0.22);
    rig.getJoint('head').add(spike);
  }

  const trimGeo = new THREE.ConeGeometry(0.1, 0.32, 4);
  const trimL = new THREE.Mesh(trimGeo, trimMat);
  trimL.rotation.z = Math.PI / 2;
  rig.getJoint('shoulderL').add(trimL);
  const trimR = new THREE.Mesh(trimGeo, trimMat);
  trimR.rotation.z = -Math.PI / 2;
  rig.getJoint('shoulderR').add(trimR);

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

  let strikeStartTime = -1;

  function update(time: number, delta: number, distanceToPlayer: number) {
    // Captured fresh each call, before ai.update() runs — not stored across calls like
    // mountainGuard's prevAiState — so a same-frame idle->telegraph transition is detected
    // correctly even if something external nudged ai.state between frames (see
    // createMountainKing.test.ts's "re-enter telegraph fresh" case). In steady, uninterrupted
    // gameplay ai.state only ever changes inside ai.update(), so this is behaviorally identical
    // to mountainGuard's cross-call prevAiState.
    const prevAiState: AiState = ai.state;
    // Set BEFORE ai.update() runs, so this frame's telegraph-duration check already reads the
    // current phase — without this, EnemyAI.telegraphSeconds would always lag one frame behind
    // an HP-threshold crossing, and the enraged phase's shorter reaction window (the actual
    // mechanical escalation, not just higher damage) would never take effect.
    const phase = computeBossPhase(combatant.hp, combatant.maxHp);
    const params = BOSS_PHASE_PARAMS[phase];
    ai.telegraphSeconds = params.telegraphSeconds;
    ai.update(distanceToPlayer, delta);

    const isIdle = ai.state === 'idle' || ai.state === 'aggro';
    if (isIdle) {
      applyClipToRig(rig, idleClip, time);
      strikeStartTime = -1;
    } else {
      if (ai.state === 'telegraph' && prevAiState !== 'telegraph') {
        strikeStartTime = time;
        if (params.groundSlamArmed) groundSlam.arm();
      }
      const strikeClip = phase === 'enraged' ? enragedStrikeClip : calmStrikeClip;
      applyClipToRig(rig, strikeClip, time - strikeStartTime);
    }

    groundSlam.update(delta);
    rig.root.updateMatrixWorld(true);
    syncHitbox();
  }

  return { group: rig.root, ai, combatant, groundSlam, update };
}

export function getKingHitbox(king: MountainKing): Capsule {
  return king.combatant.hitbox;
}
