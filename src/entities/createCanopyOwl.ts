import * as THREE from 'three';
import { Rig, type JointName } from '../scene/rig/Rig';
import { applyClipToRig } from '../scene/rig/Clip';
import { perchClip, diveClip } from './canopyOwlClips';
import { EnemyAI, type AiState } from './EnemyAI';
import type { Combatant } from '../game/Combat';
import type { Capsule } from '../game/collision';
import { computeStrikeRange } from '../game/EnemyChase';

// Mottled dusk plumage — deliberately grey-shifted away from the bear's warm fur browns
// (0x5a4530 / 0x3a2c1c) so the two species never read as recolors of each other at distance.
const OWL_PLUMAGE = 0x6b6257;
const OWL_PLUMAGE_DARK = 0x413a32;
const OWL_FACIAL_DISC = 0xb9ae9c; // pale heart-shaped face — the owl's single most recognizable feature
const OWL_KERATIN = 0x2b2620; // beak and talons
const OWL_EYE_COLOR = 0xffc247; // amber eye-shine, like the bear's, because both are nocturnal

const OWL_HP = 34;
const OWL_HITBOX_RADIUS = 0.32;
const OWL_HITBOX_HEIGHT = 0.4; // spine -> spine + 0.4m; an owl is a short upright body, not a bear's 0.5m barrel
const OWL_TELEGRAPH_SECONDS = 0.5;

export interface CanopyOwl {
  group: THREE.Group;
  ai: EnemyAI;
  combatant: Combatant;
  /** Set by the level at spawn (groundHeight + ~3.2). The owl hunts from a perch and climbs back
   * to this height when it loses the player — the level's animate() loop owns that motion, this
   * field is just where it aims. */
  perchY: number;
  update(time: number, delta: number, distanceToPlayer: number): void;
}

export function createCanopyOwl(): CanopyOwl {
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

  // Upright bird proportions: a near-vertical body with the big head sitting almost directly on
  // the shoulders (owls have a very short visible neck), wings hinged high on the flanks, tail
  // trailing low and aft, and short legs tucked well under the body.
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
  // Exactly once, after the last setLocalPosition and before any clip runs — clips author
  // position keyframes as offsets from this snapshot (see Rig.captureBasePose).
  rig.captureBasePose();

  const plumageMat = new THREE.MeshStandardMaterial({ color: OWL_PLUMAGE, flatShading: true, roughness: 0.9 });
  const plumageDarkMat = new THREE.MeshStandardMaterial({ color: OWL_PLUMAGE_DARK, flatShading: true, roughness: 0.95 });
  const discMat = new THREE.MeshStandardMaterial({ color: OWL_FACIAL_DISC, flatShading: true, roughness: 1 });
  const keratinMat = new THREE.MeshStandardMaterial({ color: OWL_KERATIN, flatShading: true, roughness: 0.45 });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: OWL_EYE_COLOR, emissive: OWL_EYE_COLOR, emissiveIntensity: 1.1, flatShading: true,
  });

  // Every anatomy mesh is named. Nothing in the renderer needs the names — the createCanopyOwl
  // test asserts each real part exists by name, which is a far stronger guard against the
  // "one capsule + one icosahedron reads as a dark shapeless rock" regression (5b812b5) than
  // counting anonymous meshes, since a count passes even if every part is a duplicate blob.
  const add = (joint: JointName, name: string, mesh: THREE.Mesh): void => {
    mesh.name = name;
    mesh.castShadow = true;
    rig.getJoint(joint).add(mesh);
  };

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.2, 2, 8), plumageMat);
  add('spine', 'owl-body', body);

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 1), plumageMat);
  head.scale.set(1, 0.95, 0.9);
  add('head', 'owl-head', head);

  // The facial disc: a wide, shallow, pale plate across the front of the skull. It is what makes
  // the silhouette read "owl" rather than "round bird" from gameplay distance.
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.035, 14), discMat);
  disc.rotation.x = Math.PI / 2;
  disc.position.set(0, 0.005, 0.085);
  add('head', 'owl-facial-disc', disc);

  // Large forward-facing eyes — binocular, both aimed down +Z, not set on the sides of the head
  // like a prey animal's. Sized big on purpose: an owl's eyes fill most of its face.
  const eyeGeo = new THREE.SphereGeometry(0.055, 8, 8);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.065, 0.025, 0.115);
  add('head', 'owl-eye-l', eyeL);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(0.065, 0.025, 0.115);
  add('head', 'owl-eye-r', eyeR);

  // Hooked beak: a short forward cone with a second cone curling down off its tip. One cone alone
  // reads as a finch's straight bill, which is the wrong bird entirely.
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.034, 0.11, 6), keratinMat);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0, 0.045);
  add('jaw', 'owl-beak', beak);
  const beakHook = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.055, 6), keratinMat);
  beakHook.rotation.x = Math.PI;
  beakHook.position.set(0, -0.035, 0.075);
  add('jaw', 'owl-beak-hook', beakHook);

  // Ear tufts — feather horns, not actual ears (the real ear openings are hidden under the disc).
  const tuftGeo = new THREE.ConeGeometry(0.033, 0.15, 4);
  const tuftL = new THREE.Mesh(tuftGeo, plumageDarkMat);
  tuftL.rotation.z = 0.35;
  add('earL', 'owl-ear-tuft-l', tuftL);
  const tuftR = new THREE.Mesh(tuftGeo, plumageDarkMat);
  tuftR.rotation.z = -0.35;
  add('earR', 'owl-ear-tuft-r', tuftR);

  // Wings: a tapered blade per side, flattened along its thickness axis and swept back, plus a
  // darker primary-feather tip. A flat square here would read as a paper cutout; the taper is
  // what gives the folded-wing silhouette its shape.
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

  // Fanned tail: wide at the trailing edge, narrow where it meets the body, flattened into a
  // plane. Modelled as an inverted cone-frustum so the fan opens away from the bird.
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.06, 0.3, 4), plumageDarkMat);
  tail.scale.set(1, 1, 0.18);
  tail.rotation.x = 2.2;
  tail.position.set(0, -0.06, -0.1);
  add('tail0', 'owl-tail-fan', tail);

  // Talon legs: a feathered tarsus per side ending in a foot with three visible claws. The claws
  // are the strike surface the dive clip thrusts forward, so they have to be actually visible.
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
      claw.rotation.x = 1.9; // curled forward and down, the way a talon closes on prey
      claw.position.set((i - 1) * 0.032, -0.025, 0.045);
      add(`hindpaw${side}`, `owl-claw-${lower}-${i}`, claw);
    }
  }

  const ai = new EnemyAI();
  const combatant: Combatant = {
    hp: OWL_HP,
    maxHp: OWL_HP,
    hitbox: { start: new THREE.Vector3(), end: new THREE.Vector3(), radius: OWL_HITBOX_RADIUS },
  };

  function syncHitbox() {
    const worldPos = new THREE.Vector3();
    rig.getJoint('spine').getWorldPosition(worldPos);
    combatant.hitbox.start.copy(worldPos);
    combatant.hitbox.end.copy(worldPos).add(new THREE.Vector3(0, OWL_HITBOX_HEIGHT, 0));
  }

  let diveStartTime = -1;
  let prevAiState: AiState = 'idle';

  function update(time: number, delta: number, distanceToPlayer: number) {
    // Both AI tunables are assigned BEFORE ai.update() in the same frame. Assigning them after
    // leaves the state machine advancing one frame on stale values — that exact ordering bug has
    // shipped and been fixed twice in this codebase, so it is written out explicitly here.
    ai.telegraphSeconds = OWL_TELEGRAPH_SECONDS;
    // A real owl's own combat rhythm: after a dive-strike it has to climb back up to hover/perch
    // height before it can stoop again — a real recovery cost a ground predator doesn't pay.
    // Recovery-only, same safe pattern as every other species: diveClip's own duration already
    // matches OWL_TELEGRAPH_SECONDS + the default attack window exactly.
    ai.recoverSeconds = 1.0;
    ai.strikeRange = computeStrikeRange(combatant.hitbox.radius);
    ai.update(distanceToPlayer, delta);

    const isIdle = ai.state === 'idle' || ai.state === 'aggro';
    if (isIdle) {
      applyClipToRig(rig, perchClip, time);
      diveStartTime = -1;
    } else {
      if (ai.state === 'telegraph' && prevAiState !== 'telegraph') {
        diveStartTime = time;
      }
      applyClipToRig(rig, diveClip, time - diveStartTime);
    }
    prevAiState = ai.state;
    rig.root.updateMatrixWorld(true);
    syncHitbox();
  }

  return { group: rig.root, ai, combatant, perchY: 0, update };
}

export function getCanopyOwlHitbox(owl: CanopyOwl): Capsule {
  return owl.combatant.hitbox;
}
