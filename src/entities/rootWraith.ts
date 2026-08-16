import * as THREE from 'three';
import { Rig } from '../scene/rig/Rig';
import { applyClipToRig } from '../scene/rig/Clip';
import { crawlClip, lungeClip } from './rootWraithClips';
import { EnemyAI } from './EnemyAI';
import type { Combatant } from '../game/Combat';
import type { Capsule } from '../game/collision';

const ROOT_WRAITH_COLOR = 0x2a1a12;
const ROOT_WRAITH_GLOW = 0x8a3a5a;

export interface RootWraith {
  group: THREE.Group;
  rig: Rig;
  ai: EnemyAI;
  combatant: Combatant;
  update(time: number, delta: number, distanceToPlayer: number): void;
}

export function createRootWraith(): RootWraith {
  const rig = new Rig(['root', 'spine', 'forepawL', 'forepawR', 'tail0', 'tail1', 'tail2']);
  rig.attach('spine', 'root');
  rig.attach('forepawL', 'spine');
  rig.attach('forepawR', 'spine');
  rig.attach('tail0', 'root');
  rig.attach('tail1', 'tail0');
  rig.attach('tail2', 'tail1');

  const mat = new THREE.MeshStandardMaterial({ color: ROOT_WRAITH_COLOR, flatShading: true, roughness: 0.95 });
  const glowMat = new THREE.MeshStandardMaterial({ color: ROOT_WRAITH_GLOW, emissive: ROOT_WRAITH_GLOW, emissiveIntensity: 0.6, flatShading: true });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.6, 2, 6), mat);
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  rig.getJoint('spine').add(body);

  for (const side of ['L', 'R'] as const) {
    const limb = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.5, 5), mat);
    limb.position.y = -0.25;
    rig.getJoint(`forepaw${side}`).add(limb);
  }

  const tailJoints = ['tail0', 'tail1', 'tail2'] as const;
  tailJoints.forEach((joint, i) => {
    const isTip = i === tailJoints.length - 1;
    const seg = new THREE.Mesh(new THREE.ConeGeometry(0.1 - i * 0.02, 0.3, 5), isTip ? glowMat : mat);
    seg.position.y = 0.15;
    rig.getJoint(joint).add(seg);
  });

  const ai = new EnemyAI();
  const combatant: Combatant = {
    hp: 40,
    maxHp: 40,
    hitbox: { start: new THREE.Vector3(), end: new THREE.Vector3(), radius: 0.5 },
  };

  function syncHitbox() {
    const worldPos = new THREE.Vector3();
    rig.getJoint('spine').getWorldPosition(worldPos);
    combatant.hitbox.start.copy(worldPos);
    combatant.hitbox.end.copy(worldPos).add(new THREE.Vector3(0, 0.6, 0));
  }

  function update(time: number, delta: number, distanceToPlayer: number) {
    ai.update(distanceToPlayer, delta);
    if (ai.state === 'idle' || ai.state === 'aggro') {
      applyClipToRig(rig, crawlClip, time);
    } else {
      applyClipToRig(rig, lungeClip, Math.min(time, lungeClip.duration));
    }
    rig.root.updateMatrixWorld(true);
    syncHitbox();
  }

  return { group: rig.root, rig, ai, combatant, update };
}

export function getAttackHitbox(wraith: RootWraith): Capsule {
  return wraith.combatant.hitbox;
}
