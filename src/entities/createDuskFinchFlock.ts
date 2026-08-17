import * as THREE from 'three';
import { Rig, type JointName } from '../scene/rig/Rig';
import { applyClipToRig } from '../scene/rig/Clip';
import { flapClip } from './duskFinchClips';

export type FlockState = 'perched' | 'flushed' | 'circling';

const FLUSH_RANGE = 5; // meters — player closing to this range triggers the explosive group takeoff
const RESETTLE_RANGE = 12; // meters — the flock only settles back once the player has retreated this far
const FLUSH_DURATION = 0.5; // seconds — the rise-and-scatter is quick and explosive, not a slow climb
const CIRCLE_RADIUS = 2.5;
const CIRCLE_HEIGHT = 2.2; // meters above `center`, well above the perch height
const ANGULAR_SPEED = 1.8; // rad/s while circling

const FINCH_BODY = 0x8a4a3a; // dusky rust-brown, distinct from the hare/squirrel/owl palettes
const FINCH_WING = 0x5c3226;
const FINCH_BEAK = 0xd9a441;
const FINCH_EYE = 0x120d0a;

export interface DuskFinchFlock {
  group: THREE.Group;
  state: FlockState;
  update(time: number, delta: number, distanceToPlayer: number): void;
}

interface Finch {
  rig: Rig;
  perchPosition: THREE.Vector3;
  angleBase: number; // both the perch spread angle and the circling formation angle
  phase: number; // desyncs each bird's wingbeat so the flock doesn't flap in perfect unison
}

function circleAnchor(center: THREE.Vector3, angleBase: number, out: THREE.Vector3): THREE.Vector3 {
  return out.set(
    center.x + Math.cos(angleBase) * CIRCLE_RADIUS,
    center.y + CIRCLE_HEIGHT,
    center.z + Math.sin(angleBase) * CIRCLE_RADIUS,
  );
}

function buildFinchRig(): Rig {
  const rig = new Rig(['root', 'spine', 'head', 'wingL', 'wingR', 'tail0']);
  rig.attach('spine', 'root');
  rig.attach('head', 'spine');
  rig.attach('wingL', 'spine');
  rig.attach('wingR', 'spine');
  rig.attach('tail0', 'spine');

  rig.setLocalPosition('spine', 0, 0.045, 0);
  rig.setLocalPosition('head', 0, 0.03, 0.035);
  rig.setLocalPosition('wingL', -0.028, 0.01, 0);
  rig.setLocalPosition('wingR', 0.028, 0.01, 0);
  rig.setLocalPosition('tail0', 0, 0, -0.045);
  // Exactly once, after the last setLocalPosition and before any clip runs — clips author position
  // keyframes as offsets from this snapshot (see Rig.captureBasePose).
  rig.captureBasePose();

  const bodyMat = new THREE.MeshStandardMaterial({ color: FINCH_BODY, flatShading: true, roughness: 0.85 });
  const wingMat = new THREE.MeshStandardMaterial({ color: FINCH_WING, flatShading: true, roughness: 0.85 });
  const beakMat = new THREE.MeshStandardMaterial({ color: FINCH_BEAK, flatShading: true, roughness: 0.4 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: FINCH_EYE, flatShading: true, roughness: 0.3 });

  // Every anatomy mesh is named — the createDuskFinchFlock test asserts each real part exists by
  // name, the same guard createCanopyOwl/createVineViper/createGroveSquirrel use against the "one
  // capsule + one icosahedron reads as a dark shapeless rock" regression (5b812b5).
  const add = (joint: JointName, name: string, mesh: THREE.Mesh): void => {
    mesh.name = name;
    mesh.castShadow = true;
    rig.getJoint(joint).add(mesh);
  };

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.05, 2, 6), bodyMat);
  body.rotation.z = Math.PI / 2;
  add('spine', 'finch-body', body);

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.026, 0), bodyMat);
  add('head', 'finch-head', head);

  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.01, 0.03, 5), beakMat);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, -0.003, 0.026);
  add('head', 'finch-beak', beak);

  const eyeGeo = new THREE.SphereGeometry(0.006, 6, 6);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.016, 0.005, 0.016);
  add('head', 'finch-eye-l', eyeL);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(0.016, 0.005, 0.016);
  add('head', 'finch-eye-r', eyeR);

  // Wings: a flattened tapered blade per side, same construction idiom as the owl's folded wings
  // (createCanopyOwl.ts) but scaled down to a finch's size and hinged for a much faster beat.
  for (const side of ['L', 'R'] as const) {
    const outward = side === 'L' ? 1 : -1;
    const wing = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.13, 4), wingMat);
    wing.scale.set(0.22, 1, 1);
    wing.rotation.set(0, 0.2 * outward, (Math.PI / 2) * outward);
    wing.position.set(-0.05 * outward, -0.01, 0);
    add(`wing${side}`, `finch-wing-${side.toLowerCase()}`, wing);
  }

  // Tail: a small flattened fan, the same inverted-frustum idiom as the owl's tail but scaled to
  // finch proportions.
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.012, 0.06, 4), wingMat);
  tail.scale.set(1, 1, 0.2);
  tail.rotation.x = 2.1;
  add('tail0', 'finch-tail', tail);

  return rig;
}

export function createDuskFinchFlock(center: THREE.Vector3, count: number): DuskFinchFlock {
  const group = new THREE.Group();
  const finches: Finch[] = [];
  const perchRadius = 0.8;

  for (let i = 0; i < count; i++) {
    const rig = buildFinchRig();
    const angleBase = (i / count) * Math.PI * 2;
    const perchPosition = new THREE.Vector3(
      center.x + Math.cos(angleBase) * perchRadius,
      center.y + 0.15,
      center.z + Math.sin(angleBase) * perchRadius,
    );
    rig.root.position.copy(perchPosition);
    group.add(rig.root);
    finches.push({ rig, perchPosition, angleBase, phase: (i / count) * 0.12 });
  }

  const flock: DuskFinchFlock = { group, state: 'perched', update };

  let flushTimer = 0;
  let circleTimer = 0;
  const scratch = new THREE.Vector3();

  function update(time: number, delta: number, distanceToPlayer: number): void {
    switch (flock.state) {
      case 'perched':
        if (distanceToPlayer <= FLUSH_RANGE) {
          flock.state = 'flushed';
          flushTimer = 0;
        }
        break;
      case 'flushed':
        flushTimer += delta;
        if (flushTimer >= FLUSH_DURATION) {
          flock.state = 'circling';
          circleTimer = 0;
        }
        break;
      case 'circling':
        circleTimer += delta;
        if (distanceToPlayer >= RESETTLE_RANGE) {
          flock.state = 'perched';
        }
        break;
    }

    for (const finch of finches) {
      if (flock.state === 'perched') {
        finch.rig.root.position.copy(finch.perchPosition);
        // Wings fold flat at rest. flapClip is only ever applied in 'flushed'/'circling' below, so
        // without this explicit reset a bird landing back on its perch would keep whatever wing
        // rotation the flap clip last left it at, frozen forever — the exact "joint stuck at a
        // stale non-rest value" bug class Task 3 found and fixed in the viper's tail (0ec0b0f).
        finch.rig.setLocalRotation('wingL', 0, 0, 0);
        finch.rig.setLocalRotation('wingR', 0, 0, 0);
        continue;
      }

      if (flock.state === 'flushed') {
        const t = Math.min(flushTimer / FLUSH_DURATION, 1);
        const eased = t * t; // fast-accelerating launch, reads as explosive rather than a slow climb
        circleAnchor(center, finch.angleBase, scratch);
        finch.rig.root.position.lerpVectors(finch.perchPosition, scratch, eased);
      } else {
        // circling — hands off exactly where 'flushed' left off (circleTimer starts at 0 the same
        // instant flushed's eased-t reaches 1 at the same anchor point), so there is no visual pop.
        const angle = finch.angleBase + circleTimer * ANGULAR_SPEED;
        finch.rig.root.position.set(
          center.x + Math.cos(angle) * CIRCLE_RADIUS,
          center.y + CIRCLE_HEIGHT,
          center.z + Math.sin(angle) * CIRCLE_RADIUS,
        );
      }
      applyClipToRig(finch.rig, flapClip, time + finch.phase);
    }
  }

  return flock;
}
