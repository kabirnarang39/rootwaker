import * as THREE from 'three';
import { Rig } from '../scene/rig/Rig';
import { applyClipToRig } from '../scene/rig/Clip';
import { idleClip, lungeClip } from './crocodileClips';
import { EnemyAI, type AiState } from './EnemyAI';
import type { Combatant } from '../game/Combat';
import type { Capsule } from '../game/collision';
import { computeStrikeRange } from '../game/EnemyChase';

const CROC_COLOR = 0x3a4a2e;
const CROC_DARK = 0x232e1c;
const CROC_BELLY = 0x8a9068;
const TOOTH_COLOR = 0xe8e0d0;
const EYE_COLOR = 0xffd23d;

export interface Crocodile {
  group: THREE.Group;
  rig: Rig;
  ai: EnemyAI;
  combatant: Combatant;
  update(time: number, delta: number, distanceToPlayer: number): void;
}

/** A real river-crossing ambush predator, distinct from every other species by real anatomy and
 * real behavior — long and low (unlike anything else in the game, which are all upright/roundish
 * bodies), almost perfectly still until it strikes (idleClip is deliberately the subtlest loop in
 * the game), and its lunge is a real explosive tail-driven strike rather than a charge or a leap. */
export function createCrocodile(): Crocodile {
  const rig = new Rig([
    'root', 'spine', 'head', 'jaw',
    'shoulderL', 'shoulderR', 'forepawL', 'forepawR',
    'hipL', 'hipR', 'hindpawL', 'hindpawR',
    'tail0', 'tail1', 'tail2',
  ]);
  rig.attach('spine', 'root');
  rig.attach('head', 'spine');
  rig.attach('jaw', 'head');
  for (const side of ['L', 'R'] as const) {
    rig.attach(`shoulder${side}`, 'spine');
    rig.attach(`forepaw${side}`, `shoulder${side}`);
    rig.attach(`hip${side}`, 'spine');
    rig.attach(`hindpaw${side}`, `hip${side}`);
  }
  rig.attach('tail0', 'root');
  rig.attach('tail1', 'tail0');
  rig.attach('tail2', 'tail1');

  // Real proportions: low to the ground (spine sits barely above the legs, unlike the bear's
  // upright bulk) and long — the body capsule itself is built long+low rather than relying on a
  // non-uniform root scale (which would also stretch the legs/head into the wrong shape).
  rig.setLocalPosition('spine', 0, 0.14, 0);
  rig.setLocalPosition('head', 0, -0.01, 0.55);
  rig.setLocalPosition('jaw', 0, -0.05, 0.18);
  rig.setLocalPosition('shoulderL', -0.16, -0.06, 0.32);
  rig.setLocalPosition('shoulderR', 0.16, -0.06, 0.32);
  rig.setLocalPosition('forepawL', 0, -0.09, 0);
  rig.setLocalPosition('forepawR', 0, -0.09, 0);
  rig.setLocalPosition('hipL', -0.17, -0.06, -0.38);
  rig.setLocalPosition('hipR', 0.17, -0.06, -0.38);
  rig.setLocalPosition('hindpawL', 0, -0.09, 0);
  rig.setLocalPosition('hindpawR', 0, -0.09, 0);
  rig.setLocalPosition('tail0', 0, 0.02, -0.55);
  rig.setLocalPosition('tail1', 0, 0, -0.4);
  rig.setLocalPosition('tail2', 0, 0, -0.32);
  rig.captureBasePose();
  // Real-world scale: long-bodied ambush predators read as genuinely large (real adult crocodiles
  // are meters longer than a fox), but the length itself already comes from the elongated
  // geometry above — this uniform bump is for overall bulk/presence, comparable to the other
  // apex-tier species (bear 1.6x, lion 1.5x) rather than a second elongation pass.
  rig.root.scale.setScalar(1.4);

  const bodyMat = new THREE.MeshStandardMaterial({ color: CROC_COLOR, flatShading: true, roughness: 0.8 });
  const darkMat = new THREE.MeshStandardMaterial({ color: CROC_DARK, flatShading: true, roughness: 0.85 });
  const bellyMat = new THREE.MeshStandardMaterial({ color: CROC_BELLY, flatShading: true, roughness: 0.75 });
  const toothMat = new THREE.MeshStandardMaterial({ color: TOOTH_COLOR, flatShading: true, roughness: 0.35 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: EYE_COLOR, emissive: EYE_COLOR, emissiveIntensity: 0.95, flatShading: true });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.85, 2, 8), bodyMat);
  body.name = 'crocodile-body';
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  rig.getJoint('spine').add(body);

  const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.8, 2, 8), bellyMat);
  belly.name = 'crocodile-belly';
  belly.rotation.z = Math.PI / 2;
  belly.position.y = -0.08;
  rig.getJoint('spine').add(belly);

  // A real distinguishing trait — the armored ridge of osteoderms along a crocodile's back,
  // the same "one real trait that must read at a glance" bar the lion's mane/viper's coil hold.
  const ridgeGeo = new THREE.ConeGeometry(0.035, 0.07, 4);
  for (let i = 0; i < 5; i++) {
    const ridge = new THREE.Mesh(ridgeGeo, darkMat);
    ridge.name = `crocodile-ridge-${i}`;
    ridge.position.set(0, 0.14, 0.32 - i * 0.16);
    rig.getJoint('spine').add(ridge);
  }

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.42), bodyMat);
  head.name = 'crocodile-head';
  head.castShadow = true;
  rig.getJoint('head').add(head);

  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.06, 0.36), darkMat);
  jaw.name = 'crocodile-jaw';
  jaw.position.set(0, -0.06, 0.02);
  rig.getJoint('jaw').add(jaw);

  const toothGeo = new THREE.ConeGeometry(0.014, 0.05, 4);
  for (const [name, x, z] of [
    ['tooth-l1', -0.05, 0.14] as const,
    ['tooth-r1', 0.05, 0.14] as const,
    ['tooth-l2', -0.055, -0.02] as const,
    ['tooth-r2', 0.055, -0.02] as const,
  ]) {
    const tooth = new THREE.Mesh(toothGeo, toothMat);
    tooth.name = `crocodile-${name}`;
    tooth.rotation.x = Math.PI;
    tooth.position.set(x, 0.05, z);
    rig.getJoint('jaw').add(tooth);
  }

  // Real trait: crocodile eyes sit on raised ridges atop the head (so they break the surface
  // while the rest of the body stays submerged) — both meshes attach directly to the head joint
  // since they're static decoration, not independently-animated parts.
  const eyeGeo = new THREE.SphereGeometry(0.028, 6, 6);
  const eyeRidgeGeo = new THREE.SphereGeometry(0.04, 6, 4);
  const ridgeL = new THREE.Mesh(eyeRidgeGeo, darkMat);
  ridgeL.name = 'crocodile-eye-ridge-l';
  ridgeL.position.set(-0.07, 0.05, 0.42);
  rig.getJoint('head').add(ridgeL);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.name = 'crocodile-eye-l';
  eyeL.position.set(-0.07, 0.075, 0.42);
  rig.getJoint('head').add(eyeL);
  const ridgeR = ridgeL.clone();
  ridgeR.name = 'crocodile-eye-ridge-r';
  ridgeR.position.x = 0.07;
  rig.getJoint('head').add(ridgeR);
  const eyeR = eyeL.clone();
  eyeR.name = 'crocodile-eye-r';
  eyeR.position.x = 0.07;
  rig.getJoint('head').add(eyeR);

  const legGeo = new THREE.CylinderGeometry(0.038, 0.05, 0.16, 6);
  const forepawL = new THREE.Mesh(legGeo, darkMat);
  forepawL.name = 'crocodile-forepaw-l';
  rig.getJoint('forepawL').add(forepawL);
  const forepawR = new THREE.Mesh(legGeo.clone(), darkMat);
  forepawR.name = 'crocodile-forepaw-r';
  rig.getJoint('forepawR').add(forepawR);
  const hindpawL = new THREE.Mesh(legGeo.clone(), darkMat);
  hindpawL.name = 'crocodile-hindpaw-l';
  rig.getJoint('hindpawL').add(hindpawL);
  const hindpawR = new THREE.Mesh(legGeo.clone(), darkMat);
  hindpawR.name = 'crocodile-hindpaw-r';
  rig.getJoint('hindpawR').add(hindpawR);

  const tailSegGeo0 = new THREE.CapsuleGeometry(0.09, 0.3, 2, 6);
  const tail0Mesh = new THREE.Mesh(tailSegGeo0, bodyMat);
  tail0Mesh.name = 'crocodile-tail0';
  tail0Mesh.rotation.x = Math.PI / 2;
  rig.getJoint('tail0').add(tail0Mesh);
  const tailSegGeo1 = new THREE.CapsuleGeometry(0.065, 0.28, 2, 6);
  const tail1Mesh = new THREE.Mesh(tailSegGeo1, bodyMat);
  tail1Mesh.name = 'crocodile-tail1';
  tail1Mesh.rotation.x = Math.PI / 2;
  rig.getJoint('tail1').add(tail1Mesh);
  const tailSegGeo2 = new THREE.CapsuleGeometry(0.04, 0.26, 2, 6);
  const tail2Mesh = new THREE.Mesh(tailSegGeo2, darkMat);
  tail2Mesh.name = 'crocodile-tail2';
  tail2Mesh.rotation.x = Math.PI / 2;
  rig.getJoint('tail2').add(tail2Mesh);

  const ai = new EnemyAI();
  const combatant: Combatant = {
    hp: 60,
    maxHp: 60,
    hitbox: { start: new THREE.Vector3(), end: new THREE.Vector3(), radius: 0.55 },
  };

  function syncHitbox() {
    const worldPos = new THREE.Vector3();
    rig.getJoint('spine').getWorldPosition(worldPos);
    combatant.hitbox.start.copy(worldPos);
    combatant.hitbox.end.copy(worldPos).add(new THREE.Vector3(0, 0.35, 0));
  }

  let lungeStartTime = -1;
  let prevAiState: AiState = 'idle';

  function update(time: number, delta: number, distanceToPlayer: number) {
    ai.strikeRange = computeStrikeRange(combatant.hitbox.radius);
    // A real crocodile's own rhythm: a long, patient idle (handled by idleClip's own subtlety),
    // then commits hard once it strikes — a slow recovery, since a real lunge leaves it briefly
    // exposed/repositioning rather than ready to strike again instantly like the boar. The lunge
    // clip itself now runs 1.5s (0.9s bite + a real 0.6s death roll — see crocodileClips.ts), so
    // 1.1s of recovery on top of that 0.9s telegraph+attack window leaves the full roll room to
    // play out before the AI is willing to strike again.
    ai.recoverSeconds = 1.1;
    ai.update(distanceToPlayer, delta);
    const isIdle = ai.state === 'idle' || ai.state === 'aggro';
    if (isIdle) {
      applyClipToRig(rig, idleClip, time);
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

export function getCrocodileHitbox(crocodile: Crocodile): Capsule {
  return crocodile.combatant.hitbox;
}
