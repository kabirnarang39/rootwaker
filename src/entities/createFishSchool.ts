import * as THREE from 'three';

const FISH_BODY_COLOR = 0x8fb4c9; // silvery-blue schooling fish — real open-water shoal coloring
const FISH_BELLY_COLOR = 0xd8e8ee; // pale underside, a real countershading trait
const FISH_FIN_COLOR = 0x5c8296;

const SCHOOL_RADIUS = 2.2;
const SCHOOL_DEPTH_BELOW_SURFACE = 0.6; // stays under the wave crests, never pokes through
const CIRCLE_PERIOD_SECONDS = 14; // one slow lap of the school's shared path
const SWIM_WIGGLE_SPEED = 6; // rad/s — a real fish's tail-beat cadence, much faster than the school's own drift
const SWIM_WIGGLE_AMPLITUDE = 0.35;

/** A single low-poly reef/open-water fish: a tapered body (cone, not a capsule — real fish narrow
 * to a point at the tail, not a rounded cap) plus a flat triangular tail fin that reads as a real
 * silhouette from the glancing angle a player sees the sea surface at, not just top-down. */
function buildFishMesh(): THREE.Group {
  const bodyMat = new THREE.MeshStandardMaterial({ color: FISH_BODY_COLOR, flatShading: true, roughness: 0.35, metalness: 0.15 });
  const bellyMat = new THREE.MeshStandardMaterial({ color: FISH_BELLY_COLOR, flatShading: true, roughness: 0.4 });
  const finMat = new THREE.MeshStandardMaterial({ color: FISH_FIN_COLOR, flatShading: true, roughness: 0.5, side: THREE.DoubleSide });

  const group = new THREE.Group();

  const body = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.26, 6), bodyMat);
  body.rotation.x = Math.PI / 2;
  body.castShadow = true;
  group.add(body);

  const belly = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.2, 5), bellyMat);
  belly.rotation.x = Math.PI / 2;
  belly.position.set(0, -0.025, 0.01);
  group.add(belly);

  const tailFin = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.09, 3), finMat);
  tailFin.rotation.x = Math.PI / 2;
  tailFin.rotation.z = Math.PI / 4;
  tailFin.position.set(0, 0, -0.15);
  group.add(tailFin);

  const dorsalFin = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.07, 3), finMat);
  dorsalFin.rotation.x = Math.PI;
  dorsalFin.position.set(0, 0.05, 0.01);
  group.add(dorsalFin);

  return group;
}

export interface FishSchool {
  group: THREE.Group;
  update(time: number): void;
}

/** A tight schooling cluster of fish swimming a slow shared circular path just under the sea
 * surface, each fish offset by its own angle/depth/phase (so it reads as a real synchronized
 * shoal, not identical clones stacked on one point) with a fast tail-wiggle layered on top of the
 * slow drift — real fish locomotion is a body undulation, not a rigid glide. Purely visual/ambient
 * set dressing, same scope as createDuskFinchFlock — no AI states, no player interaction. */
export function createFishSchool(center: THREE.Vector3, count = 8): FishSchool {
  const group = new THREE.Group();
  group.name = 'fish-school';

  const fish: Array<{ mesh: THREE.Group; angleOffset: number; radiusScale: number; depthOffset: number; wigglePhase: number }> = [];
  for (let i = 0; i < count; i++) {
    const mesh = buildFishMesh();
    group.add(mesh);
    fish.push({
      mesh,
      angleOffset: (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4,
      radiusScale: 0.6 + Math.random() * 0.5,
      depthOffset: (Math.random() - 0.5) * 0.3,
      wigglePhase: Math.random() * Math.PI * 2,
    });
  }

  function update(time: number): void {
    const baseAngle = (time / CIRCLE_PERIOD_SECONDS) * Math.PI * 2;
    for (const f of fish) {
      const angle = baseAngle + f.angleOffset;
      const radius = SCHOOL_RADIUS * f.radiusScale;
      const x = center.x + Math.cos(angle) * radius;
      const z = center.z + Math.sin(angle) * radius;
      const y = center.y - SCHOOL_DEPTH_BELOW_SURFACE + f.depthOffset;
      f.mesh.position.set(x, y, z);
      // Face the direction of travel around the circle (tangent to the path), then layer a real
      // fast side-to-side tail wiggle on top — the same "slow path, fast local oscillation"
      // structure createDuskFinchFlock's circling uses for wingbeats, applied here to yaw instead.
      const travelAngle = angle + Math.PI / 2;
      const wiggle = Math.sin(time * SWIM_WIGGLE_SPEED + f.wigglePhase) * SWIM_WIGGLE_AMPLITUDE;
      f.mesh.rotation.y = travelAngle + wiggle;
    }
  }

  return { group, update };
}
