import * as THREE from 'three';
import { Rig } from '../scene/rig/Rig';
import { applyClipToRig } from '../scene/rig/Clip';
import { cruiseClip, lungeClip } from './sharkClips';
import { EnemyAI, type AiState } from './EnemyAI';
import type { Combatant } from '../game/Combat';
import type { Capsule } from '../game/collision';
import { computeStrikeRange } from '../game/EnemyChase';

const SHARK_COLOR = 0x5a6a72;
const SHARK_BELLY = 0xc9d4d8;
const TOOTH_COLOR = 0xe8e0d0;
const EYE_COLOR = 0x8fd8ff;

export interface Shark {
  group: THREE.Group;
  rig: Rig;
  ai: EnemyAI;
  combatant: Combatant;
  update(time: number, delta: number, distanceToPlayer: number): void;
}

/** A real reef-shark-scale ambush predator for the living sea — the first fightable species
 * that never touches the ground at all. Real torpedo body (no legs, no ground contact whatsoever
 * — reuses only spine/head/jaw/tail joints plus wingL/wingR for the pectoral fins, the same
 * "pivoting lateral appendage" role a wing plays, rather than adding new joint names for what's
 * anatomically a close parallel), a triangular dorsal fin (static decoration on the spine, same
 * "doesn't need independent animation" treatment the crocodile's back ridges got), and real
 * predatory behavior distinct from every land species: a shark is almost never fully still (see
 * cruiseClip's own doc comment) and its attack is a fast committed RAM building from an
 * already-moving cruise, not a strike from stillness. */
export function createShark(): Shark {
  const rig = new Rig(['root', 'spine', 'head', 'jaw', 'wingL', 'wingR', 'tail0', 'tail1', 'tail2']);
  rig.attach('spine', 'root');
  rig.attach('head', 'spine');
  rig.attach('jaw', 'head');
  rig.attach('wingL', 'spine');
  rig.attach('wingR', 'spine');
  rig.attach('tail0', 'root');
  rig.attach('tail1', 'tail0');
  rig.attach('tail2', 'tail1');

  rig.setLocalPosition('spine', 0, 0, 0);
  rig.setLocalPosition('head', 0, 0.02, 0.45);
  rig.setLocalPosition('jaw', 0, -0.08, 0.18);
  rig.setLocalPosition('wingL', -0.2, -0.05, 0.05);
  rig.setLocalPosition('wingR', 0.2, -0.05, 0.05);
  rig.setLocalPosition('tail0', 0, 0, -0.45);
  rig.setLocalPosition('tail1', 0, 0, -0.32);
  rig.setLocalPosition('tail2', 0, 0, -0.24);
  rig.captureBasePose();
  // Real-world scale: a reef shark reads as a real, meaningfully large predator — comparable
  // presence to the lion (1.5x)/bear (1.6x) tier, not a fish-sized nuisance.
  rig.root.scale.setScalar(1.5);

  const bodyMat = new THREE.MeshStandardMaterial({ color: SHARK_COLOR, flatShading: true, roughness: 0.55, metalness: 0.15 });
  const bellyMat = new THREE.MeshStandardMaterial({ color: SHARK_BELLY, flatShading: true, roughness: 0.5 });
  const toothMat = new THREE.MeshStandardMaterial({ color: TOOTH_COLOR, flatShading: true, roughness: 0.35 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: EYE_COLOR, emissive: EYE_COLOR, emissiveIntensity: 0.85, flatShading: true });

  // Real torpedo body: long capsule tapering isn't possible with one CapsuleGeometry (uniform
  // radius), so a real taper comes from two overlapping capsules of different radii — a thicker
  // fore-body and a slimmer aft-body, the same "shape via composition, not a single stretched
  // primitive" technique the crocodile's own long-low body already established.
  const foreBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.5, 2, 8), bodyMat);
  foreBody.name = 'shark-body-fore';
  foreBody.rotation.z = Math.PI / 2;
  foreBody.position.z = 0.1;
  foreBody.castShadow = true;
  rig.getJoint('spine').add(foreBody);

  const aftBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.4, 2, 8), bodyMat);
  aftBody.name = 'shark-body-aft';
  aftBody.rotation.z = Math.PI / 2;
  aftBody.position.z = -0.35;
  aftBody.castShadow = true;
  rig.getJoint('spine').add(aftBody);

  const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.55, 2, 8), bellyMat);
  belly.name = 'shark-belly';
  belly.rotation.z = Math.PI / 2;
  belly.position.set(0, -0.14, 0.05);
  rig.getJoint('spine').add(belly);

  // The single most identifying real trait — a triangular dorsal fin — static decoration
  // directly on spine, same treatment the crocodile's own back ridges got (doesn't need
  // independent animation, just needs to be visually present and sway with the body).
  const dorsalFin = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.28, 3), bodyMat);
  dorsalFin.name = 'shark-dorsal-fin';
  dorsalFin.rotation.x = Math.PI;
  dorsalFin.rotation.y = Math.PI / 2;
  dorsalFin.position.set(0, 0.24, 0.05);
  rig.getJoint('spine').add(dorsalFin);

  const head = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 6), bodyMat);
  head.name = 'shark-head';
  head.rotation.x = -Math.PI / 2;
  head.castShadow = true;
  rig.getJoint('head').add(head);

  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.2), bellyMat);
  jaw.name = 'shark-jaw';
  jaw.position.set(0, -0.09, 0.05);
  rig.getJoint('jaw').add(jaw);

  const toothGeo = new THREE.ConeGeometry(0.014, 0.05, 4);
  for (const [name, x, z] of [
    ['tooth-l1', -0.05, 0.1] as const,
    ['tooth-r1', 0.05, 0.1] as const,
    ['tooth-l2', -0.055, -0.02] as const,
    ['tooth-r2', 0.055, -0.02] as const,
  ]) {
    const tooth = new THREE.Mesh(toothGeo, toothMat);
    tooth.name = `shark-${name}`;
    tooth.rotation.x = Math.PI;
    tooth.position.set(x, 0.03, z);
    rig.getJoint('jaw').add(tooth);
  }

  const eyeGeo = new THREE.SphereGeometry(0.024, 6, 6);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.name = 'shark-eye-l';
  eyeL.position.set(-0.09, 0.03, 0.28);
  rig.getJoint('head').add(eyeL);
  const eyeR = eyeL.clone();
  eyeR.name = 'shark-eye-r';
  eyeR.position.x = 0.09;
  rig.getJoint('head').add(eyeR);

  // Pectoral fins: flattened wide cones, angled down/outward like a real shark's stiff lift
  // fins, on the same wingL/wingR joints the canopy owl uses for its own wings.
  const pectoralGeo = new THREE.ConeGeometry(0.09, 0.32, 4);
  const finL = new THREE.Mesh(pectoralGeo, bodyMat);
  finL.name = 'shark-fin-l';
  finL.scale.set(1, 0.35, 1);
  finL.rotation.z = Math.PI / 2 + 0.3;
  rig.getJoint('wingL').add(finL);
  const finR = new THREE.Mesh(pectoralGeo, bodyMat);
  finR.name = 'shark-fin-r';
  finR.scale.set(1, 0.35, 1);
  finR.rotation.z = -Math.PI / 2 - 0.3;
  rig.getJoint('wingR').add(finR);

  const tailSegGeo0 = new THREE.CapsuleGeometry(0.1, 0.24, 2, 6);
  const tail0Mesh = new THREE.Mesh(tailSegGeo0, bodyMat);
  tail0Mesh.name = 'shark-tail0';
  tail0Mesh.rotation.x = Math.PI / 2;
  rig.getJoint('tail0').add(tail0Mesh);
  const tailSegGeo1 = new THREE.CapsuleGeometry(0.07, 0.2, 2, 6);
  const tail1Mesh = new THREE.Mesh(tailSegGeo1, bodyMat);
  tail1Mesh.name = 'shark-tail1';
  tail1Mesh.rotation.x = Math.PI / 2;
  rig.getJoint('tail1').add(tail1Mesh);
  // The real caudal (tail) fin — a tall triangular blade, the actual thrust surface.
  const caudalFin = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.32, 3), bodyMat);
  caudalFin.name = 'shark-caudal-fin';
  caudalFin.rotation.z = Math.PI / 2;
  caudalFin.rotation.y = Math.PI / 2;
  caudalFin.position.set(0, 0.04, -0.14);
  rig.getJoint('tail2').add(caudalFin);

  const ai = new EnemyAI();
  const combatant: Combatant = {
    hp: 70,
    maxHp: 70,
    hitbox: { start: new THREE.Vector3(), end: new THREE.Vector3(), radius: 0.5 },
  };

  function syncHitbox() {
    const worldPos = new THREE.Vector3();
    rig.getJoint('spine').getWorldPosition(worldPos);
    combatant.hitbox.start.copy(worldPos);
    combatant.hitbox.end.copy(worldPos).add(new THREE.Vector3(0, 0.3, 0));
  }

  let lungeStartTime = -1;
  let prevAiState: AiState = 'idle';

  function update(time: number, delta: number, distanceToPlayer: number) {
    ai.strikeRange = computeStrikeRange(combatant.hitbox.radius);
    // A real shark's own rhythm: fast to recommit to another pass after a ram — real reef sharks
    // circle back quickly, they don't retreat and wait like a crocodile.
    ai.recoverSeconds = 0.6;
    ai.update(distanceToPlayer, delta);
    const isIdle = ai.state === 'idle' || ai.state === 'aggro';
    if (isIdle) {
      applyClipToRig(rig, cruiseClip, time);
      lungeStartTime = -1;
    } else {
      if (ai.state === 'telegraph' && prevAiState !== 'telegraph') {
        lungeStartTime = time;
      }
      applyClipToRig(rig, lungeClip, time - lungeStartTime);
    }
    prevAiState = ai.state;
    rig.root.updateMatrixWorld(true);
    syncHitbox();
  }

  return { group: rig.root, rig, ai, combatant, update };
}

export function getSharkHitbox(shark: Shark): Capsule {
  return shark.combatant.hitbox;
}
