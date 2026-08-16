import * as THREE from 'three';
import { Rig } from '../scene/rig/Rig';
import { applyClipToRig } from '../scene/rig/Clip';
import { idleClip, clawSwipeClip } from './groveBearClips';
import { EnemyAI, type AiState } from './EnemyAI';
import type { Combatant } from '../game/Combat';
import type { Capsule } from '../game/collision';

const BEAR_FUR_COLOR = 0x4a3826;
const BEAR_CLAW_COLOR = 0x2a2015;

export interface GroveBear {
  group: THREE.Group;
  ai: EnemyAI;
  combatant: Combatant;
  update(time: number, delta: number, distanceToPlayer: number): void;
}

export function createGroveBear(): GroveBear {
  const rig = new Rig(['root', 'spine', 'head', 'shoulderL', 'shoulderR']);
  rig.attach('spine', 'root');
  rig.attach('head', 'spine');
  rig.attach('shoulderL', 'spine');
  rig.attach('shoulderR', 'spine');

  // Low-slung, heavier-bodied proportions than tuskBoar's — a real bear reads bulkier and
  // lower to the ground than a boar, not just a recolor.
  rig.setLocalPosition('spine', 0, 0.32, 0);
  rig.setLocalPosition('head', 0, 0.05, 0.32);
  rig.setLocalPosition('shoulderL', -0.22, -0.02, 0.14);
  rig.setLocalPosition('shoulderR', 0.22, -0.02, 0.14);
  rig.captureBasePose();

  const furMat = new THREE.MeshStandardMaterial({ color: BEAR_FUR_COLOR, flatShading: true, roughness: 0.95 });
  const clawMat = new THREE.MeshStandardMaterial({ color: BEAR_CLAW_COLOR, flatShading: true, roughness: 0.6 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.5, 2, 6), furMat);
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  rig.getJoint('spine').add(body);

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), furMat);
  rig.getJoint('head').add(head);

  const clawGeo = new THREE.ConeGeometry(0.04, 0.12, 4);
  const clawL = new THREE.Mesh(clawGeo, clawMat);
  clawL.rotation.z = Math.PI / 2;
  rig.getJoint('shoulderL').add(clawL);
  const clawR = new THREE.Mesh(clawGeo, clawMat);
  clawR.rotation.z = -Math.PI / 2;
  rig.getJoint('shoulderR').add(clawR);

  const ai = new EnemyAI();
  const combatant: Combatant = {
    hp: 65,
    maxHp: 65,
    hitbox: { start: new THREE.Vector3(), end: new THREE.Vector3(), radius: 0.45 },
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
