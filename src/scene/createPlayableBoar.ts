import * as THREE from 'three';
import { createGlowMaterial } from '../shaders/glow';
import { BOAR_SKINS, type CharacterSkin } from './skins';
import { Rig } from './rig/Rig';
import { blendClips } from './rig/Clip';
import { idleClip } from '../entities/tuskBoarClips';
import { boarWalkClip } from '../entities/playableWalkClips';
import { applyClimbPose } from './climbPose';
import { applyAttackPose } from './attackPose';
import type { PlayableCharacter } from './PlayableCharacter';

const TUSK_COLOR = 0xe8e0d0;

const WALK_SPEED_FOR_FULL_BLEND = 4.5; // matches the fox's own top speed — a boar keeps pace, not a lumber

/** Builds the player-controlled Tusk Boar — same low, sturdy quadruped anatomy as the enemy
 * version (tuskBoar.ts) with real tusks/snout, a chest glow core matching every other playable
 * species, and a coronation crown. */
export function createPlayableBoar(skin: CharacterSkin = BOAR_SKINS[0]): PlayableCharacter {
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
  rig.root.scale.setScalar(1.25); // matches tuskBoar.ts's own real-size bump

  const bodyMat = new THREE.MeshStandardMaterial({ color: skin.furColor, flatShading: true, roughness: 0.85 });
  const darkMat = new THREE.MeshStandardMaterial({ color: skin.furDark, flatShading: true, roughness: 0.8 });
  const tuskMat = new THREE.MeshStandardMaterial({ color: TUSK_COLOR, flatShading: true, roughness: 0.4 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: skin.glowColor, emissive: skin.glowColor, emissiveIntensity: 0.9, flatShading: true });
  const glowShellMat = createGlowMaterial({ color: skin.glowColor, rimColor: skin.glowRim, intensity: 0.35, fresnelPower: 3.2 });
  const glowCoreMat = createGlowMaterial({ color: skin.glowColor, rimColor: skin.glowRim, intensity: 0.55, fresnelPower: 1.4, pulseSpeed: 2.2 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.4, 2, 6), bodyMat);
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  rig.getJoint('spine').add(body);

  const bodyShell = new THREE.Mesh(body.geometry.clone(), glowShellMat);
  bodyShell.rotation.copy(body.rotation);
  bodyShell.scale.setScalar(1.05);
  rig.getJoint('spine').add(bodyShell);

  const chestCore = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), glowCoreMat);
  chestCore.position.set(0, -0.1, 0.16);
  rig.getJoint('spine').add(chestCore);
  const chestLight = new THREE.PointLight(skin.glowColor, 0.22, 3, 2);
  chestLight.position.copy(chestCore.position);
  rig.getJoint('spine').add(chestLight);

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

  // Same crown/head-radius ratio as createPlayableBear.ts's crown, reapplied against this
  // smaller 0.18-radius boar head.
  const crownTrimMat = new THREE.MeshStandardMaterial({ color: 0xc9973a, flatShading: true, roughness: 0.45, metalness: 0.5 });
  const crownGroup = new THREE.Group();
  const crownSpikeGeo = new THREE.ConeGeometry(0.025, 0.08, 4);
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const spike = new THREE.Mesh(crownSpikeGeo, crownTrimMat);
    spike.position.set(Math.cos(angle) * 0.11, 0.17, Math.sin(angle) * 0.11);
    crownGroup.add(spike);
  }
  crownGroup.visible = false;
  rig.getJoint('head').add(crownGroup);

  const shadowMesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.4, 16),
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

  function update(
    time: number,
    delta: number,
    moveSpeed: number,
    blocking = false,
    hurt = false,
    climbing = false,
    attacking = false,
  ) {
    glowMaterials.forEach((m) => {
      (m.uniforms.uTime.value as number) = time;
    });
    walkTime += delta * THREE.MathUtils.clamp(moveSpeed / WALK_SPEED_FOR_FULL_BLEND, 0, 1.6);
    const walkWeight = THREE.MathUtils.clamp(moveSpeed / WALK_SPEED_FOR_FULL_BLEND, 0, 1);
    blendClips(rig, idleClip, time, boarWalkClip, walkTime, walkWeight);
    // Real Block pose: a boar bracing is a real head-down, tusks-forward stance, distinct from
    // the bear's rearing brace and the fox's crouch.
    if (blocking) {
      rig.setLocalRotation('head', 0.3, 0, 0);
      rig.setLocalRotation('spine', 0.12, 0, 0);
    }
    // Real hurt-flinch, applied after blocking: head snaps UP and BACK, the opposite direction
    // from the block's own head-down stance.
    if (hurt) {
      rig.setLocalRotation('head', -0.28, 0, 0);
      rig.setLocalRotation('spine', -0.15, 0, 0);
    }
    if (climbing) applyClimbPose(rig, time);
    if (attacking) applyAttackPose(rig);
  }

  function revealCrown() {
    crownGroup.visible = true;
  }

  return { group: rig.root, rig, crownGroup, update, revealCrown };
}
