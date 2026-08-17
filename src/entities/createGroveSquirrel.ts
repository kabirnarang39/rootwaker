import * as THREE from 'three';
import { Rig, type JointName } from '../scene/rig/Rig';
import { blendClips } from '../scene/rig/Clip';
import { forageClip, alertClip } from './groveSquirrelClips';
import { WildlifeAI } from './WildlifeAI';

// Real intermittent locomotion (see design doc): a fleeing squirrel darts in short bursts and
// freezes to scan, it never sprints in one continuous line the way the hare does. 4.0 m/s is the
// burst speed; during a freeze window it moves at 0.
const BURST_SPEED = 4.0; // m/s during a burst window
const BURST_SECONDS = 0.45;
const FREEZE_SECONDS = 0.25;
const CYCLE_SECONDS = BURST_SECONDS + FREEZE_SECONDS;

// Fur/anatomy colours deliberately grey-brown and distinct from the hare's warmer 0x8a7256/0xb89a78
// so the two ambient prey species never read as recolors of each other.
const SQUIRREL_FUR = 0x7d6b4e;
const SQUIRREL_LIGHT = 0xc7b58c; // cheeks, ears, tail highlight
const SQUIRREL_EYE_COLOR = 0x120d0a; // dark bead — no emissive shine, unlike the nocturnal predators
const SQUIRREL_TOOTH_COLOR = 0xf2ead8; // ivory chisel incisor

export interface GroveSquirrel {
  group: THREE.Group;
  ai: WildlifeAI;
  position: THREE.Vector3;
  update(time: number, delta: number, distanceToPlayer: number, approachSpeed: number): void;
  fleeStep(delta: number, awayFromDir: THREE.Vector3): void;
}

export function createGroveSquirrel(spawnPosition: THREE.Vector3): GroveSquirrel {
  const rig = new Rig([
    'root', 'spine', 'head', 'earL', 'earR',
    'tail0', 'tail1', 'tail2',
    'hindpawL', 'hindpawR', 'forepawL', 'forepawR',
  ]);
  rig.attach('spine', 'root');
  rig.attach('head', 'spine');
  rig.attach('earL', 'head');
  rig.attach('earR', 'head');
  rig.attach('tail0', 'spine');
  rig.attach('tail1', 'tail0');
  rig.attach('tail2', 'tail1');
  rig.attach('hindpawL', 'root');
  rig.attach('hindpawR', 'root');
  rig.attach('forepawL', 'spine');
  rig.attach('forepawR', 'spine');

  rig.setLocalPosition('spine', 0, 0.13, 0);
  rig.setLocalPosition('head', 0, 0.11, 0.1);
  rig.setLocalPosition('earL', -0.025, 0.07, 0);
  rig.setLocalPosition('earR', 0.025, 0.07, 0);
  // The bushy tail curls up over the back rather than trailing flat behind, like the fox's tail
  // does — each successive joint climbs and arcs forward slightly to form that classic curl.
  rig.setLocalPosition('tail0', 0, 0.02, -0.09);
  rig.setLocalPosition('tail1', 0, 0.06, -0.04);
  rig.setLocalPosition('tail2', 0, 0.05, -0.02);
  rig.setLocalPosition('hindpawL', -0.045, 0.04, -0.08);
  rig.setLocalPosition('hindpawR', 0.045, 0.04, -0.08);
  rig.setLocalPosition('forepawL', -0.035, -0.03, 0.06);
  rig.setLocalPosition('forepawR', 0.035, -0.03, 0.06);
  // Exactly once, after the last setLocalPosition and before any clip runs — clips author position
  // keyframes as offsets from this snapshot (see Rig.captureBasePose).
  rig.captureBasePose();

  const furMat = new THREE.MeshStandardMaterial({ color: SQUIRREL_FUR, flatShading: true, roughness: 0.9 });
  const lightMat = new THREE.MeshStandardMaterial({ color: SQUIRREL_LIGHT, flatShading: true, roughness: 0.85 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: SQUIRREL_EYE_COLOR, flatShading: true, roughness: 0.3 });
  const toothMat = new THREE.MeshStandardMaterial({ color: SQUIRREL_TOOTH_COLOR, flatShading: true, roughness: 0.35 });

  // Every anatomy mesh is named — the createGroveSquirrel test asserts each real part exists by
  // name, the same guard createCanopyOwl/createVineViper use against the "one capsule + one
  // icosahedron reads as a dark shapeless rock" regression (5b812b5).
  const add = (joint: JointName, name: string, mesh: THREE.Mesh): void => {
    mesh.name = name;
    mesh.castShadow = true;
    rig.getJoint(joint).add(mesh);
  };

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.1, 2, 6), furMat);
  body.rotation.z = Math.PI / 2;
  add('spine', 'squirrel-body', body);

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.055, 0), furMat);
  add('head', 'squirrel-head', head);

  // Puffed cheeks — a squirrel's most identifying facial feature, stuffed with foraged food.
  const cheekGeo = new THREE.SphereGeometry(0.022, 6, 6);
  const cheekL = new THREE.Mesh(cheekGeo, lightMat);
  cheekL.position.set(-0.045, -0.01, 0.02);
  add('head', 'squirrel-cheek-l', cheekL);
  const cheekR = new THREE.Mesh(cheekGeo, lightMat);
  cheekR.position.set(0.045, -0.01, 0.02);
  add('head', 'squirrel-cheek-r', cheekR);

  // Chisel-tooth muzzle: a short forward-tapering snout with a single flat ivory incisor at the
  // tip — a round ball head alone reads as a mouse, not a rodent with gnawing teeth.
  const muzzle = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.05, 6), furMat);
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.set(0, -0.015, 0.045);
  add('head', 'squirrel-muzzle', muzzle);

  const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.016, 0.006), toothMat);
  tooth.position.set(0, -0.028, 0.065);
  add('head', 'squirrel-tooth', tooth);

  // Small round ears — flattened spheres, deliberately not the hare's tall cones, so the two prey
  // silhouettes read distinctly even at a glance.
  const earGeo = new THREE.SphereGeometry(0.018, 8, 8);
  const earL = new THREE.Mesh(earGeo, lightMat);
  earL.scale.set(1, 1.1, 0.6);
  add('earL', 'squirrel-ear-l', earL);
  const earR = new THREE.Mesh(earGeo, lightMat);
  earR.scale.copy(earL.scale);
  add('earR', 'squirrel-ear-r', earR);

  // Dark bead eyes — plain, unlit, no emissive glow (unlike the nocturnal predators' eye-shine).
  const eyeGeo = new THREE.SphereGeometry(0.012, 6, 6);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.032, 0.01, 0.04);
  add('head', 'squirrel-eye-l', eyeL);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(0.032, 0.01, 0.04);
  add('head', 'squirrel-eye-r', eyeR);

  const legGeo = new THREE.CylinderGeometry(0.01, 0.013, 0.065, 5);
  for (const joint of ['hindpawL', 'hindpawR', 'forepawL', 'forepawR'] as const) {
    const leg = new THREE.Mesh(legGeo.clone(), furMat);
    leg.position.y = -0.032;
    add(joint, `squirrel-leg-${joint}`, leg);
  }

  // The bushy tail: three segments that get WIDER toward the tip — the opposite taper from the
  // fox's tail (createFox.ts narrows toward its tip), because a real squirrel tail is fluffiest at
  // the end, not the base.
  const tailRadii: [number, number][] = [
    [0.02, 0.032], // tail0: base radius, tip radius
    [0.032, 0.045],
    [0.045, 0.052],
  ];
  (['tail0', 'tail1', 'tail2'] as const).forEach((joint, i) => {
    const [r0, r1] = tailRadii[i];
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, 0.06, 6), i === 2 ? lightMat : furMat);
    seg.rotation.x = -Math.PI / 3; // arcing up and forward over the back
    add(joint, `squirrel-tail-${joint}`, seg);
  });

  rig.root.position.copy(spawnPosition);

  const ai = new WildlifeAI();
  const position = spawnPosition.clone();
  let alertTime = 0;
  let burstCycleTime = 0;

  function update(time: number, delta: number, distanceToPlayer: number, approachSpeed: number) {
    ai.update(distanceToPlayer, approachSpeed, delta);
    // Both 'alert' and 'fleeing' show the upright freeze + tail-flick pose — the squirrel keeps
    // tail-flagging throughout flight, not just while first spotting the threat (see design doc).
    if (ai.state !== 'graze') {
      alertTime += delta;
      blendClips(rig, forageClip, time, alertClip, alertTime, 1);
    } else {
      alertTime = 0;
      blendClips(rig, forageClip, time, alertClip, 0, 0);
    }
    rig.root.position.copy(position);
  }

  function fleeStep(delta: number, awayFromDir: THREE.Vector3) {
    if (ai.state !== 'fleeing') {
      burstCycleTime = 0;
      return;
    }
    burstCycleTime += delta;
    const phase = burstCycleTime % CYCLE_SECONDS;
    const isBursting = phase < BURST_SECONDS;
    if (isBursting) position.addScaledVector(awayFromDir, BURST_SPEED * delta);
  }

  return { group: rig.root, ai, position, update, fleeStep };
}
