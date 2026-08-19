import * as THREE from 'three';
import { createGlowMaterial } from '../shaders/glow';
import { LION_SKINS, type CharacterSkin } from './skins';
import { Rig } from './rig/Rig';
import { blendClips } from './rig/Clip';
import { idleClip } from '../entities/lionClips';
import { lionWalkClip } from '../entities/playableWalkClips';
import { applyClimbPose } from './climbPose';
import type { PlayableCharacter } from './PlayableCharacter';

const LION_MANE_COLOR = 0x6b4423;
const LION_MANE_TIP_COLOR = 0x3f2712;

const WALK_SPEED_FOR_FULL_BLEND = 5.5; // a real apex predator's stride covers ground fast even before a sprint

/** Builds the player-controlled Lion — same leaner, longer apex-predator anatomy as the enemy
 * version (createLion.ts) with a real shaggy mane and tufted tail, a chest glow core matching
 * every other playable species, and a coronation crown. */
export function createPlayableLion(skin: CharacterSkin = LION_SKINS[0]): PlayableCharacter {
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
  rig.root.scale.setScalar(1.5); // matches createLion.ts's own real-size bump

  const coatMat = new THREE.MeshStandardMaterial({ color: skin.furColor, flatShading: true, roughness: 0.8 });
  const coatDarkMat = new THREE.MeshStandardMaterial({ color: skin.furDark, flatShading: true, roughness: 0.85 });
  const maneMat = new THREE.MeshStandardMaterial({ color: LION_MANE_COLOR, flatShading: true, roughness: 0.95 });
  const maneTipMat = new THREE.MeshStandardMaterial({ color: LION_MANE_TIP_COLOR, flatShading: true, roughness: 0.95 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: skin.glowColor, emissive: skin.glowColor, emissiveIntensity: 1.0, flatShading: true });
  const glowShellMat = createGlowMaterial({ color: skin.glowColor, rimColor: skin.glowRim, intensity: 0.35, fresnelPower: 3.2 });
  const glowCoreMat = createGlowMaterial({ color: skin.glowColor, rimColor: skin.glowRim, intensity: 0.55, fresnelPower: 1.4, pulseSpeed: 2.2 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.58, 2, 6), coatMat);
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  rig.getJoint('spine').add(body);

  const bodyShell = new THREE.Mesh(body.geometry.clone(), glowShellMat);
  bodyShell.rotation.copy(body.rotation);
  bodyShell.scale.setScalar(1.05);
  rig.getJoint('spine').add(bodyShell);

  const chestCore = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), glowCoreMat);
  chestCore.position.set(0, -0.12, 0.24);
  rig.getJoint('spine').add(chestCore);
  const chestLight = new THREE.PointLight(skin.glowColor, 0.25, 3.5, 2);
  chestLight.position.copy(chestCore.position);
  rig.getJoint('spine').add(chestLight);

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.19, 0), coatMat);
  head.scale.set(1, 0.92, 1.05);
  head.castShadow = true;
  rig.getJoint('head').add(head);

  const maneLobes: Array<{ radius: number; offset: [number, number, number]; mat: THREE.Material }> = [
    { radius: 0.15, offset: [0, 0.02, -0.06], mat: maneMat },
    { radius: 0.13, offset: [-0.14, 0.0, -0.02], mat: maneMat },
    { radius: 0.13, offset: [0.14, 0.0, -0.02], mat: maneMat },
    { radius: 0.12, offset: [-0.1, -0.14, -0.04], mat: maneTipMat },
    { radius: 0.12, offset: [0.1, -0.14, -0.04], mat: maneTipMat },
    { radius: 0.11, offset: [0, -0.18, -0.1], mat: maneTipMat },
    { radius: 0.1, offset: [0, 0.16, -0.08], mat: maneTipMat },
  ];
  maneLobes.forEach((lobe) => {
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(lobe.radius, 0), lobe.mat);
    mesh.position.set(...lobe.offset);
    mesh.castShadow = true;
    rig.getJoint('head').add(mesh);
  });

  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.16, 6), coatDarkMat);
  snout.rotation.x = Math.PI / 2;
  rig.getJoint('jaw').add(snout);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), maneTipMat);
  nose.position.set(0, 0.02, 0.1);
  rig.getJoint('jaw').add(nose);

  const eyeGeo = new THREE.SphereGeometry(0.026, 6, 6);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.09, 0.03, 0.14);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.09;
  rig.getJoint('head').add(eyeL, eyeR);

  const earGeo = new THREE.ConeGeometry(0.055, 0.1, 4);
  const earL = new THREE.Mesh(earGeo, coatDarkMat);
  earL.rotation.z = 0.3;
  const earR = earL.clone();
  earR.rotation.z = -0.3;
  rig.getJoint('earL').add(earL);
  rig.getJoint('earR').add(earR);

  const legGeo = new THREE.CylinderGeometry(0.055, 0.07, 0.3, 6);
  const forepawL = new THREE.Mesh(legGeo, coatDarkMat);
  rig.getJoint('forepawL').add(forepawL);
  const forepawR = new THREE.Mesh(legGeo.clone(), coatDarkMat);
  rig.getJoint('forepawR').add(forepawR);
  const hindpawL = new THREE.Mesh(legGeo.clone(), coatDarkMat);
  rig.getJoint('hindpawL').add(hindpawL);
  const hindpawR = new THREE.Mesh(legGeo.clone(), coatDarkMat);
  rig.getJoint('hindpawR').add(hindpawR);

  const tail0Seg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.3, 5), coatMat);
  tail0Seg.rotation.x = -0.2;
  tail0Seg.position.y = 0.15;
  rig.getJoint('tail0').add(tail0Seg);
  const tailTuft = new THREE.Mesh(new THREE.IcosahedronGeometry(0.055, 0), maneTipMat);
  tailTuft.position.y = 0.25;
  rig.getJoint('tail1').add(tailTuft);

  // Same crown/head-radius ratio as every other playable species — placed clear of the mane
  // lobes above rather than overlapping them.
  const crownTrimMat = new THREE.MeshStandardMaterial({ color: 0xc9973a, flatShading: true, roughness: 0.45, metalness: 0.5 });
  const crownGroup = new THREE.Group();
  const crownSpikeGeo = new THREE.ConeGeometry(0.026, 0.085, 4);
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const spike = new THREE.Mesh(crownSpikeGeo, crownTrimMat);
    spike.position.set(Math.cos(angle) * 0.115, 0.29, Math.sin(angle) * 0.115 - 0.06);
    crownGroup.add(spike);
  }
  crownGroup.visible = false;
  rig.getJoint('head').add(crownGroup);

  const shadowMesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }),
  );
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.01;
  rig.root.add(shadowMesh);

  rig.root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) obj.layers.set(1);
  });

  const glowMaterials = [glowShellMat, glowCoreMat];
  let walkTime = 0;

  function update(time: number, delta: number, moveSpeed: number, blocking = false, hurt = false, climbing = false) {
    glowMaterials.forEach((m) => {
      (m.uniforms.uTime.value as number) = time;
    });
    walkTime += delta * THREE.MathUtils.clamp(moveSpeed / WALK_SPEED_FOR_FULL_BLEND, 0, 1.6);
    const walkWeight = THREE.MathUtils.clamp(moveSpeed / WALK_SPEED_FOR_FULL_BLEND, 0, 1);
    blendClips(rig, idleClip, time, lionWalkClip, walkTime, walkWeight);
    // Real Block pose: a big cat bracing crouches low, ready to spring away — a deeper crouch
    // than the fox's own, with the mane-heavy head pulled down and forward.
    if (blocking) {
      rig.setLocalRotation('spine', 0.22, 0, 0);
      rig.setLocalRotation('head', 0.18, 0, 0);
    }
    // Real hurt-flinch, applied after blocking: head/spine snap back, opposite the block's own
    // forward-crouch pitch.
    if (hurt) {
      rig.setLocalRotation('spine', -0.2, 0, 0);
      rig.setLocalRotation('head', -0.26, 0, 0);
    }
    if (climbing) applyClimbPose(rig, time);
  }

  function revealCrown() {
    crownGroup.visible = true;
  }

  return { group: rig.root, rig, crownGroup, update, revealCrown };
}
