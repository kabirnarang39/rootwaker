import * as THREE from 'three';
import { Rig } from '../scene/rig/Rig';
import { applyClipToRig } from '../scene/rig/Clip';
import { idleClip, pounceClip } from './lionClips';
import { EnemyAI, type AiState } from './EnemyAI';
import type { Combatant } from '../game/Combat';
import type { Capsule } from '../game/collision';
import { computeStrikeRange } from '../game/EnemyChase';

// Tawny gold coat — real lion coloring, deliberately distinct from the bear's cool brown
// (0x5a4530) and the boar's dark umber (0x4a3626).
const LION_COAT_COLOR = 0xc9973a;
const LION_COAT_DARK = 0x8a662a; // underside/legs — real countershading, not a flat recolor
const LION_MANE_COLOR = 0x6b4423; // darker, shaggier than the coat — the single most identifying real trait
const LION_MANE_TIP_COLOR = 0x3f2712; // mane edges read darker in real lions, not a uniform mass
const LION_EYE_COLOR = 0xffcf6b; // amber — real big-cat eye-shine

export interface Lion {
  group: THREE.Group;
  ai: EnemyAI;
  combatant: Combatant;
  update(time: number, delta: number, distanceToPlayer: number): void;
}

/** Real apex-ambush-predator anatomy: a leaner, longer body than the Grove Bear (built for a
 * sprint, not a lumber), a real shaggy mane clustered around the head/neck (the single trait that
 * makes this unmistakably a lion rather than a generic big cat), and a long tufted tail — lions
 * are the only species in the game with one. */
export function createLion(): Lion {
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

  // Leaner and lower-slung than the bear (0.32 spine radius) but longer than the boar — a real
  // sprinter's proportions, not a lumbering bulk.
  rig.setLocalPosition('spine', 0, 0.3, 0);
  rig.setLocalPosition('head', 0, 0.08, 0.34);
  rig.setLocalPosition('jaw', 0, -0.09, 0.17);
  rig.setLocalPosition('earL', -0.11, 0.17, -0.02);
  rig.setLocalPosition('earR', 0.11, 0.17, -0.02);
  rig.setLocalPosition('shoulderL', -0.19, -0.03, 0.16);
  rig.setLocalPosition('shoulderR', 0.19, -0.03, 0.16);
  rig.setLocalPosition('forepawL', 0, -0.17, 0);
  rig.setLocalPosition('forepawR', 0, -0.17, 0);
  rig.setLocalPosition('hipL', -0.19, -0.03, -0.24);
  rig.setLocalPosition('hipR', 0.19, -0.03, -0.24);
  rig.setLocalPosition('hindpawL', 0, -0.17, 0);
  rig.setLocalPosition('hindpawR', 0, -0.17, 0);
  rig.setLocalPosition('tail0', 0, 0.1, -0.28);
  rig.setLocalPosition('tail1', 0, 0, -0.22);
  rig.captureBasePose();

  const coatMat = new THREE.MeshStandardMaterial({ color: LION_COAT_COLOR, flatShading: true, roughness: 0.8 });
  const coatDarkMat = new THREE.MeshStandardMaterial({ color: LION_COAT_DARK, flatShading: true, roughness: 0.85 });
  const maneMat = new THREE.MeshStandardMaterial({ color: LION_MANE_COLOR, flatShading: true, roughness: 0.95 });
  const maneTipMat = new THREE.MeshStandardMaterial({ color: LION_MANE_TIP_COLOR, flatShading: true, roughness: 0.95 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: LION_EYE_COLOR, emissive: LION_EYE_COLOR, emissiveIntensity: 1.0, flatShading: true });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.58, 2, 6), coatMat);
  body.name = 'lion-body';
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  rig.getJoint('spine').add(body);

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.19, 0), coatMat);
  head.name = 'lion-head';
  head.scale.set(1, 0.92, 1.05);
  head.castShadow = true;
  rig.getJoint('head').add(head);

  // The mane: a real shaggy ruff clustered around the head/neck, built the same way
  // buildTreeSpeciesMeshes clusters canopy lobes — several overlapping icosahedra of varying
  // size/offset/tint instead of one smooth blob, so the silhouette reads as fur, not a helmet.
  const maneLobes: Array<{ radius: number; offset: [number, number, number]; mat: THREE.Material }> = [
    { radius: 0.15, offset: [0, 0.02, -0.06], mat: maneMat },
    { radius: 0.13, offset: [-0.14, 0.0, -0.02], mat: maneMat },
    { radius: 0.13, offset: [0.14, 0.0, -0.02], mat: maneMat },
    { radius: 0.12, offset: [-0.1, -0.14, -0.04], mat: maneTipMat },
    { radius: 0.12, offset: [0.1, -0.14, -0.04], mat: maneTipMat },
    { radius: 0.11, offset: [0, -0.18, -0.1], mat: maneTipMat },
    { radius: 0.1, offset: [0, 0.16, -0.08], mat: maneTipMat },
  ];
  maneLobes.forEach((lobe, i) => {
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(lobe.radius, 0), lobe.mat);
    mesh.name = `lion-mane-${i}`;
    mesh.position.set(...lobe.offset);
    mesh.castShadow = true;
    rig.getJoint('head').add(mesh);
  });

  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.16, 6), coatDarkMat);
  snout.name = 'lion-snout';
  snout.rotation.x = Math.PI / 2;
  rig.getJoint('jaw').add(snout);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), maneTipMat);
  nose.name = 'lion-nose';
  nose.position.set(0, 0.02, 0.1);
  rig.getJoint('jaw').add(nose);

  const eyeGeo = new THREE.SphereGeometry(0.026, 6, 6);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.name = 'lion-eye-l';
  eyeL.position.set(-0.09, 0.03, 0.14);
  const eyeR = eyeL.clone();
  eyeR.name = 'lion-eye-r';
  eyeR.position.x = 0.09;
  rig.getJoint('head').add(eyeL, eyeR);

  const earGeo = new THREE.ConeGeometry(0.055, 0.1, 4);
  const earL = new THREE.Mesh(earGeo, coatDarkMat);
  earL.name = 'lion-ear-l';
  earL.rotation.z = 0.3;
  const earR = earL.clone();
  earR.name = 'lion-ear-r';
  earR.rotation.z = -0.3;
  rig.getJoint('earL').add(earL);
  rig.getJoint('earR').add(earR);

  const legGeo = new THREE.CylinderGeometry(0.055, 0.07, 0.3, 6);
  const forepawL = new THREE.Mesh(legGeo, coatDarkMat);
  forepawL.name = 'lion-forepaw-l';
  rig.getJoint('forepawL').add(forepawL);
  const forepawR = new THREE.Mesh(legGeo.clone(), coatDarkMat);
  forepawR.name = 'lion-forepaw-r';
  rig.getJoint('forepawR').add(forepawR);
  const hindpawL = new THREE.Mesh(legGeo.clone(), coatDarkMat);
  hindpawL.name = 'lion-hindpaw-l';
  rig.getJoint('hindpawL').add(hindpawL);
  const hindpawR = new THREE.Mesh(legGeo.clone(), coatDarkMat);
  hindpawR.name = 'lion-hindpaw-r';
  rig.getJoint('hindpawR').add(hindpawR);

  // The tail: a real lion trait no other species in the game has — a long, thin, plain-coated
  // chain ending in a dark tuft, not just a decorative wiggle.
  const tail0Seg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.3, 5), coatMat);
  tail0Seg.name = 'lion-tail';
  tail0Seg.rotation.x = -0.2;
  tail0Seg.position.y = 0.15;
  rig.getJoint('tail0').add(tail0Seg);
  const tailTuft = new THREE.Mesh(new THREE.IcosahedronGeometry(0.055, 0), maneTipMat);
  tailTuft.name = 'lion-tail-tuft';
  tailTuft.position.y = 0.25;
  rig.getJoint('tail1').add(tailTuft);

  const ai = new EnemyAI();
  const combatant: Combatant = {
    hp: 70,
    maxHp: 70,
    hitbox: { start: new THREE.Vector3(), end: new THREE.Vector3(), radius: 0.42 },
  };

  function syncHitbox() {
    const worldPos = new THREE.Vector3();
    rig.getJoint('spine').getWorldPosition(worldPos);
    combatant.hitbox.start.copy(worldPos);
    combatant.hitbox.end.copy(worldPos).add(new THREE.Vector3(0, 0.45, 0));
  }

  let pounceStartTime = -1;
  let prevAiState: AiState = 'idle';

  function update(time: number, delta: number, distanceToPlayer: number) {
    // A real lion's ambush is FAST to commit — the shortest telegraph of any ground predator in
    // the game bar the viper's strike — but needs a real recovery beat after a full-body leap
    // before it can pounce again, unlike the boar's quick reset. Both set BEFORE ai.update(), the
    // same ordering rule every other species follows.
    ai.telegraphSeconds = 0.4;
    ai.recoverSeconds = 0.9;
    ai.strikeRange = computeStrikeRange(combatant.hitbox.radius);
    ai.update(distanceToPlayer, delta);

    const isIdle = ai.state === 'idle' || ai.state === 'aggro';
    if (isIdle) {
      applyClipToRig(rig, idleClip, time);
      pounceStartTime = -1;
    } else {
      if (ai.state === 'telegraph' && prevAiState !== 'telegraph') {
        pounceStartTime = time;
      }
      applyClipToRig(rig, pounceClip, time - pounceStartTime);
    }
    prevAiState = ai.state;
    rig.root.updateMatrixWorld(true);
    syncHitbox();
  }

  return { group: rig.root, ai, combatant, update };
}

export function getLionHitbox(lion: Lion): Capsule {
  return lion.combatant.hitbox;
}
