import * as THREE from 'three';
import { createGlowMaterial } from '../shaders/glow';
import { VIPER_SKINS, type CharacterSkin } from './skins';
import { Rig, type JointName } from './rig/Rig';
import { blendClips } from './rig/Clip';
import { coilClip, slitherClip } from '../entities/vineViperClips';
import { applyClimbPose } from './climbPose';
import type { PlayableCharacter } from './PlayableCharacter';

const FANG_COLOR = 0xf2ead8;
const TONGUE_COLOR = 0x7a1220;

const BODY_JOINTS: JointName[] = ['spine', 'tail0', 'tail1', 'tail2', 'tail3', 'tail4'];
const SEGMENT_LENGTH = 0.24;

// A slither reads as real locomotion well below the fox's/bear's speed scale — the whole-body
// travelling wave is already fast-looking at low moveSpeed, so this stays lower than either.
const WALK_SPEED_FOR_FULL_BLEND = 4;

/** Builds the player-controlled Vine Viper — same ground-hugging anatomy as the enemy version
 * (createVineViper.ts), driven by the real travelling-wave slither clip that already exists for
 * the enemy's locomotion (blended against the coiled-idle clip by moveSpeed, same pattern as
 * createFox.ts's idle/walk blend), plus a chest glow core and coronation crown. */
export function createPlayableViper(skin: CharacterSkin = VIPER_SKINS[0]): PlayableCharacter {
  const rig = new Rig(['root', 'spine', 'head', 'jaw', ...BODY_JOINTS.filter((j) => j !== 'spine')]);
  rig.attach('spine', 'root');
  rig.attach('head', 'spine');
  rig.attach('jaw', 'head');
  rig.attach('tail0', 'spine');
  rig.attach('tail1', 'tail0');
  rig.attach('tail2', 'tail1');
  rig.attach('tail3', 'tail2');
  rig.attach('tail4', 'tail3');

  rig.setLocalPosition('spine', 0, 0.12, 0);
  rig.setLocalPosition('head', 0, 0.02, 0.14);
  rig.setLocalPosition('jaw', 0, -0.015, 0.085);
  rig.setLocalPosition('tail0', 0, 0, -SEGMENT_LENGTH);
  rig.setLocalPosition('tail1', 0, 0, -SEGMENT_LENGTH);
  rig.setLocalPosition('tail2', 0, 0, -SEGMENT_LENGTH * 0.9);
  rig.setLocalPosition('tail3', 0, 0, -SEGMENT_LENGTH * 0.85);
  rig.setLocalPosition('tail4', 0, 0, -SEGMENT_LENGTH * 0.8);
  rig.captureBasePose();

  const bodyMat = new THREE.MeshStandardMaterial({ color: skin.furColor, flatShading: true, roughness: 0.55 });
  const darkMat = new THREE.MeshStandardMaterial({ color: skin.furDark, flatShading: true, roughness: 0.6 });
  const fangMat = new THREE.MeshStandardMaterial({ color: FANG_COLOR, flatShading: true, roughness: 0.25 });
  const tongueMat = new THREE.MeshStandardMaterial({ color: TONGUE_COLOR, flatShading: true, roughness: 0.5 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: skin.glowColor, emissive: skin.glowColor, emissiveIntensity: 1.2, flatShading: true });
  const glowCoreMat = createGlowMaterial({ color: skin.glowColor, rimColor: skin.glowRim, intensity: 0.55, fresnelPower: 1.4, pulseSpeed: 2.2 });

  const add = (joint: JointName, name: string, mesh: THREE.Mesh): void => {
    mesh.name = name;
    mesh.castShadow = true;
    rig.getJoint(joint).add(mesh);
  };

  const VIPER_HITBOX_RADIUS = 0.22;
  BODY_JOINTS.forEach((joint, i) => {
    const t = i / (BODY_JOINTS.length - 1);
    const radius = VIPER_HITBOX_RADIUS * (1 - t * 0.65);
    const seg = new THREE.Mesh(new THREE.CapsuleGeometry(radius, SEGMENT_LENGTH, 2, 8), i % 2 === 0 ? bodyMat : darkMat);
    seg.rotation.x = Math.PI / 2;
    add(joint, `viper-body-${joint}`, seg);
  });

  // Belly-scale glow core, riding the spine segment — this species has no separate "chest," the
  // spine capsule IS the front third of the body, so the glow core sits just under it instead of
  // as a distinct chest mesh the way the fox/bear have one.
  const chestCore = new THREE.Mesh(new THREE.IcosahedronGeometry(0.045, 0), glowCoreMat);
  chestCore.position.set(0, -0.06, 0.05);
  rig.getJoint('spine').add(chestCore);
  const chestLight = new THREE.PointLight(skin.glowColor, 0.2, 2.5, 2);
  chestLight.position.copy(chestCore.position);
  rig.getJoint('spine').add(chestLight);

  const head = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 4), bodyMat);
  head.rotation.x = Math.PI / 2;
  head.scale.set(1.15, 0.55, 1);
  add('head', 'viper-head', head);

  const eyeGeo = new THREE.SphereGeometry(0.03, 8, 8);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.scale.set(0.35, 1, 0.85);
  eyeL.position.set(-0.06, 0.02, 0.05);
  add('head', 'viper-eye-l', eyeL);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.scale.copy(eyeL.scale);
  eyeR.position.set(0.06, 0.02, 0.05);
  add('head', 'viper-eye-r', eyeR);

  const jaw = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.13, 4), darkMat);
  jaw.rotation.x = Math.PI / 2;
  jaw.scale.set(1, 0.5, 1);
  add('jaw', 'viper-jaw', jaw);

  const fangGeo = new THREE.ConeGeometry(0.012, 0.075, 5);
  const fangL = new THREE.Mesh(fangGeo, fangMat);
  fangL.rotation.x = 2.4;
  fangL.position.set(-0.028, -0.01, 0.075);
  add('jaw', 'viper-fang-l', fangL);
  const fangR = new THREE.Mesh(fangGeo, fangMat);
  fangR.rotation.x = 2.4;
  fangR.position.set(0.028, -0.01, 0.075);
  add('jaw', 'viper-fang-r', fangR);

  const tongueGeo = new THREE.ConeGeometry(0.008, 0.09, 4);
  const tongueL = new THREE.Mesh(tongueGeo, tongueMat);
  tongueL.rotation.set(Math.PI / 2, 0, 0.22);
  tongueL.position.set(-0.02, -0.02, 0.11);
  add('jaw', 'viper-tongue-l', tongueL);
  const tongueR = new THREE.Mesh(tongueGeo, tongueMat);
  tongueR.rotation.set(Math.PI / 2, 0, -0.22);
  tongueR.position.set(0.02, -0.02, 0.11);
  add('jaw', 'viper-tongue-r', tongueR);

  // Same crown-on-head technique as createFox.ts/createPlayableBear.ts, scaled to this small,
  // flattened head (0.1 radius, 0.55 vertical squash) — placed above the skull, clear of the fangs.
  const crownTrimMat = new THREE.MeshStandardMaterial({ color: 0xc9973a, flatShading: true, roughness: 0.45, metalness: 0.5 });
  const crownGroup = new THREE.Group();
  const crownSpikeGeo = new THREE.ConeGeometry(0.016, 0.05, 4);
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const spike = new THREE.Mesh(crownSpikeGeo, crownTrimMat);
    spike.position.set(Math.cos(angle) * 0.065, 0.045, Math.sin(angle) * 0.065 + 0.03);
    crownGroup.add(spike);
  }
  crownGroup.visible = false;
  rig.getJoint('head').add(crownGroup);

  const shadowMesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 }),
  );
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.set(0, 0.01, -SEGMENT_LENGTH); // centered under the long body, not just the head
  rig.root.add(shadowMesh);

  rig.root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) obj.layers.set(1);
  });

  const glowMaterials = [glowCoreMat];
  let slitherTime = 0;

  function update(time: number, delta: number, moveSpeed: number, blocking = false, hurt = false, climbing = false) {
    glowMaterials.forEach((m) => {
      (m.uniforms.uTime.value as number) = time;
    });
    slitherTime += delta * THREE.MathUtils.clamp(moveSpeed / WALK_SPEED_FOR_FULL_BLEND, 0, 1.6);
    const slitherWeight = THREE.MathUtils.clamp(moveSpeed / WALK_SPEED_FOR_FULL_BLEND, 0, 1);
    blendClips(rig, coilClip, time, slitherClip, slitherTime, slitherWeight);
    // Real Block pose: a snake doesn't crouch — a real defensive brace is rearing back tighter,
    // head pulled up ready to strike. Reuses the exact same rear-back head pose strikeClip's own
    // telegraph keyframe authors (vineViperClips.ts), rather than inventing a second real pose
    // for the same physical motion.
    if (blocking) {
      rig.setLocalRotation('head', -0.55, 0, 0);
      rig.applyPositionOffset('head', 0, 0.025, -0.05);
    }
    // Real hurt-flinch, applied after blocking: a struck snake recoils its head sharply DOWN and
    // AWAY, the opposite motion from the block's own upward rear-back threat pose — real
    // pain-recoil vs. real threat-display read as visibly different poses, not just a scaled copy.
    if (hurt) {
      rig.setLocalRotation('head', 0.35, 0, 0);
      rig.applyPositionOffset('head', 0, -0.02, -0.03);
    }
    if (climbing) applyClimbPose(rig, time);
  }

  function revealCrown() {
    crownGroup.visible = true;
  }

  return { group: rig.root, rig, crownGroup, update, revealCrown };
}
