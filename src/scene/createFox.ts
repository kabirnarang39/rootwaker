import * as THREE from 'three';
import { createGlowMaterial } from '../shaders/glow';
import { SKINS, type FoxSkin } from './skins';
import { Rig } from './rig/Rig';
import { blendClips } from './rig/Clip';
import { walkClip, idleClip } from './foxClips';
import type { PlayableCharacter } from './PlayableCharacter';

export type Fox = PlayableCharacter;

function furMaterial(color: THREE.ColorRepresentation) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.75, metalness: 0.05 });
}

const WALK_SPEED_FOR_FULL_BLEND = 6; // moveSpeed at/above this = fully walkClip, 0 = fully idleClip
// Real Block pose: a real defensive brace reads as lowering the whole front — spine pitches
// forward/down, head tucks further still (a fox lowers its head behind its own raised guard).
const BLOCK_SPINE_PITCH = 0.35;
const BLOCK_HEAD_PITCH = 0.25;

/** Builds a custom stylized low-poly fox-spirit on the shared Rig/Clip system — no external model. */
export function createFox(skin: FoxSkin = SKINS[0]): Fox {
  const rig = new Rig([
    'root', 'spine', 'head', 'jaw',
    'shoulderL', 'shoulderR', 'forepawL', 'forepawR',
    'hipL', 'hipR', 'hindpawL', 'hindpawR',
    'tail0', 'tail1', 'tail2', 'tail3', 'tail4',
  ]);
  rig.attach('spine', 'root');
  rig.attach('head', 'spine');
  rig.attach('jaw', 'head');
  for (const side of ['L', 'R'] as const) {
    rig.attach(`shoulder${side}`, 'spine');
    rig.attach(`forepaw${side}`, `shoulder${side}`);
    rig.attach(`hip${side}`, 'root');
    rig.attach(`hindpaw${side}`, `hip${side}`);
  }
  rig.attach('tail0', 'root');
  rig.attach('tail1', 'tail0');
  rig.attach('tail2', 'tail1');
  rig.attach('tail3', 'tail2');
  rig.attach('tail4', 'tail3');

  rig.setLocalPosition('spine', 0, 0.55, 0);
  rig.setLocalPosition('head', 0, 0.23, 0.45);
  rig.setLocalPosition('jaw', 0, -0.05, 0.27);
  rig.setLocalPosition('shoulderL', -0.16, -0.05, 0.24);
  rig.setLocalPosition('shoulderR', 0.16, -0.05, 0.24);
  rig.setLocalPosition('forepawL', 0, -0.26, 0.04);
  rig.setLocalPosition('forepawR', 0, -0.26, 0.04);
  rig.setLocalPosition('hipL', -0.16, 0.24, -0.22);
  rig.setLocalPosition('hipR', 0.16, 0.24, -0.22);
  rig.setLocalPosition('hindpawL', 0, 0, 0);
  rig.setLocalPosition('hindpawR', 0, 0, 0);
  rig.setLocalPosition('tail0', 0, 0.07, -0.42);
  for (const t of ['tail1', 'tail2', 'tail3', 'tail4'] as const) rig.setLocalPosition(t, 0, 0.22, 0);
  rig.captureBasePose();

  const fur = furMaterial(skin.furColor);
  const furDark = furMaterial(skin.furDark);
  const belly = furMaterial(skin.bellyColor);
  const glowShellMat = createGlowMaterial({ color: skin.glowColor, rimColor: skin.glowRim, intensity: 0.35, fresnelPower: 3.2 });
  const glowCoreMat = createGlowMaterial({ color: skin.glowColor, rimColor: skin.glowRim, intensity: 0.55, fresnelPower: 1.4, pulseSpeed: 2.2 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.55, 2, 6), fur);
  torso.rotation.z = Math.PI / 2;
  torso.castShadow = true;
  rig.getJoint('spine').add(torso);

  const torsoShell = new THREE.Mesh(torso.geometry.clone(), glowShellMat);
  torsoShell.rotation.copy(torso.rotation);
  torsoShell.scale.setScalar(1.06);
  rig.getJoint('spine').add(torsoShell);

  const bellyMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.5, 2, 6), belly);
  bellyMesh.rotation.z = Math.PI / 2;
  bellyMesh.position.set(0, -0.13, 0.08);
  rig.getJoint('spine').add(bellyMesh);

  const chestCore = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 0), glowCoreMat);
  chestCore.position.set(0, -0.09, 0.22);
  rig.getJoint('spine').add(chestCore);
  const chestLight = new THREE.PointLight(skin.glowColor, 0.25, 3.5, 2);
  chestLight.position.copy(chestCore.position);
  rig.getJoint('spine').add(chestLight);

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 0), fur);
  head.scale.set(1, 0.92, 1.15);
  head.castShadow = true;
  rig.getJoint('head').add(head);

  const headShell = new THREE.Mesh(head.geometry.clone(), glowShellMat);
  headShell.scale.copy(head.scale).multiplyScalar(1.08);
  rig.getJoint('head').add(headShell);

  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.32, 5), furDark);
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, 0, 0);
  rig.getJoint('jaw').add(snout);

  const eyeGeo = new THREE.SphereGeometry(0.035, 6, 6);
  const eyeL = new THREE.Mesh(eyeGeo, glowCoreMat);
  eyeL.position.set(-0.1, 0.04, 0.18);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.1;
  rig.getJoint('head').add(eyeL, eyeR);

  const earGeo = new THREE.ConeGeometry(0.13, 0.3, 4);
  const earL = new THREE.Mesh(earGeo, fur);
  earL.position.set(-0.16, 0.24, -0.05);
  earL.rotation.z = 0.25;
  const earR = earL.clone();
  earR.position.x = 0.16;
  earR.rotation.z = -0.25;
  rig.getJoint('head').add(earL, earR);

  const earInnerGeo = new THREE.ConeGeometry(0.07, 0.2, 4);
  const earInnerL = new THREE.Mesh(earInnerGeo, furDark);
  earInnerL.position.set(-0.16, 0.22, 0.01);
  earInnerL.rotation.z = 0.25;
  const earInnerR = earInnerL.clone();
  earInnerR.position.x = 0.16;
  earInnerR.rotation.z = -0.25;
  rig.getJoint('head').add(earInnerL, earInnerR);

  // Coronation crown, hidden until revealCrown() — same ring-of-cones technique as
  // createMountainKing.ts's crown (radius 0.05/height 0.16 spikes, ring radius 0.22, y 0.34 on
  // that king's 0.36-radius head), scaled down 2/3 to match this fox head's 0.24 radius so it
  // sits on the skull instead of floating clear of it or clipping through at king-sized numbers.
  const crownTrimMat = new THREE.MeshStandardMaterial({ color: 0xc9973a, flatShading: true, roughness: 0.45, metalness: 0.5 });
  const crownGroup = new THREE.Group();
  const crownSpikeGeo = new THREE.ConeGeometry(0.033, 0.107, 4);
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const spike = new THREE.Mesh(crownSpikeGeo, crownTrimMat);
    spike.position.set(Math.cos(angle) * 0.147, 0.227, Math.sin(angle) * 0.147);
    crownGroup.add(spike);
  }
  crownGroup.visible = false; // revealed only via revealCrown(), on the coronation ending beat
  rig.getJoint('head').add(crownGroup);

  for (const side of ['L', 'R'] as const) {
    const forepaw = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.48, 5), furDark);
    forepaw.position.y = 0;
    rig.getJoint(`forepaw${side}`).add(forepaw);
    const hindpaw = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.48, 5), furDark);
    hindpaw.position.y = 0;
    rig.getJoint(`hindpaw${side}`).add(hindpaw);
  }

  const tailJoints = ['tail0', 'tail1', 'tail2', 'tail3', 'tail4'] as const;
  tailJoints.forEach((joint, i) => {
    const t = i / (tailJoints.length - 1);
    const radius = 0.11 * (1 - t * 0.75);
    const isTip = i === tailJoints.length - 1;
    const mat = isTip ? glowCoreMat : i > tailJoints.length - 3 ? furDark : fur;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.8, radius, 0.22, 5), mat);
    seg.position.y = 0.11;
    seg.rotation.x = -0.28;
    rig.getJoint(joint).add(seg);
  });

  const shadowMesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }),
  );
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.01;
  rig.root.add(shadowMesh);

  // Own-model exclusion for first-person view: no amount of eye-position tuning reliably clears
  // wide/glowing parts like the ear cones and headShell at close range in a wide FOV — even
  // clear of every mesh's bounding box, they can still fill the frame edges. Camera layer 1 is
  // reserved for "the player's own body"; CameraRig disables it only in foxEye mode.
  //
  // Meshes only — NOT lights. THREE.WebGLRenderer's projectObject() gates BOTH mesh visibility
  // AND light contribution on `object.layers.test(camera.layers)` (verified directly against
  // three.cjs's source, not assumed): sweeping the chestLight onto layer 1 too would silently
  // drop it from illuminating the rest of the scene the instant the main camera lost layer 1 in
  // foxEye — the world's lighting would visibly shift depending on view mode, not just the fox's
  // own visibility. (A shadow camera's own `.layers` property, by contrast, is never read by the
  // shadow pass at all — that gate also uses the main camera — so no equivalent fix is needed or
  // possible there via layers; foxEye simply has no self-shadow, the standard FPS convention.)
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
    blendClips(rig, idleClip, time, walkClip, walkTime, walkWeight);
    // Real Block (see Game.ts): a braced, lowered stance overlaid on top of the normal blend —
    // not a separate authored clip, just a real forward spine pitch + head duck, applied AFTER
    // the idle/walk blend so it always wins (blockClips's own convention: later calls override
    // earlier ones on the joints they touch, same rule the eat-ritual overlay already relies on).
    if (blocking) {
      rig.setLocalRotation('spine', BLOCK_SPINE_PITCH, 0, 0);
      rig.setLocalRotation('head', BLOCK_HEAD_PITCH, 0, 0);
    }
  }

  function revealCrown() {
    crownGroup.visible = true;
  }

  return { group: rig.root, rig, crownGroup, update, revealCrown };
}
