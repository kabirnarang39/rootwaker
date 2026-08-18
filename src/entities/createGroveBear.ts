import * as THREE from 'three';
import { Rig } from '../scene/rig/Rig';
import { applyClipToRig } from '../scene/rig/Clip';
import { idleClip, clawSwipeClip } from './groveBearClips';
import { EnemyAI, type AiState } from './EnemyAI';
import type { Combatant } from '../game/Combat';
import type { Capsule } from '../game/collision';
import { computeStrikeRange } from '../game/EnemyChase';

const BEAR_FUR_COLOR = 0x5a4530;
const BEAR_FUR_DARK = 0x3a2c1c;
const BEAR_CLAW_COLOR = 0x2a2015;
const BEAR_EYE_COLOR = 0xffb84d; // amber eye-shine — real nocturnal animal eyes reflect light

export interface GroveBear {
  group: THREE.Group;
  ai: EnemyAI;
  combatant: Combatant;
  update(time: number, delta: number, distanceToPlayer: number): void;
}

export function createGroveBear(): GroveBear {
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

  // Low-slung, heavier-bodied proportions than tuskBoar's — a real bear reads bulkier and
  // lower to the ground than a boar, not just a recolor. Body capsule sits with its underside
  // at spine.y - radius (0.32 - 0.32 = 0, i.e. right at ground) — legs bridge shoulder/hip
  // height (spine.y - 0.02 = 0.30) down to the ground, closing the "floating body" gap.
  rig.setLocalPosition('spine', 0, 0.32, 0);
  rig.setLocalPosition('head', 0, 0.05, 0.32);
  rig.setLocalPosition('jaw', 0, -0.08, 0.16);
  rig.setLocalPosition('earL', -0.13, 0.16, -0.02);
  rig.setLocalPosition('earR', 0.13, 0.16, -0.02);
  rig.setLocalPosition('shoulderL', -0.2, -0.02, 0.14);
  rig.setLocalPosition('shoulderR', 0.2, -0.02, 0.14);
  rig.setLocalPosition('forepawL', 0, -0.16, 0);
  rig.setLocalPosition('forepawR', 0, -0.16, 0);
  rig.setLocalPosition('hipL', -0.2, -0.02, -0.18);
  rig.setLocalPosition('hipR', 0.2, -0.02, -0.18);
  rig.setLocalPosition('hindpawL', 0, -0.16, 0);
  rig.setLocalPosition('hindpawR', 0, -0.16, 0);
  rig.captureBasePose();
  // Real-world scale: a real bear reads meaningfully bigger than the fox-sized player, not
  // nearly identical (the un-scaled body capsule was only ~7% bigger than the fox's own). A
  // uniform scale from the root — which already sits at ground level — keeps every joint's
  // ground contact correct; only the King (Elder Bear King) stays visually the largest creature.
  rig.root.scale.setScalar(1.6);

  const furMat = new THREE.MeshStandardMaterial({ color: BEAR_FUR_COLOR, flatShading: true, roughness: 0.85 });
  const furDarkMat = new THREE.MeshStandardMaterial({ color: BEAR_FUR_DARK, flatShading: true, roughness: 0.9 });
  const clawMat = new THREE.MeshStandardMaterial({ color: BEAR_CLAW_COLOR, flatShading: true, roughness: 0.5 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: BEAR_EYE_COLOR, emissive: BEAR_EYE_COLOR, emissiveIntensity: 0.9, flatShading: true });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.5, 2, 6), furMat);
  body.name = 'bear-body';
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  rig.getJoint('spine').add(body);

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), furMat);
  head.name = 'bear-head';
  head.scale.set(1, 0.9, 1.05);
  head.castShadow = true;
  rig.getJoint('head').add(head);

  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.2, 6), furDarkMat);
  snout.name = 'bear-snout';
  snout.rotation.x = Math.PI / 2;
  rig.getJoint('jaw').add(snout);

  const noseGeo = new THREE.SphereGeometry(0.035, 6, 6);
  const nose = new THREE.Mesh(noseGeo, clawMat);
  nose.name = 'bear-nose';
  nose.position.set(0, 0.01, 0.1);
  rig.getJoint('jaw').add(nose);

  const eyeGeo = new THREE.SphereGeometry(0.028, 6, 6);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.name = 'bear-eye-l';
  eyeL.position.set(-0.1, 0.02, 0.16);
  const eyeR = eyeL.clone();
  eyeR.name = 'bear-eye-r';
  eyeR.position.x = 0.1;
  rig.getJoint('head').add(eyeL, eyeR);

  const earGeo = new THREE.SphereGeometry(0.07, 6, 6);
  const earL = new THREE.Mesh(earGeo, furDarkMat);
  earL.name = 'bear-ear-l';
  earL.scale.set(1, 1, 0.6);
  const earR = earL.clone();
  earR.name = 'bear-ear-r';
  rig.getJoint('earL').add(earL);
  rig.getJoint('earR').add(earR);

  const clawGeo = new THREE.ConeGeometry(0.04, 0.12, 4);
  const clawL = new THREE.Mesh(clawGeo, clawMat);
  clawL.name = 'bear-claw-l';
  clawL.rotation.z = Math.PI / 2;
  rig.getJoint('shoulderL').add(clawL);
  const clawR = new THREE.Mesh(clawGeo, clawMat);
  clawR.name = 'bear-claw-r';
  clawR.rotation.z = -Math.PI / 2;
  rig.getJoint('shoulderR').add(clawR);

  const legGeo = new THREE.CylinderGeometry(0.06, 0.075, 0.32, 6);
  const forepawL = new THREE.Mesh(legGeo, furDarkMat);
  forepawL.name = 'bear-forepaw-l';
  rig.getJoint('forepawL').add(forepawL);
  const forepawR = new THREE.Mesh(legGeo.clone(), furDarkMat);
  forepawR.name = 'bear-forepaw-r';
  rig.getJoint('forepawR').add(forepawR);
  const hindpawL = new THREE.Mesh(legGeo.clone(), furDarkMat);
  hindpawL.name = 'bear-hindpaw-l';
  rig.getJoint('hindpawL').add(hindpawL);
  const hindpawR = new THREE.Mesh(legGeo.clone(), furDarkMat);
  hindpawR.name = 'bear-hindpaw-r';
  rig.getJoint('hindpawR').add(hindpawR);

  const ai = new EnemyAI();
  const combatant: Combatant = {
    hp: 90, // bumped with the real-size scale-up above — a visibly bigger bear should take a real fight to fell
    maxHp: 90,
    hitbox: { start: new THREE.Vector3(), end: new THREE.Vector3(), radius: 0.72 }, // scaled with the real-size bump above (0.45 * 1.6)
  };

  function syncHitbox() {
    const worldPos = new THREE.Vector3();
    rig.getJoint('spine').getWorldPosition(worldPos);
    combatant.hitbox.start.copy(worldPos);
    combatant.hitbox.end.copy(worldPos).add(new THREE.Vector3(0, 0.5, 0));
  }

  let swipeStartTime = -1;
  let prevAiState: AiState = 'idle';

  function update(time: number, delta: number, distanceToPlayer: number) {
    ai.strikeRange = computeStrikeRange(combatant.hitbox.radius);
    // A real bear's own combat rhythm: heavy and deliberate, can't spam swipes the way a boar
    // charges again — a long, real recovery window. Recovery-only, same reasoning as tuskBoar.ts:
    // clawSwipeClip's own duration already matches the default telegraph+attack window exactly.
    ai.recoverSeconds = 1.3;
    ai.update(distanceToPlayer, delta);
    const isIdle = ai.state === 'idle' || ai.state === 'aggro';
    if (isIdle) {
      applyClipToRig(rig, idleClip, time);
      swipeStartTime = -1;
    } else {
      if (ai.state === 'telegraph' && prevAiState !== 'telegraph') {
        swipeStartTime = time;
      }
      applyClipToRig(rig, clawSwipeClip, time - swipeStartTime);
    }
    prevAiState = ai.state;
    rig.root.updateMatrixWorld(true);
    syncHitbox();
  }

  return { group: rig.root, ai, combatant, update };
}

export function getGroveBearHitbox(bear: GroveBear): Capsule {
  return bear.combatant.hitbox;
}
