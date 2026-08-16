import * as THREE from 'three';
import { Rig } from '../scene/rig/Rig';
import { applyClipToRig } from '../scene/rig/Clip';
import { idleClip, chargeClip } from './tuskBoarClips';
import { EnemyAI, type AiState } from './EnemyAI';
import type { Combatant } from '../game/Combat';
import type { Capsule } from '../game/collision';

const BOAR_COLOR = 0x4a3626;
const TUSK_COLOR = 0xe8e0d0;

export interface TuskBoar {
  group: THREE.Group;
  ai: EnemyAI;
  combatant: Combatant;
  update(time: number, delta: number, distanceToPlayer: number): void;
}

export function createTuskBoar(): TuskBoar {
  const rig = new Rig(['root', 'spine', 'head', 'tuskL', 'tuskR']);
  rig.attach('spine', 'root');
  rig.attach('head', 'spine');
  rig.attach('tuskL', 'head');
  rig.attach('tuskR', 'head');

  rig.setLocalPosition('spine', 0, 0.28, 0);
  rig.setLocalPosition('head', 0, -0.05, 0.3);
  rig.setLocalPosition('tuskL', -0.08, -0.05, 0.1);
  rig.setLocalPosition('tuskR', 0.08, -0.05, 0.1);
  rig.captureBasePose();

  const bodyMat = new THREE.MeshStandardMaterial({ color: BOAR_COLOR, flatShading: true, roughness: 0.9 });
  const tuskMat = new THREE.MeshStandardMaterial({ color: TUSK_COLOR, flatShading: true, roughness: 0.4 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.4, 2, 6), bodyMat);
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  rig.getJoint('spine').add(body);

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 0), bodyMat);
  rig.getJoint('head').add(head);

  const tuskGeo = new THREE.ConeGeometry(0.03, 0.14, 4);
  const tuskL = new THREE.Mesh(tuskGeo, tuskMat);
  tuskL.rotation.x = Math.PI / 2;
  rig.getJoint('tuskL').add(tuskL);
  const tuskR = new THREE.Mesh(tuskGeo, tuskMat);
  tuskR.rotation.x = Math.PI / 2;
  rig.getJoint('tuskR').add(tuskR);

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
