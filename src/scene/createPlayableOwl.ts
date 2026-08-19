import * as THREE from 'three';
import { createGlowMaterial } from '../shaders/glow';
import { OWL_SKINS, type CharacterSkin } from './skins';
import { Rig, type JointName } from './rig/Rig';
import { blendClips, applyClipToRig } from './rig/Clip';
import { perchClip } from '../entities/canopyOwlClips';
import { hoverClip, flapClip } from './playableOwlClips';
import { applyClimbPose } from './climbPose';
import { applyAttackPose } from './attackPose';
import type { PlayableCharacter } from './PlayableCharacter';

const KERATIN_COLOR = 0x2b2620;
const FACIAL_DISC_COLOR = 0xb9ae9c;

// Real air-speed-for-full-blend, same idiom as every other species' WALK_SPEED_FOR_FULL_BLEND —
// the owl's own PlayerController.updateFly() horizontal cruise (FLY_SPEED = 6.5 m/s) is faster
// than any grounded species, so the flap clip is already at full blend well before real top speed.
const AIRSPEED_FOR_FULL_BLEND = 5.5;
const BLOCK_SPINE_PITCH = 0.3;
const BLOCK_HEAD_PITCH = 0.2;
const HURT_SPINE_RECOIL = -0.2;
const HURT_HEAD_RECOIL = -0.26;

/** Builds the player-controlled Canopy Owl — the same real anatomy as the enemy version
 * (createCanopyOwl.ts: facial disc, ear tufts, hooked beak, talons) with skin-based coloring, a
 * chest glow core matching every other playable species, a coronation crown, and real continuous
 * flight locomotion (hover<->flap, blended by airspeed) instead of the enemy's fixed perch-and-
 * dive behavior — see PlayerController's beginFly/updateFly for the actual physics this drives. */
export function createPlayableOwl(skin: CharacterSkin = OWL_SKINS[0]): PlayableCharacter {
  const rig = new Rig([
    'root', 'spine', 'head', 'jaw', 'earL', 'earR',
    'wingL', 'wingR', 'tail0',
    'hipL', 'hipR', 'hindpawL', 'hindpawR',
  ]);
  rig.attach('spine', 'root');
  rig.attach('head', 'spine');
  rig.attach('jaw', 'head');
  rig.attach('earL', 'head');
  rig.attach('earR', 'head');
  rig.attach('wingL', 'spine');
  rig.attach('wingR', 'spine');
  rig.attach('tail0', 'spine');
  for (const side of ['L', 'R'] as const) {
    rig.attach(`hip${side}`, 'spine');
    rig.attach(`hindpaw${side}`, `hip${side}`);
  }

  rig.setLocalPosition('spine', 0, 0.3, 0);
  rig.setLocalPosition('head', 0, 0.26, 0.02);
  rig.setLocalPosition('jaw', 0, -0.03, 0.11);
  rig.setLocalPosition('earL', -0.085, 0.14, 0.03);
  rig.setLocalPosition('earR', 0.085, 0.14, 0.03);
  rig.setLocalPosition('wingL', -0.15, 0.08, -0.02);
  rig.setLocalPosition('wingR', 0.15, 0.08, -0.02);
  rig.setLocalPosition('tail0', 0, -0.16, -0.2);
  rig.setLocalPosition('hipL', -0.075, -0.2, 0.03);
  rig.setLocalPosition('hipR', 0.075, -0.2, 0.03);
  rig.setLocalPosition('hindpawL', 0, -0.15, 0);
  rig.setLocalPosition('hindpawR', 0, -0.15, 0);
  rig.captureBasePose();

  const plumageMat = new THREE.MeshStandardMaterial({ color: skin.furColor, flatShading: true, roughness: 0.9 });
  const plumageDarkMat = new THREE.MeshStandardMaterial({ color: skin.furDark, flatShading: true, roughness: 0.95 });
  const discMat = new THREE.MeshStandardMaterial({ color: FACIAL_DISC_COLOR, flatShading: true, roughness: 1 });
  const keratinMat = new THREE.MeshStandardMaterial({ color: KERATIN_COLOR, flatShading: true, roughness: 0.45 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: skin.glowColor, emissive: skin.glowColor, emissiveIntensity: 1.1, flatShading: true });
  const glowShellMat = createGlowMaterial({ color: skin.glowColor, rimColor: skin.glowRim, intensity: 0.35, fresnelPower: 3.2 });
  const glowCoreMat = createGlowMaterial({ color: skin.glowColor, rimColor: skin.glowRim, intensity: 0.55, fresnelPower: 1.4, pulseSpeed: 2.2 });

  const add = (joint: JointName, name: string, mesh: THREE.Mesh): void => {
    mesh.name = name;
    mesh.castShadow = true;
    rig.getJoint(joint).add(mesh);
  };

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.2, 2, 8), plumageMat);
  add('spine', 'owl-body', body);

  const bodyShell = new THREE.Mesh(body.geometry.clone(), glowShellMat);
  bodyShell.scale.setScalar(1.06);
  rig.getJoint('spine').add(bodyShell);

  const chestCore = new THREE.Mesh(new THREE.IcosahedronGeometry(0.055, 0), glowCoreMat);
  chestCore.position.set(0, -0.05, 0.16);
  rig.getJoint('spine').add(chestCore);
  const chestLight = new THREE.PointLight(skin.glowColor, 0.2, 3, 2);
  chestLight.position.copy(chestCore.position);
  rig.getJoint('spine').add(chestLight);

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 1), plumageMat);
  head.scale.set(1, 0.95, 0.9);
  add('head', 'owl-head', head);

  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.035, 14), discMat);
  disc.rotation.x = Math.PI / 2;
  disc.position.set(0, 0.005, 0.085);
  add('head', 'owl-facial-disc', disc);

  const eyeGeo = new THREE.SphereGeometry(0.055, 8, 8);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.065, 0.025, 0.115);
  add('head', 'owl-eye-l', eyeL);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(0.065, 0.025, 0.115);
  add('head', 'owl-eye-r', eyeR);

  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.034, 0.11, 6), keratinMat);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0, 0.045);
  add('jaw', 'owl-beak', beak);
  const beakHook = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.055, 6), keratinMat);
  beakHook.rotation.x = Math.PI;
  beakHook.position.set(0, -0.035, 0.075);
  add('jaw', 'owl-beak-hook', beakHook);

  const tuftGeo = new THREE.ConeGeometry(0.033, 0.15, 4);
  const tuftL = new THREE.Mesh(tuftGeo, plumageDarkMat);
  tuftL.rotation.z = 0.35;
  add('earL', 'owl-ear-tuft-l', tuftL);
  const tuftR = new THREE.Mesh(tuftGeo, plumageDarkMat);
  tuftR.rotation.z = -0.35;
  add('earR', 'owl-ear-tuft-r', tuftR);

  for (const side of ['L', 'R'] as const) {
    const outward = side === 'L' ? 1 : -1;
    const wing = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.5, 4), plumageMat);
    wing.scale.set(0.28, 1, 1);
    wing.rotation.set(0, 0.28 * outward, (Math.PI / 2) * outward);
    wing.position.set(-0.19 * outward, -0.05, -0.02);
    add(`wing${side}`, `owl-wing-${side.toLowerCase()}`, wing);

    const primaries = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.22, 4), plumageDarkMat);
    primaries.scale.set(0.24, 1, 1);
    primaries.rotation.set(0, 0.28 * outward, (Math.PI / 2) * outward);
    primaries.position.set(-0.42 * outward, -0.12, -0.06);
    add(`wing${side}`, `owl-primaries-${side.toLowerCase()}`, primaries);
  }

  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.06, 0.3, 4), plumageDarkMat);
  tail.scale.set(1, 1, 0.18);
  tail.rotation.x = 2.2;
  tail.position.set(0, -0.06, -0.1);
  add('tail0', 'owl-tail-fan', tail);

  const legGeo = new THREE.CylinderGeometry(0.03, 0.036, 0.15, 6);
  const clawGeo = new THREE.ConeGeometry(0.015, 0.075, 4);
  for (const side of ['L', 'R'] as const) {
    const lower = side.toLowerCase();
    const leg = new THREE.Mesh(legGeo.clone(), plumageDarkMat);
    leg.position.set(0, -0.07, 0);
    add(`hip${side}`, `owl-leg-${lower}`, leg);

    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), keratinMat);
    foot.scale.set(1, 0.7, 1.2);
    add(`hindpaw${side}`, `owl-foot-${lower}`, foot);

    for (let i = 0; i < 3; i++) {
      const claw = new THREE.Mesh(clawGeo.clone(), keratinMat);
      claw.rotation.x = 1.9;
      claw.position.set((i - 1) * 0.032, -0.025, 0.045);
      add(`hindpaw${side}`, `owl-claw-${lower}-${i}`, claw);
    }
  }

  // Same crown/head-radius ratio every other species uses, scaled against this owl's own
  // 0.17-radius head.
  const crownTrimMat = new THREE.MeshStandardMaterial({ color: 0xc9973a, flatShading: true, roughness: 0.45, metalness: 0.5 });
  const crownGroup = new THREE.Group();
  const crownSpikeGeo = new THREE.ConeGeometry(0.023, 0.075, 4);
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const spike = new THREE.Mesh(crownSpikeGeo, crownTrimMat);
    spike.position.set(Math.cos(angle) * 0.1, 0.16, Math.sin(angle) * 0.1 + 0.02);
    crownGroup.add(spike);
  }
  crownGroup.visible = false;
  rig.getJoint('head').add(crownGroup);

  const shadowMesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.3, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 }),
  );
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.01;
  rig.root.add(shadowMesh);

  rig.root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) obj.layers.set(1);
  });

  const glowMaterials = [glowShellMat, glowCoreMat];
  let airTime = 0;

  function update(
    time: number,
    delta: number,
    moveSpeed: number,
    blocking = false,
    hurt = false,
    climbing = false,
    attacking = false,
    flying = false,
  ) {
    glowMaterials.forEach((m) => {
      (m.uniforms.uTime.value as number) = time;
    });
    if (flying) {
      // Real continuous flight locomotion: hover<->flap, blended by airspeed — the exact same
      // idiom every grounded species uses for idle<->walk, just airborne.
      airTime += delta * THREE.MathUtils.clamp(moveSpeed / AIRSPEED_FOR_FULL_BLEND, 0, 1.6);
      const flapWeight = THREE.MathUtils.clamp(moveSpeed / AIRSPEED_FOR_FULL_BLEND, 0, 1);
      blendClips(rig, hoverClip, time, flapClip, airTime, flapWeight);
    } else {
      // A real owl barely walks — no distinct ground gait is worth authoring, the same perched
      // stillness the enemy version already uses covers grounded idle/shuffling honestly.
      applyClipToRig(rig, perchClip, time);
    }
    if (blocking) {
      rig.setLocalRotation('spine', BLOCK_SPINE_PITCH, 0, 0);
      rig.setLocalRotation('head', BLOCK_HEAD_PITCH, 0, 0);
    }
    if (hurt) {
      rig.setLocalRotation('spine', HURT_SPINE_RECOIL, 0, 0);
      rig.setLocalRotation('head', HURT_HEAD_RECOIL, 0, 0);
    }
    if (climbing) applyClimbPose(rig, time);
    if (attacking) applyAttackPose(rig);
  }

  function revealCrown() {
    crownGroup.visible = true;
  }

  return { group: rig.root, rig, crownGroup, update, revealCrown };
}
