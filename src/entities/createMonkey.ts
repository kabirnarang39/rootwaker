import * as THREE from 'three';
import { Rig } from '../scene/rig/Rig';
import { applyClipToRig } from '../scene/rig/Clip';
import { idleClip, dartClip } from './monkeyClips';
import { EnemyAI, type AiState } from './EnemyAI';
import type { Combatant } from '../game/Combat';
import type { Capsule } from '../game/collision';
import { computeStrikeRange } from '../game/EnemyChase';

const MONKEY_COLOR = 0x6b4a32;
const MONKEY_DARK = 0x3a2818;
const MONKEY_FACE = 0xd9b896; // real bare, pale primate face skin, distinct from every fur-covered species
const EYE_COLOR = 0x8a5a2a;

export interface Monkey {
  group: THREE.Group;
  rig: Rig;
  ai: EnemyAI;
  combatant: Combatant;
  update(time: number, delta: number, distanceToPlayer: number): void;
}

/** Real jungle macaque-type monkey — deliberately built on real primate anatomy research, NOT
 * the "swings arm-over-arm through the canopy" trope: real macaques have near-equal-length
 * fore/hindlimbs (intermembral index ~90, unlike a longer-armed brachiating ape) and are
 * predominantly quadrupedal walkers/climbers, so this reuses the same quadruped joint layout
 * every ground species already shares (shoulderL/R, forepawL/R, hipL/R, hindpawL/R) rather than
 * a bipedal or hanging rig. The one deliberate anatomical inversion from every predator built
 * this session: monkeys scale DOWN, not up — a real, meaningfully SMALLER, quicker animal, not
 * another apex-predator-scale threat. A flatter, bare-faced head (no snout) is the other real
 * distinguishing primate trait against every other species in the game. */
export function createMonkey(): Monkey {
  const rig = new Rig([
    'root', 'spine', 'head', 'jaw', 'earL', 'earR',
    'shoulderL', 'shoulderR', 'forepawL', 'forepawR',
    'hipL', 'hipR', 'hindpawL', 'hindpawR',
    'tail0', 'tail1',
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
  rig.attach('tail0', 'root');
  rig.attach('tail1', 'tail0');

  // Real macaque proportions: fore/hindlimbs near-equal length (unlike the boar's own
  // shorter-forelimb stance), a real medium (non-prehensile, balance-only) tail.
  rig.setLocalPosition('spine', 0, 0.16, 0);
  rig.setLocalPosition('head', 0, 0.1, 0.16);
  rig.setLocalPosition('jaw', 0, -0.04, 0.08);
  rig.setLocalPosition('earL', -0.07, 0.09, -0.01);
  rig.setLocalPosition('earR', 0.07, 0.09, -0.01);
  rig.setLocalPosition('shoulderL', -0.1, -0.02, 0.1);
  rig.setLocalPosition('shoulderR', 0.1, -0.02, 0.1);
  rig.setLocalPosition('forepawL', 0, -0.14, 0);
  rig.setLocalPosition('forepawR', 0, -0.14, 0);
  rig.setLocalPosition('hipL', -0.1, -0.02, -0.11);
  rig.setLocalPosition('hipR', 0.1, -0.02, -0.11);
  rig.setLocalPosition('hindpawL', 0, -0.14, 0);
  rig.setLocalPosition('hindpawR', 0, -0.14, 0);
  rig.setLocalPosition('tail0', 0, 0.06, -0.15);
  rig.setLocalPosition('tail1', 0, 0.02, -0.16);
  rig.captureBasePose();
  // Real-world scale: deliberately SMALLER than the fox-sized player (0.75x) — every other
  // species this session scaled up for apex-predator presence; a real jungle monkey is a real,
  // meaningfully smaller/quicker animal, and reads correctly at a genuinely reduced scale.
  rig.root.scale.setScalar(0.75);

  const furMat = new THREE.MeshStandardMaterial({ color: MONKEY_COLOR, flatShading: true, roughness: 0.85 });
  const darkMat = new THREE.MeshStandardMaterial({ color: MONKEY_DARK, flatShading: true, roughness: 0.8 });
  const faceMat = new THREE.MeshStandardMaterial({ color: MONKEY_FACE, flatShading: true, roughness: 0.6 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: EYE_COLOR, emissive: EYE_COLOR, emissiveIntensity: 0.7, flatShading: true });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.22, 2, 6), furMat);
  body.name = 'monkey-body';
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  rig.getJoint('spine').add(body);

  // Real bare, flat primate face — no protruding snout, the single biggest anatomical
  // departure from every other jungle mammal already in the game.
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), furMat);
  head.name = 'monkey-head';
  head.scale.set(1, 1, 0.9);
  head.castShadow = true;
  rig.getJoint('head').add(head);

  const face = new THREE.Mesh(new THREE.CircleGeometry(0.055, 8), faceMat);
  face.name = 'monkey-face';
  face.position.set(0, -0.01, 0.09);
  rig.getJoint('head').add(face);

  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.035, 0.05), faceMat);
  jaw.name = 'monkey-jaw';
  jaw.position.set(0, -0.05, 0.05);
  rig.getJoint('jaw').add(jaw);

  const eyeGeo = new THREE.SphereGeometry(0.015, 6, 6);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.name = 'monkey-eye-l';
  eyeL.position.set(-0.03, 0.02, 0.09);
  rig.getJoint('head').add(eyeL);
  const eyeR = eyeL.clone();
  eyeR.name = 'monkey-eye-r';
  eyeR.position.x = 0.03;
  rig.getJoint('head').add(eyeR);

  const earGeo = new THREE.CircleGeometry(0.035, 8);
  const earL = new THREE.Mesh(earGeo, darkMat);
  earL.name = 'monkey-ear-l';
  earL.rotation.y = Math.PI / 2;
  rig.getJoint('earL').add(earL);
  const earR = earL.clone();
  earR.name = 'monkey-ear-r';
  rig.getJoint('earR').add(earR);

  const legGeo = new THREE.CylinderGeometry(0.028, 0.034, 0.16, 6);
  const forepawL = new THREE.Mesh(legGeo, darkMat);
  forepawL.name = 'monkey-forepaw-l';
  rig.getJoint('forepawL').add(forepawL);
  const forepawR = new THREE.Mesh(legGeo.clone(), darkMat);
  forepawR.name = 'monkey-forepaw-r';
  rig.getJoint('forepawR').add(forepawR);
  const hindpawL = new THREE.Mesh(legGeo.clone(), darkMat);
  hindpawL.name = 'monkey-hindpaw-l';
  rig.getJoint('hindpawL').add(hindpawL);
  const hindpawR = new THREE.Mesh(legGeo.clone(), darkMat);
  hindpawR.name = 'monkey-hindpaw-r';
  rig.getJoint('hindpawR').add(hindpawR);

  // A real medium-length balance tail (non-prehensile, per real macaque anatomy — see this
  // file's own doc comment), not the exaggerated whip-tail a New World monkey would have.
  const tail0Mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.026, 0.18, 5), furMat);
  tail0Mesh.name = 'monkey-tail0';
  tail0Mesh.rotation.x = 0.3;
  tail0Mesh.position.y = 0.06;
  rig.getJoint('tail0').add(tail0Mesh);
  const tail1Mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.02, 0.16, 5), furMat);
  tail1Mesh.name = 'monkey-tail1';
  tail1Mesh.rotation.x = 0.15;
  tail1Mesh.position.y = 0.1;
  rig.getJoint('tail1').add(tail1Mesh);

  const ai = new EnemyAI();
  const combatant: Combatant = {
    // Real, deliberate vulnerability: the smallest, lowest-HP huntable species in the game,
    // matching its real smaller/lighter build — a genuinely different risk profile from every
    // apex-predator-scale kill this session, not a reskinned stat block.
    hp: 35,
    maxHp: 35,
    hitbox: { start: new THREE.Vector3(), end: new THREE.Vector3(), radius: 0.32 }, // 0.4 * 0.75... scaled with the real-size reduction above (0.42 * 0.75 ≈ 0.32)
  };

  function syncHitbox() {
    const worldPos = new THREE.Vector3();
    rig.getJoint('spine').getWorldPosition(worldPos);
    combatant.hitbox.start.copy(worldPos);
    combatant.hitbox.end.copy(worldPos).add(new THREE.Vector3(0, 0.25, 0));
  }

  let dartStartTime = -1;
  let prevAiState: AiState = 'idle';

  function update(time: number, delta: number, distanceToPlayer: number) {
    ai.strikeRange = computeStrikeRange(combatant.hitbox.radius);
    // Real quick recovery — matches monkeyClips.ts's own TELEGRAPH_PLUS_DART comment: this
    // project's fastest telegraph+recovery cycle, a genuinely different combat rhythm from every
    // larger species' slower committed strikes.
    ai.telegraphSeconds = 0.2;
    ai.recoverSeconds = 0.35;
    ai.update(distanceToPlayer, delta);
    const isIdle = ai.state === 'idle' || ai.state === 'aggro';
    if (isIdle) {
      applyClipToRig(rig, idleClip, time);
      dartStartTime = -1;
    } else {
      if (ai.state === 'telegraph' && prevAiState !== 'telegraph') {
        dartStartTime = time;
      }
      applyClipToRig(rig, dartClip, time - dartStartTime);
    }
    prevAiState = ai.state;
    rig.root.updateMatrixWorld(true);
    syncHitbox();
  }

  return { group: rig.root, rig, ai, combatant, update };
}

export function getMonkeyHitbox(monkey: Monkey): Capsule {
  return monkey.combatant.hitbox;
}
