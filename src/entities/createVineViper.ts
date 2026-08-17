import * as THREE from 'three';
import { Rig, type JointName } from '../scene/rig/Rig';
import { applyClipToRig } from '../scene/rig/Clip';
import { coilClip, strikeClip, slitherClip } from './vineViperClips';
import { EnemyAI, type AiState } from './EnemyAI';
import type { Combatant } from '../game/Combat';
import type { Capsule } from '../game/collision';
import { computeStrikeRange } from '../game/EnemyChase';

// Deep green/black banding — deliberately dark and low-saturation so the viper reads as
// ground-hugging camouflage, never a recolor of the owl's greys or the bear's warm browns.
const VIPER_GREEN = 0x224a26;
const VIPER_DARK = 0x0e150e;
const VIPER_EYE_COLOR = 0xd8ff4a; // venomous yellow-green slit-pupil glow
const VIPER_FANG_COLOR = 0xf2ead8; // ivory
const VIPER_TONGUE_COLOR = 0x7a1220; // dark red, forked

const VIPER_HP = 26;
const VIPER_HITBOX_RADIUS = 0.22;
// spine -> spine + 0.25m: low to the ground on purpose (see design doc) — do NOT copy the bear's
// 0.5m vertical span, it would let this ground-hugging body hit a player standing on a ledge above.
const VIPER_HITBOX_HEIGHT = 0.25;
// The fastest attack in the game: a real pit viper closes its strike in well under 100ms.
const VIPER_TELEGRAPH_SECONDS = 0.32;

const BODY_JOINTS: JointName[] = ['spine', 'tail0', 'tail1', 'tail2', 'tail3', 'tail4'];
const SEGMENT_LENGTH = 0.24; // spacing between successive body joints down the chain

export interface VineViper {
  group: THREE.Group;
  ai: EnemyAI;
  combatant: Combatant;
  update(time: number, delta: number, distanceToPlayer: number): void;
}

export function createVineViper(): VineViper {
  const rig = new Rig(['root', 'spine', 'head', 'jaw', ...BODY_JOINTS.filter((j) => j !== 'spine')]);
  rig.attach('spine', 'root');
  rig.attach('head', 'spine');
  rig.attach('jaw', 'head');
  // The body chain IS the tail chain — this species has no separate tail, the whole low-slung
  // body is spine -> tail0 -> tail1 -> tail2 -> tail3 -> tail4, built exactly the way createFox.ts
  // chains its tail joints.
  rig.attach('tail0', 'spine');
  rig.attach('tail1', 'tail0');
  rig.attach('tail2', 'tail1');
  rig.attach('tail3', 'tail2');
  rig.attach('tail4', 'tail3');

  // Lying low to the ground, not upright: spine sits at y ~= 0.12, and the whole chain trails
  // straight back along -Z with the head reaching forward along +Z.
  rig.setLocalPosition('spine', 0, 0.12, 0);
  rig.setLocalPosition('head', 0, 0.02, 0.14);
  rig.setLocalPosition('jaw', 0, -0.015, 0.085);
  rig.setLocalPosition('tail0', 0, 0, -SEGMENT_LENGTH);
  rig.setLocalPosition('tail1', 0, 0, -SEGMENT_LENGTH);
  rig.setLocalPosition('tail2', 0, 0, -SEGMENT_LENGTH * 0.9);
  rig.setLocalPosition('tail3', 0, 0, -SEGMENT_LENGTH * 0.85);
  rig.setLocalPosition('tail4', 0, 0, -SEGMENT_LENGTH * 0.8);
  // Exactly once, after the last setLocalPosition and before any clip runs — clips author
  // position keyframes as offsets from this snapshot (see Rig.captureBasePose).
  rig.captureBasePose();

  const greenMat = new THREE.MeshStandardMaterial({ color: VIPER_GREEN, flatShading: true, roughness: 0.55 });
  const darkMat = new THREE.MeshStandardMaterial({ color: VIPER_DARK, flatShading: true, roughness: 0.6 });
  const fangMat = new THREE.MeshStandardMaterial({ color: VIPER_FANG_COLOR, flatShading: true, roughness: 0.25 });
  const tongueMat = new THREE.MeshStandardMaterial({ color: VIPER_TONGUE_COLOR, flatShading: true, roughness: 0.5 });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: VIPER_EYE_COLOR, emissive: VIPER_EYE_COLOR, emissiveIntensity: 1.2, flatShading: true,
  });

  // Every anatomy mesh is named. Nothing in the renderer needs the names — the createVineViper
  // test asserts each real part exists by name, the same guard createCanopyOwl's test uses against
  // the "one capsule + one icosahedron reads as a dark shapeless rock" regression (5b812b5).
  const add = (joint: JointName, name: string, mesh: THREE.Mesh): void => {
    mesh.name = name;
    mesh.castShadow = true;
    rig.getJoint(joint).add(mesh);
  };

  // Body: a tapering chain of capsules along the spine->tail0..tail4 run, alternating deep-green
  // and near-black bands. Capsules default to a Y-long axis; rotating +90 deg about X lays that
  // axis along local +Z, which is the direction each joint's chain offset already points.
  BODY_JOINTS.forEach((joint, i) => {
    const t = i / (BODY_JOINTS.length - 1);
    const radius = VIPER_HITBOX_RADIUS * (1 - t * 0.65); // tapers toward a slender tail tip
    const seg = new THREE.Mesh(new THREE.CapsuleGeometry(radius, SEGMENT_LENGTH, 2, 8), i % 2 === 0 ? greenMat : darkMat);
    seg.rotation.x = Math.PI / 2;
    add(joint, `viper-body-${joint}`, seg);
  });

  // Head: broad, flat, triangular — a real pit-viper head is wide and wedge-shaped, not a round
  // bird skull. A 4-sided cone flattened vertically reads as that wedge silhouette.
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 4), greenMat);
  head.rotation.x = Math.PI / 2;
  head.scale.set(1.15, 0.55, 1);
  add('head', 'viper-head', head);

  // Slit eyes: emissive, flattened into a vertical ellipse rather than a round pupil — the single
  // most identifying feature that separates a pit viper's face from any round-eyed prey animal.
  const eyeGeo = new THREE.SphereGeometry(0.03, 8, 8);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.scale.set(0.35, 1, 0.85);
  eyeL.position.set(-0.06, 0.02, 0.05);
  add('head', 'viper-eye-l', eyeL);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.scale.copy(eyeL.scale);
  eyeR.position.set(0.06, 0.02, 0.05);
  add('head', 'viper-eye-r', eyeR);

  // Jaw: the lower mandible, a smaller flattened wedge that hinges open on the strike clip.
  const jaw = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.13, 4), darkMat);
  jaw.rotation.x = Math.PI / 2;
  jaw.scale.set(1, 0.5, 1);
  add('jaw', 'viper-jaw', jaw);

  // Fangs: two small cones on the jaw, curled down and forward — hidden inside the mouth until
  // the strike clip's jaw gape opens them into view.
  const fangGeo = new THREE.ConeGeometry(0.012, 0.075, 5);
  const fangL = new THREE.Mesh(fangGeo, fangMat);
  fangL.rotation.x = 2.4; // curled down-and-forward
  fangL.position.set(-0.028, -0.01, 0.075);
  add('jaw', 'viper-fang-l', fangL);
  const fangR = new THREE.Mesh(fangGeo, fangMat);
  fangR.rotation.x = 2.4;
  fangR.position.set(0.028, -0.01, 0.075);
  add('jaw', 'viper-fang-r', fangR);

  // Forked tongue: two thin cone tips splayed apart from the mouth — the fork is the whole point,
  // a single tongue tip would read as a stray whisker.
  const tongueGeo = new THREE.ConeGeometry(0.008, 0.09, 4);
  const tongueL = new THREE.Mesh(tongueGeo, tongueMat);
  tongueL.rotation.set(Math.PI / 2, 0, 0.22);
  tongueL.position.set(-0.02, -0.02, 0.11);
  add('jaw', 'viper-tongue-l', tongueL);
  const tongueR = new THREE.Mesh(tongueGeo, tongueMat);
  tongueR.rotation.set(Math.PI / 2, 0, -0.22);
  tongueR.position.set(0.02, -0.02, 0.11);
  add('jaw', 'viper-tongue-r', tongueR);

  const ai = new EnemyAI();
  const combatant: Combatant = {
    hp: VIPER_HP,
    maxHp: VIPER_HP,
    hitbox: { start: new THREE.Vector3(), end: new THREE.Vector3(), radius: VIPER_HITBOX_RADIUS },
  };

  function syncHitbox() {
    const worldPos = new THREE.Vector3();
    rig.getJoint('spine').getWorldPosition(worldPos);
    combatant.hitbox.start.copy(worldPos);
    combatant.hitbox.end.copy(worldPos).add(new THREE.Vector3(0, VIPER_HITBOX_HEIGHT, 0));
  }

  // -1 = "no strike in progress"; the strike clip's own clock is lazily started the first frame
  // the viper is actually close enough to strike (see below), separately from ai.state.
  let strikeStartTime = -1;
  let prevAiState: AiState = 'idle';

  function update(time: number, delta: number, distanceToPlayer: number) {
    // Both AI tunables are assigned BEFORE ai.update() in the same frame — the exact ordering
    // rule createCanopyOwl's update() documents; assigning them after leaves the state machine
    // advancing one frame on stale values.
    ai.telegraphSeconds = VIPER_TELEGRAPH_SECONDS;
    // A real snake re-coils before it can strike again — the fastest telegraph in the game (see
    // VIPER_TELEGRAPH_SECONDS) is balanced by a real recovery cost, not a spammable poke.
    // Recovery-only, same safe pattern as every other species: strikeClip's own duration already
    // matches VIPER_TELEGRAPH_SECONDS + the default attack window exactly.
    ai.recoverSeconds = 1.0;
    ai.strikeRange = computeStrikeRange(combatant.hitbox.radius);
    ai.update(distanceToPlayer, delta);

    // A fresh telegraph cycle invalidates any previous strike clock — otherwise a second strike
    // after 'recovering' would reuse a stale, already-clamped timer and never replay the rear-back.
    if (ai.state === 'telegraph' && prevAiState !== 'telegraph') strikeStartTime = -1;

    const isCoiled = ai.state === 'idle' || ai.state === 'aggro';
    if (isCoiled) {
      applyClipToRig(rig, coilClip, time);
    } else {
      const inStrikeRange = distanceToPlayer <= ai.strikeRange;
      // Real ambush behaviour: still closing the gap (telegraph, but not yet in range) is
      // locomotion — the slither clip — not the coiled wind-up. Once in range (or once the strike
      // has actually launched: 'attacking'/'recovering') it's the strike clip's rear-back/snap.
      if (ai.state === 'telegraph' && !inStrikeRange) {
        applyClipToRig(rig, slitherClip, time);
        strikeStartTime = -1; // still approaching; keep the strike clock unset
      } else {
        if (strikeStartTime < 0) strikeStartTime = time;
        applyClipToRig(rig, strikeClip, time - strikeStartTime);
      }
    }
    prevAiState = ai.state;
    rig.root.updateMatrixWorld(true);
    syncHitbox();
  }

  return { group: rig.root, ai, combatant, update };
}

export function getVineViperHitbox(viper: VineViper): Capsule {
  return viper.combatant.hitbox;
}
