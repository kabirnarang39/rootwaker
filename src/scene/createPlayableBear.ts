import * as THREE from 'three';
import { createGlowMaterial } from '../shaders/glow';
import { BEAR_SKINS, type CharacterSkin } from './skins';
import { Rig } from './rig/Rig';
import { blendClips } from './rig/Clip';
import { walkClip, idleClip } from '../entities/groveBearClips';
import { applyClimbPose } from './climbPose';
import type { PlayableCharacter } from './PlayableCharacter';

const CLAW_COLOR = 0x2a2015;

const WALK_SPEED_FOR_FULL_BLEND = 5; // a bear's real top speed reads slower than the fox's
const BLOCK_SPINE_PITCH = 0.35;
const BLOCK_HEAD_PITCH = 0.25;
const HURT_SPINE_RECOIL = -0.18; // a real bear's own bulk means a smaller recoil than the fox's, still a real flinch
const HURT_HEAD_RECOIL = -0.24;

/** Builds the player-controlled Grove Bear — same low-slung anatomy as the enemy version
 * (createGroveBear.ts) with a real quadruped pacing walk, a chest glow core matching the fox's
 * "spirit" visual language, and a coronation crown so a bear player can become King too. */
export function createPlayableBear(skin: CharacterSkin = BEAR_SKINS[0]): PlayableCharacter {
  const rig = new Rig([
    'root', 'spine', 'head', 'jaw', 'earL', 'earR',
    'shoulderL', 'shoulderR', 'forepawL', 'forepawR',
    'hipL', 'hipR', 'hindpawL', 'hindpawR',
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

  rig.setLocalPosition('spine', 0, 0.32, 0);
  rig.setLocalPosition('head', 0, 0.05, 0.32);
  rig.setLocalPosition('jaw', 0, -0.08, 0.16);
  rig.setLocalPosition('earL', -0.13, 0.16, -0.02);
  rig.setLocalPosition('earR', 0.13, 0.16, -0.02);
  rig.setLocalPosition('shoulderL', -0.2, -0.02, 0.14);
  rig.setLocalPosition('shoulderR', 0.2, -0.02, 0.14);
  rig.setLocalPosition('forepawL', 0, -0.16, 0);
  rig.setLocalPosition('forepawR', 0, -0.16, 0);
  rig.setLocalPosition('hipL', -0.2, -0.02, -0.18);
  rig.setLocalPosition('hipR', 0.2, -0.02, -0.18);
  rig.setLocalPosition('hindpawL', 0, -0.16, 0);
  rig.setLocalPosition('hindpawR', 0, -0.16, 0);
  rig.captureBasePose();

  const furMat = new THREE.MeshStandardMaterial({ color: skin.furColor, flatShading: true, roughness: 0.85 });
  const furDarkMat = new THREE.MeshStandardMaterial({ color: skin.furDark, flatShading: true, roughness: 0.9 });
  const clawMat = new THREE.MeshStandardMaterial({ color: CLAW_COLOR, flatShading: true, roughness: 0.5 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: skin.glowColor, emissive: skin.glowColor, emissiveIntensity: 0.9, flatShading: true });
  const glowShellMat = createGlowMaterial({ color: skin.glowColor, rimColor: skin.glowRim, intensity: 0.35, fresnelPower: 3.2 });
  const glowCoreMat = createGlowMaterial({ color: skin.glowColor, rimColor: skin.glowRim, intensity: 0.55, fresnelPower: 1.4, pulseSpeed: 2.2 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.5, 2, 6), furMat);
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  rig.getJoint('spine').add(body);

  const bodyShell = new THREE.Mesh(body.geometry.clone(), glowShellMat);
  bodyShell.rotation.copy(body.rotation);
  bodyShell.scale.setScalar(1.05);
  rig.getJoint('spine').add(bodyShell);

  const chestCore = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), glowCoreMat);
  chestCore.position.set(0, -0.12, 0.22);
  rig.getJoint('spine').add(chestCore);
  const chestLight = new THREE.PointLight(skin.glowColor, 0.25, 3.5, 2);
  chestLight.position.copy(chestCore.position);
  rig.getJoint('spine').add(chestLight);

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), furMat);
  head.scale.set(1, 0.9, 1.05);
  head.castShadow = true;
  rig.getJoint('head').add(head);

  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.2, 6), furDarkMat);
  snout.rotation.x = Math.PI / 2;
  rig.getJoint('jaw').add(snout);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), clawMat);
  nose.position.set(0, 0.01, 0.1);
  rig.getJoint('jaw').add(nose);

  const eyeGeo = new THREE.SphereGeometry(0.028, 6, 6);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.1, 0.02, 0.16);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.1;
  rig.getJoint('head').add(eyeL, eyeR);

  const earGeo = new THREE.SphereGeometry(0.07, 6, 6);
  const earL = new THREE.Mesh(earGeo, furDarkMat);
  earL.scale.set(1, 1, 0.6);
  const earR = earL.clone();
  rig.getJoint('earL').add(earL);
  rig.getJoint('earR').add(earR);

  const clawGeo = new THREE.ConeGeometry(0.04, 0.12, 4);
  const clawL = new THREE.Mesh(clawGeo, clawMat);
  clawL.rotation.z = Math.PI / 2;
  rig.getJoint('shoulderL').add(clawL);
  const clawR = new THREE.Mesh(clawGeo, clawMat);
  clawR.rotation.z = -Math.PI / 2;
  rig.getJoint('shoulderR').add(clawR);

  const legGeo = new THREE.CylinderGeometry(0.06, 0.075, 0.32, 6);
  const forepawL = new THREE.Mesh(legGeo, furDarkMat);
  rig.getJoint('forepawL').add(forepawL);
  const forepawR = new THREE.Mesh(legGeo.clone(), furDarkMat);
  rig.getJoint('forepawR').add(forepawR);
  const hindpawL = new THREE.Mesh(legGeo.clone(), furDarkMat);
  rig.getJoint('hindpawL').add(hindpawL);
  const hindpawR = new THREE.Mesh(legGeo.clone(), furDarkMat);
  rig.getJoint('hindpawR').add(hindpawR);

  // Same crown/head-radius ratio as createFox.ts's crown (0.147/0.24 ring radius, 0.227/0.24
  // height) reapplied against this bear's smaller 0.22-radius head, so it sits on the skull
  // instead of floating clear of it.
  const crownTrimMat = new THREE.MeshStandardMaterial({ color: 0xc9973a, flatShading: true, roughness: 0.45, metalness: 0.5 });
  const crownGroup = new THREE.Group();
  const crownSpikeGeo = new THREE.ConeGeometry(0.03, 0.098, 4);
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const spike = new THREE.Mesh(crownSpikeGeo, crownTrimMat);
    spike.position.set(Math.cos(angle) * 0.135, 0.208, Math.sin(angle) * 0.135);
    crownGroup.add(spike);
  }
  crownGroup.visible = false;
  rig.getJoint('head').add(crownGroup);

  const shadowMesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.46, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }),
  );
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.01;
  rig.root.add(shadowMesh);

  // Same own-model exclusion for first-person view as createFox.ts — see that file's comment for
  // why this is meshes-only, never lights.
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
    blendClips(rig, idleClip, time, walkClip, walkTime, walkWeight);
    // Real Block pose — see createFox.ts's own comment for the shared "overlay after the blend"
    // convention. A real bear brace reads as lowering onto all fours and dropping the head, a
    // heavier/deeper version of the fox's own crouch given the bear's own bulk.
    if (blocking) {
      rig.setLocalRotation('spine', BLOCK_SPINE_PITCH, 0, 0);
      rig.setLocalRotation('head', BLOCK_HEAD_PITCH, 0, 0);
    }
    // Real hurt-flinch, applied after blocking so it always visibly wins — see createFox.ts.
    if (hurt) {
      rig.setLocalRotation('spine', HURT_SPINE_RECOIL, 0, 0);
      rig.setLocalRotation('head', HURT_HEAD_RECOIL, 0, 0);
    }
    if (climbing) applyClimbPose(rig, time);
  }

  function revealCrown() {
    crownGroup.visible = true;
  }

  return { group: rig.root, rig, crownGroup, update, revealCrown };
}
