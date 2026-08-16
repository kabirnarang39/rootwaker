import * as THREE from 'three';
import { Rig } from '../scene/rig/Rig';
import { applyClipToRig } from '../scene/rig/Clip';
import { idleClip, strikeClip } from './mountainGuardClips';
import { EnemyAI, type AiState } from './EnemyAI';
import type { Combatant } from '../game/Combat';
import type { Capsule } from '../game/collision';

const GUARD_STONE_COLOR = 0x4a4842;
const GUARD_TRIM_COLOR = 0x8a6a3a;

export interface MountainGuard {
  group: THREE.Group;
  ai: EnemyAI;
  combatant: Combatant;
  update(time: number, delta: number, distanceToPlayer: number): void;
}

export function createMountainGuard(): MountainGuard {
  const rig = new Rig(['root', 'spine', 'head', 'shoulderL', 'shoulderR']);
  rig.attach('spine', 'root');
  rig.attach('head', 'spine');
  rig.attach('shoulderL', 'spine');
  rig.attach('shoulderR', 'spine');

  rig.setLocalPosition('spine', 0, 0.4, 0);
  rig.setLocalPosition('head', 0, 0.15, 0.35);
  rig.setLocalPosition('shoulderL', -0.28, 0, 0.1);
  rig.setLocalPosition('shoulderR', 0.28, 0, 0.1);
  rig.captureBasePose();

  const stoneMat = new THREE.MeshStandardMaterial({ color: GUARD_STONE_COLOR, flatShading: true, roughness: 0.95 });
  const trimMat = new THREE.MeshStandardMaterial({ color: GUARD_TRIM_COLOR, flatShading: true, roughness: 0.6, metalness: 0.3 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.7), stoneMat);
  body.castShadow = true;
  rig.getJoint('spine').add(body);

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), stoneMat);
  rig.getJoint('head').add(head);

  const trimGeo = new THREE.ConeGeometry(0.06, 0.2, 4);
  const trimL = new THREE.Mesh(trimGeo, trimMat);
  trimL.rotation.z = Math.PI / 2;
  rig.getJoint('shoulderL').add(trimL);
  const trimR = new THREE.Mesh(trimGeo, trimMat);
  trimR.rotation.z = -Math.PI / 2;
  rig.getJoint('shoulderR').add(trimR);

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

  let strikeStartTime = -1;
  let prevAiState: AiState = 'idle';

  function update(time: number, delta: number, distanceToPlayer: number) {
    ai.update(distanceToPlayer, delta);
    const isIdle = ai.state === 'idle' || ai.state === 'aggro';
    if (isIdle) {
      applyClipToRig(rig, idleClip, time);
      strikeStartTime = -1;
    } else {
      if (ai.state === 'telegraph' && prevAiState !== 'telegraph') {
        strikeStartTime = time;
      }
      applyClipToRig(rig, strikeClip, time - strikeStartTime);
    }
    prevAiState = ai.state;
    rig.root.updateMatrixWorld(true);
    syncHitbox();
  }

  return { group: rig.root, ai, combatant, update };
}

export function getGuardHitbox(guard: MountainGuard): Capsule {
  return guard.combatant.hitbox;
}
