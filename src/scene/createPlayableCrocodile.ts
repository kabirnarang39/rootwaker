import * as THREE from 'three';
import { createGlowMaterial } from '../shaders/glow';
import { CROCODILE_SKINS, type CharacterSkin } from './skins';
import { Rig } from './rig/Rig';
import { blendClips } from './rig/Clip';
import { idleClip } from '../entities/crocodileClips';
import { crocodileWalkClip } from '../entities/playableWalkClips';
import type { PlayableCharacter } from './PlayableCharacter';

const TOOTH_COLOR = 0xe8e0d0;

const WALK_SPEED_FOR_FULL_BLEND = 3.5; // a real crocodile's crawl reads slower even at the fox's own top ground speed

/** Builds the player-controlled Crocodile — same long, low ambush-predator anatomy as the enemy
 * version (createCrocodile.ts) with the real armored back ridge and tail, a chest glow core
 * matching every other playable species, and a coronation crown. */
export function createPlayableCrocodile(skin: CharacterSkin = CROCODILE_SKINS[0]): PlayableCharacter {
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
  rig.root.scale.setScalar(1.4); // matches createCrocodile.ts's own real-size bump

  const bodyMat = new THREE.MeshStandardMaterial({ color: skin.furColor, flatShading: true, roughness: 0.8 });
  const darkMat = new THREE.MeshStandardMaterial({ color: skin.furDark, flatShading: true, roughness: 0.85 });
  const bellyMat = new THREE.MeshStandardMaterial({ color: skin.bellyColor, flatShading: true, roughness: 0.75 });
  const toothMat = new THREE.MeshStandardMaterial({ color: TOOTH_COLOR, flatShading: true, roughness: 0.35 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: skin.glowColor, emissive: skin.glowColor, emissiveIntensity: 0.95, flatShading: true });
  const glowShellMat = createGlowMaterial({ color: skin.glowColor, rimColor: skin.glowRim, intensity: 0.35, fresnelPower: 3.2 });
  const glowCoreMat = createGlowMaterial({ color: skin.glowColor, rimColor: skin.glowRim, intensity: 0.55, fresnelPower: 1.4, pulseSpeed: 2.2 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.85, 2, 8), bodyMat);
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  rig.getJoint('spine').add(body);

  const bodyShell = new THREE.Mesh(body.geometry.clone(), glowShellMat);
  bodyShell.rotation.copy(body.rotation);
  bodyShell.scale.setScalar(1.05);
  rig.getJoint('spine').add(bodyShell);

  const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.8, 2, 8), bellyMat);
  belly.rotation.z = Math.PI / 2;
  belly.position.y = -0.08;
  rig.getJoint('spine').add(belly);

  const chestCore = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), glowCoreMat);
  chestCore.position.set(0, -0.12, 0.3);
  rig.getJoint('spine').add(chestCore);
  const chestLight = new THREE.PointLight(skin.glowColor, 0.2, 3, 2);
  chestLight.position.copy(chestCore.position);
  rig.getJoint('spine').add(chestLight);

  const ridgeGeo = new THREE.ConeGeometry(0.035, 0.07, 4);
  for (let i = 0; i < 5; i++) {
    const ridge = new THREE.Mesh(ridgeGeo, darkMat);
    ridge.position.set(0, 0.14, 0.32 - i * 0.16);
    rig.getJoint('spine').add(ridge);
  }

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.42), bodyMat);
  head.castShadow = true;
  rig.getJoint('head').add(head);

  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.06, 0.36), darkMat);
  jaw.position.set(0, -0.06, 0.02);
  rig.getJoint('jaw').add(jaw);

  const toothGeo = new THREE.ConeGeometry(0.014, 0.05, 4);
  for (const [x, z] of [
    [-0.05, 0.14],
    [0.05, 0.14],
    [-0.055, -0.02],
    [0.055, -0.02],
  ] as const) {
    const tooth = new THREE.Mesh(toothGeo, toothMat);
    tooth.rotation.x = Math.PI;
    tooth.position.set(x, 0.05, z);
    rig.getJoint('jaw').add(tooth);
  }

  const eyeGeo = new THREE.SphereGeometry(0.028, 6, 6);
  const eyeRidgeGeo = new THREE.SphereGeometry(0.04, 6, 4);
  const ridgeL = new THREE.Mesh(eyeRidgeGeo, darkMat);
  ridgeL.position.set(-0.07, 0.05, 0.42);
  rig.getJoint('head').add(ridgeL);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.07, 0.075, 0.42);
  rig.getJoint('head').add(eyeL);
  const ridgeR = ridgeL.clone();
  ridgeR.position.x = 0.07;
  rig.getJoint('head').add(ridgeR);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.07;
  rig.getJoint('head').add(eyeR);

  const legGeo = new THREE.CylinderGeometry(0.038, 0.05, 0.16, 6);
  const forepawL = new THREE.Mesh(legGeo, darkMat);
  rig.getJoint('forepawL').add(forepawL);
  const forepawR = new THREE.Mesh(legGeo.clone(), darkMat);
  rig.getJoint('forepawR').add(forepawR);
  const hindpawL = new THREE.Mesh(legGeo.clone(), darkMat);
  rig.getJoint('hindpawL').add(hindpawL);
  const hindpawR = new THREE.Mesh(legGeo.clone(), darkMat);
  rig.getJoint('hindpawR').add(hindpawR);

  const tailSegGeo0 = new THREE.CapsuleGeometry(0.09, 0.3, 2, 6);
  const tail0Mesh = new THREE.Mesh(tailSegGeo0, bodyMat);
  tail0Mesh.rotation.x = Math.PI / 2;
  rig.getJoint('tail0').add(tail0Mesh);
  const tailSegGeo1 = new THREE.CapsuleGeometry(0.065, 0.28, 2, 6);
  const tail1Mesh = new THREE.Mesh(tailSegGeo1, bodyMat);
  tail1Mesh.rotation.x = Math.PI / 2;
  rig.getJoint('tail1').add(tail1Mesh);
  const tailSegGeo2 = new THREE.CapsuleGeometry(0.04, 0.26, 2, 6);
  const tail2Mesh = new THREE.Mesh(tailSegGeo2, darkMat);
  tail2Mesh.rotation.x = Math.PI / 2;
  rig.getJoint('tail2').add(tail2Mesh);

  // Placed atop the head's box geometry, clear of the eye ridges — same crown-on-head technique
  // as every other playable species.
  const crownTrimMat = new THREE.MeshStandardMaterial({ color: 0xc9973a, flatShading: true, roughness: 0.45, metalness: 0.5 });
  const crownGroup = new THREE.Group();
  const crownSpikeGeo = new THREE.ConeGeometry(0.02, 0.065, 4);
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const spike = new THREE.Mesh(crownSpikeGeo, crownTrimMat);
    spike.position.set(Math.cos(angle) * 0.075, 0.09, Math.sin(angle) * 0.075 + 0.2);
    crownGroup.add(spike);
  }
  crownGroup.visible = false;
  rig.getJoint('head').add(crownGroup);

  const shadowMesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.6, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 }),
  );
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.set(0, 0.01, -0.1); // centered under the long body, not just the head
  rig.root.add(shadowMesh);

  rig.root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) obj.layers.set(1);
  });

  const glowMaterials = [glowShellMat, glowCoreMat];
  let walkTime = 0;

  function update(time: number, delta: number, moveSpeed: number, blocking = false) {
    glowMaterials.forEach((m) => {
      (m.uniforms.uTime.value as number) = time;
    });
    walkTime += delta * THREE.MathUtils.clamp(moveSpeed / WALK_SPEED_FOR_FULL_BLEND, 0, 1.6);
    const walkWeight = THREE.MathUtils.clamp(moveSpeed / WALK_SPEED_FOR_FULL_BLEND, 0, 1);
    blendClips(rig, idleClip, time, crocodileWalkClip, walkTime, walkWeight);
    // Real Block pose: a crocodile bracing flattens low and opens its jaw slightly, ready to
    // snap — distinct from every upright species' own brace.
    if (blocking) {
      rig.setLocalRotation('jaw', -0.15, 0, 0);
      rig.applyPositionOffset('spine', 0, -0.03, 0);
    }
  }

  function revealCrown() {
    crownGroup.visible = true;
  }

  return { group: rig.root, rig, crownGroup, update, revealCrown };
}
