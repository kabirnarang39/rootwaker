import * as THREE from 'three';
import { Rig } from '../scene/rig/Rig';
import { applyClipToRig } from '../scene/rig/Clip';
import { idleClip, chargeClip } from './tuskBoarClips';
import { EnemyAI, type AiState } from './EnemyAI';
import type { Combatant } from '../game/Combat';
import type { Capsule } from '../game/collision';
import { computeStrikeRange } from '../game/EnemyChase';

const BOAR_COLOR = 0x4a3626;
const BOAR_DARK = 0x2e2015;
const TUSK_COLOR = 0xe8e0d0;
const EYE_COLOR = 0xff9d3d;

export interface TuskBoar {
  group: THREE.Group;
  ai: EnemyAI;
  combatant: Combatant;
  update(time: number, delta: number, distanceToPlayer: number): void;
}

export function createTuskBoar(): TuskBoar {
  const rig = new Rig([
    'root', 'spine', 'head', 'tuskL', 'tuskR', 'earL', 'earR',
    'shoulderL', 'shoulderR', 'forepawL', 'forepawR',
    'hipL', 'hipR', 'hindpawL', 'hindpawR',
  ]);
  rig.attach('spine', 'root');
  rig.attach('head', 'spine');
  rig.attach('tuskL', 'head');
  rig.attach('tuskR', 'head');
  rig.attach('earL', 'head');
  rig.attach('earR', 'head');
  for (const side of ['L', 'R'] as const) {
    rig.attach(`shoulder${side}`, 'spine');
    rig.attach(`forepaw${side}`, `shoulder${side}`);
    rig.attach(`hip${side}`, 'spine');
    rig.attach(`hindpaw${side}`, `hip${side}`);
  }

  rig.setLocalPosition('spine', 0, 0.26, 0);
  rig.setLocalPosition('head', 0, -0.02, 0.3);
  rig.setLocalPosition('tuskL', -0.08, -0.08, 0.14);
  rig.setLocalPosition('tuskR', 0.08, -0.08, 0.14);
  rig.setLocalPosition('earL', -0.1, 0.14, -0.02);
  rig.setLocalPosition('earR', 0.1, 0.14, -0.02);
  rig.setLocalPosition('shoulderL', -0.15, -0.04, 0.12);
  rig.setLocalPosition('shoulderR', 0.15, -0.04, 0.12);
  rig.setLocalPosition('forepawL', 0, -0.12, 0);
  rig.setLocalPosition('forepawR', 0, -0.12, 0);
  rig.setLocalPosition('hipL', -0.15, -0.04, -0.16);
  rig.setLocalPosition('hipR', 0.15, -0.04, -0.16);
  rig.setLocalPosition('hindpawL', 0, -0.12, 0);
  rig.setLocalPosition('hindpawR', 0, -0.12, 0);
  rig.captureBasePose();

  const bodyMat = new THREE.MeshStandardMaterial({ color: BOAR_COLOR, flatShading: true, roughness: 0.85 });
  const darkMat = new THREE.MeshStandardMaterial({ color: BOAR_DARK, flatShading: true, roughness: 0.8 });
  const tuskMat = new THREE.MeshStandardMaterial({ color: TUSK_COLOR, flatShading: true, roughness: 0.4 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: EYE_COLOR, emissive: EYE_COLOR, emissiveIntensity: 0.9, flatShading: true });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.4, 2, 6), bodyMat);
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  rig.getJoint('spine').add(body);

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 0), bodyMat);
  head.scale.set(1, 0.85, 1.2);
  head.castShadow = true;
  rig.getJoint('head').add(head);

  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.16, 6), darkMat);
  snout.rotation.x = Math.PI / 2;
  snout.position.z = 0.1;
  rig.getJoint('head').add(snout);

  const eyeGeo = new THREE.SphereGeometry(0.022, 6, 6);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.08, 0.03, 0.12);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.08;
  rig.getJoint('head').add(eyeL, eyeR);

  const earGeo = new THREE.ConeGeometry(0.06, 0.14, 4);
  const earL = new THREE.Mesh(earGeo, darkMat);
  earL.rotation.z = 0.4;
  const earR = earL.clone();
  earR.rotation.z = -0.4;
  rig.getJoint('earL').add(earL);
  rig.getJoint('earR').add(earR);

  const tuskGeo = new THREE.ConeGeometry(0.03, 0.14, 4);
  const tuskL = new THREE.Mesh(tuskGeo, tuskMat);
  tuskL.rotation.x = Math.PI / 2;
  rig.getJoint('tuskL').add(tuskL);
  const tuskR = new THREE.Mesh(tuskGeo, tuskMat);
  tuskR.rotation.x = Math.PI / 2;
  rig.getJoint('tuskR').add(tuskR);

  const legGeo = new THREE.CylinderGeometry(0.045, 0.055, 0.24, 6);
  const forepawL = new THREE.Mesh(legGeo, darkMat);
  rig.getJoint('forepawL').add(forepawL);
  const forepawR = new THREE.Mesh(legGeo.clone(), darkMat);
  rig.getJoint('forepawR').add(forepawR);
  const hindpawL = new THREE.Mesh(legGeo.clone(), darkMat);
  rig.getJoint('hindpawL').add(hindpawL);
  const hindpawR = new THREE.Mesh(legGeo.clone(), darkMat);
  rig.getJoint('hindpawR').add(hindpawR);

  const ai = new EnemyAI();
  const combatant: Combatant = {
    hp: 55,
    maxHp: 55,
    hitbox: { start: new THREE.Vector3(), end: new THREE.Vector3(), radius: 0.4 },
  };

  function syncHitbox() {
    const worldPos = new THREE.Vector3();
    rig.getJoint('spine').getWorldPosition(worldPos);
    combatant.hitbox.start.copy(worldPos);
    combatant.hitbox.end.copy(worldPos).add(new THREE.Vector3(0, 0.4, 0));
  }

  let chargeStartTime = -1;
  let prevAiState: AiState = 'idle';

  function update(time: number, delta: number, distanceToPlayer: number) {
    ai.strikeRange = computeStrikeRange(combatant.hitbox.radius);
    ai.update(distanceToPlayer, delta);
    const isIdle = ai.state === 'idle' || ai.state === 'aggro';
    if (isIdle) {
      applyClipToRig(rig, idleClip, time);
      chargeStartTime = -1;
    } else {
      if (ai.state === 'telegraph' && prevAiState !== 'telegraph') {
        chargeStartTime = time;
      }
      applyClipToRig(rig, chargeClip, time - chargeStartTime);
    }
    prevAiState = ai.state;
    rig.root.updateMatrixWorld(true);
    syncHitbox();
  }

  return { group: rig.root, ai, combatant, update };
}

export function getBoarHitbox(boar: TuskBoar): Capsule {
  return boar.combatant.hitbox;
}
