import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { WaterBody } from '../game/WaterBody';
import { createSky } from './createSky';
import { createGroveHare, type GroveHare } from '../entities/groveHare';
import { createTuskBoar, type TuskBoar } from '../entities/tuskBoar';
import { createGroveBear, type GroveBear } from '../entities/createGroveBear';
import { createElderBearKing, type ElderBearKing } from '../entities/createElderBearKing';
import { createCanopyOwl, type CanopyOwl } from '../entities/createCanopyOwl';
import { createVineViper, type VineViper } from '../entities/createVineViper';
import { createGroveSquirrel, type GroveSquirrel } from '../entities/createGroveSquirrel';
import { createDuskFinchFlock, type DuskFinchFlock } from '../entities/createDuskFinchFlock';
import { TreeObstacleGrid, type TreeObstacle } from './TreeObstacleGrid';

export interface ClimbableWall {
  normal: THREE.Vector3;
  topY: number;
  bounds: THREE.Box2; // x/z footprint at the wall's base
  // Real horizontal drift (dx, dz) from the wall's own base position at a given height climbed
  // above that base — a real winding route up the rock, not a fixed straight line. MUST return
  // (0,0) at heightAboveBase === 0: grounded-mode entry-detection (Game.ts's nearWall/
  // nearSegmentWall) checks the player's position against `bounds`, always at height ≈ 0, and
  // relies on this guarantee to stay correct without ever reading pathAt itself.
  pathAt(heightAboveBase: number): { dx: number; dz: number };
}

export interface ClimbSegment {
  wall: ClimbableWall;
  ledgePosition: THREE.Vector3;
}

export interface ThroneRoom {
  bounds: THREE.Box2; // arena floor's x/z extent
  kingSpawn: THREE.Vector3;
  king: ElderBearKing;
  villageMeshes: THREE.Object3D[];
  // Real animal spectators (bear/owl/viper/squirrel) flanking the aisle to the King — revealed
  // by openGate() alongside villageMeshes, not in place of them.
  animalAudience: THREE.Object3D[];
  gateOpen: boolean;
  openGate(): void;
}

export interface JungleLevel {
  group: THREE.Group;
  groundHeightAt(x: number, z: number): number;
  climbableWall: ClimbableWall;
  water: WaterBody;
  chapterBounds: THREE.Box3;
  hares: GroveHare[];
  boars: TuskBoar[];
  bears: GroveBear[];
  owls: CanopyOwl[];
  vipers: VineViper[];
  squirrels: GroveSquirrel[];
  finchFlock: DuskFinchFlock;
  // Not exposed by DuskFinchFlock itself (its `group` stays at local origin — each finch's own
  // rig.root carries its real world position) — Game.ts needs this to compute distanceToPlayer
  // for the flock's own update() call.
  finchFlockCenter: THREE.Vector3;
  obstacleGrid: TreeObstacleGrid;
  foliageMeshes: THREE.InstancedMesh[];
  // Static wall/ledge/gate meshes (real Meshes, Groups pre-flattened) the camera should also
  // raycast against — e.g. the hawk-eye view being blocked by an overhanging mountain ledge.
  climbObstacleMeshes: THREE.Object3D[];
  mountain: {
    segments: ClimbSegment[];
    summitGate: THREE.Vector3;
  };
  throneRoom: ThroneRoom;
  update(time: number): void;
}

const CHAPTER_SIZE = 40; // meters, one bounded region
const TERRAIN_SEGMENTS = 48;
const WIND = new THREE.Vector3(0.6, 0, 0.2).normalize(); // shared by foliage sway and water waves

function buildTerrain(): { mesh: THREE.Mesh; heightAt: (x: number, z: number) => number } {
  const geo = new THREE.PlaneGeometry(CHAPTER_SIZE, CHAPTER_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const heightAt = (x: number, z: number) =>
    Math.sin(x * 0.15) * 0.6 + Math.cos(z * 0.12) * 0.5 - Math.max(0, 3 - Math.hypot(x - 6, z + 4)) * 0.4; // riverbank dip near the water crossing

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({ color: 0x14251a, roughness: 1, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return { mesh, heightAt };
}

interface TreeSpeciesLobe {
  radius: number;
  offset: [number, number, number];
}

interface TreeSpecies {
  trunkHeight: number;
  trunkRadiusBottom: number;
  trunkRadiusTop: number;
  canopyLobes: TreeSpeciesLobe[];
  canopyColor: number;
}

const TREE_SPECIES: TreeSpecies[] = [
  {
    trunkHeight: 1.9,
    trunkRadiusBottom: 0.07,
    trunkRadiusTop: 0.1,
    canopyLobes: [
      { radius: 0.45, offset: [0, 0.4, 0] },
      { radius: 0.3, offset: [0.18, 0.62, 0.12] },
    ],
    canopyColor: 0x1f4d3a,
  },
  {
    trunkHeight: 1.3,
    trunkRadiusBottom: 0.09,
    trunkRadiusTop: 0.13,
    canopyLobes: [
      { radius: 0.6, offset: [0, 0.35, 0] },
      { radius: 0.42, offset: [-0.3, 0.55, -0.2] },
      { radius: 0.35, offset: [0.28, 0.5, 0.22] },
    ],
    canopyColor: 0x2c6b4a,
  },
  {
    trunkHeight: 2.1,
    trunkRadiusBottom: 0.06,
    trunkRadiusTop: 0.085,
    canopyLobes: [
      { radius: 0.4, offset: [0, 0.55, 0] },
      { radius: 0.32, offset: [0.26, 0.85, 0.2] },
      { radius: 0.3, offset: [-0.24, 0.72, -0.22] },
    ],
    canopyColor: 0x14392a,
  },
  {
    trunkHeight: 1.1,
    trunkRadiusBottom: 0.08,
    trunkRadiusTop: 0.11,
    canopyLobes: [
      { radius: 0.5, offset: [0, 0.32, 0] },
      { radius: 0.4, offset: [0.22, 0.5, -0.18] },
      { radius: 0.38, offset: [-0.2, 0.48, 0.2] },
      { radius: 0.3, offset: [0.05, 0.68, 0.05] },
    ],
    canopyColor: 0x1a4a3a,
  },
];

function buildTreeSpeciesMeshes(
  species: TreeSpecies,
  count: number,
  windDir: THREE.Vector2,
): { trunkMesh: THREE.InstancedMesh; canopyMesh: THREE.InstancedMesh; uniforms: { uTime: { value: number } } } {
  const trunkGeo = new THREE.CylinderGeometry(species.trunkRadiusTop, species.trunkRadiusBottom, species.trunkHeight, 6);
  trunkGeo.translate(0, species.trunkHeight / 2, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, flatShading: true, roughness: 0.9 });

  const lobeGeoms = species.canopyLobes.map((lobe) => {
    const geo = new THREE.IcosahedronGeometry(lobe.radius, 0);
    geo.translate(lobe.offset[0], species.trunkHeight + lobe.offset[1], lobe.offset[2]);
    return geo;
  });
  const canopyGeo = mergeGeometries(lobeGeoms, false);
  if (!canopyGeo) throw new Error('buildTreeSpeciesMeshes: failed to merge canopy geometry');
  const canopyMat = new THREE.MeshStandardMaterial({ color: species.canopyColor, flatShading: true, roughness: 0.9 });

  const uniforms = { uTime: { value: 0 }, uWindDir: { value: windDir } };
  canopyMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWindDir = uniforms.uWindDir;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform vec2 uWindDir;`,
      )
      .replace(
        '#include <project_vertex>',
        `vec4 mvPosition = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif
        float sway = sin(uTime * 1.6 + (instanceMatrix[3].x + instanceMatrix[3].z) * 0.5) * 0.08;
        mvPosition.x += uWindDir.x * sway;
        mvPosition.z += uWindDir.y * sway;
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`,
      );
  };

  const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
  const canopyMesh = new THREE.InstancedMesh(canopyGeo, canopyMat, count);
  trunkMesh.castShadow = true;
  canopyMesh.castShadow = true;

  return { trunkMesh, canopyMesh, uniforms };
}

const EXCLUSION_MARGIN = 0.4; // meters — keeps foliage/wildlife clear of water and wall footprints

function isPlaceable(x: number, z: number, water: WaterBody, wallBounds: THREE.Box2): boolean {
  const inWater =
    x >= water.bounds.min.x - EXCLUSION_MARGIN &&
    x <= water.bounds.max.x + EXCLUSION_MARGIN &&
    z >= water.bounds.min.z - EXCLUSION_MARGIN &&
    z <= water.bounds.max.z + EXCLUSION_MARGIN;
  const inWall =
    x >= wallBounds.min.x - EXCLUSION_MARGIN &&
    x <= wallBounds.max.x + EXCLUSION_MARGIN &&
    z >= wallBounds.min.y - EXCLUSION_MARGIN &&
    z <= wallBounds.max.y + EXCLUSION_MARGIN;
  return !inWater && !inWall;
}

function buildFoliage(
  heightAt: (x: number, z: number) => number,
  water: WaterBody,
  wallBounds: THREE.Box2,
): { meshes: THREE.InstancedMesh[]; update: (time: number) => void; obstacles: TreeObstacle[] } {
  const COUNT = 1300;
  const windDir2 = new THREE.Vector2(WIND.x, WIND.z).normalize();

  const perSpeciesCount = Math.ceil(COUNT / TREE_SPECIES.length);
  const speciesMeshes = TREE_SPECIES.map((species) => buildTreeSpeciesMeshes(species, perSpeciesCount, windDir2));
  const placedPerSpecies = new Array(TREE_SPECIES.length).fill(0);
  const treeObstacles: TreeObstacle[] = [];

  const dummy = new THREE.Object3D();
  let totalPlaced = 0;
  let attempts = 0;

  while (totalPlaced < COUNT && attempts < COUNT * 4) {
    attempts++;
    const x = (Math.random() - 0.5) * CHAPTER_SIZE;
    const z = (Math.random() - 0.5) * CHAPTER_SIZE;
    if (!isPlaceable(x, z, water, wallBounds)) continue;

    const speciesIndex = Math.floor(Math.random() * TREE_SPECIES.length);
    if (placedPerSpecies[speciesIndex] >= perSpeciesCount) continue;

    const scale = 0.65 + Math.random() * 0.85;
    dummy.position.set(x, heightAt(x, z), z);
    dummy.rotation.y = Math.random() * Math.PI * 2;
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();

    const { trunkMesh, canopyMesh } = speciesMeshes[speciesIndex];
    const idx = placedPerSpecies[speciesIndex];
    trunkMesh.setMatrixAt(idx, dummy.matrix);
    canopyMesh.setMatrixAt(idx, dummy.matrix);
    placedPerSpecies[speciesIndex] = idx + 1;
    totalPlaced++;

    const species = TREE_SPECIES[speciesIndex];
    treeObstacles.push({ x, z, radius: species.trunkRadiusBottom * scale, height: species.trunkHeight * scale });
  }

  const meshes: THREE.InstancedMesh[] = [];
  speciesMeshes.forEach(({ trunkMesh, canopyMesh }, i) => {
    trunkMesh.count = placedPerSpecies[i];
    canopyMesh.count = placedPerSpecies[i];
    trunkMesh.instanceMatrix.needsUpdate = true;
    canopyMesh.instanceMatrix.needsUpdate = true;
    meshes.push(trunkMesh, canopyMesh);
  });

  return {
    meshes,
    update: (time: number) => {
      speciesMeshes.forEach(({ uniforms }) => {
        uniforms.uTime.value = time;
      });
    },
    obstacles: treeObstacles,
  };
}

// A real jagged rock face, not a smooth box: N angular chunks (icosahedra scaled into rough
// slabs, not round boulders) scattered across the wall's height/width and merged into ONE
// BufferGeometry/Mesh — same clustering technique buildTreeSpeciesMeshes already uses for canopy
// lobes, and critically the SAME single-Mesh return shape buildClimbableWall/buildClimbSegment
// always had, so every caller (climbObstacleMeshes' "real Meshes only, no Groups" raycast
// requirement, group.add()) needs zero changes. Chunks bias toward protruding along +thicknessAxis
// (the wall's climbing-facing side) so the silhouette actually reads as jutting rock, not a flat
// panel with a bumpy texture. Purely visual: the returned mesh's actual triangles are never
// consulted by the climb mechanic, which reads ClimbableWall's numeric bounds/topY/normal only
// (confirmed against Game.ts's nearWall/nearSegmentWall checks) — so this can never regress
// climbing itself, only how it looks.
function buildRockFaceMesh(thickness: number, height: number, faceWidth: number, color: number): THREE.Mesh {
  const CHUNK_COUNT = 12;
  const geoms: THREE.BufferGeometry[] = [];
  for (let i = 0; i < CHUNK_COUNT; i++) {
    const radius = thickness * (1.1 + Math.random() * 0.9);
    const geo = new THREE.IcosahedronGeometry(radius, 0);
    // Flatten toward a slab (thin along X, the wall's thickness axis) rather than a round boulder.
    geo.scale(0.55 + Math.random() * 0.35, 1 + Math.random() * 0.7, 0.7 + Math.random() * 0.6);
    const x = thickness * (0.15 + Math.random() * 0.55); // biased outward — chunks jut toward the climber
    const y = (Math.random() - 0.5) * height * 0.96;
    const z = (Math.random() - 0.5) * faceWidth * 0.92;
    geo.translate(x, y, z);
    geo.rotateY(Math.random() * Math.PI);
    geo.rotateX((Math.random() - 0.5) * 0.4);
    geoms.push(geo);
  }
  const merged = mergeGeometries(geoms, false);
  if (!merged) throw new Error('buildRockFaceMesh: failed to merge rock-chunk geometry');
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true });
  const mesh = new THREE.Mesh(merged, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** A real, deterministic winding path: a single sine wave in the wall's own width axis (Z),
 * amplitude bounded by `amplitude` meters either side of the wall's base Z, completing one full
 * left-right-left cycle every `wavelengthMeters` of height climbed. Always (0,0) at height 0. */
export function makeWindingPath(
  amplitude: number,
  wavelengthMeters: number,
): (heightAboveBase: number) => { dx: number; dz: number } {
  return (heightAboveBase: number) => ({
    dx: 0,
    dz: Math.sin((heightAboveBase / wavelengthMeters) * Math.PI * 2) * amplitude,
  });
}

function buildClimbableWall(heightAt: (x: number, z: number) => number): { mesh: THREE.Mesh; wall: ClimbableWall } {
  const wallX = -12;
  const wallZWidth = 6;
  const baseZ = 8;
  const baseY = heightAt(wallX, baseZ);
  const height = 6;

  const mesh = buildRockFaceMesh(0.6, height, wallZWidth, 0x2c2216);
  mesh.position.set(wallX, baseY + height / 2, baseZ);

  const wall: ClimbableWall = {
    normal: new THREE.Vector3(1, 0, 0),
    topY: baseY + height,
    bounds: new THREE.Box2(
      new THREE.Vector2(wallX - 0.3, baseZ - wallZWidth / 2),
      new THREE.Vector2(wallX + 0.3, baseZ + wallZWidth / 2),
    ),
    pathAt: () => ({ dx: 0, dz: 0 }), // real winding wired in a later task
  };
  return { mesh, wall };
}

const MOUNTAIN_WALL_COLOR = 0x2c2216; // matches the phase-1 climbable wall
const MOUNTAIN_LEDGE_COLOR = 0x4a4842; // matches mountainGuard.ts's stone
const MOUNTAIN_GATE_TRIM_COLOR = 0x8a6a3a; // matches mountainGuard.ts's trim

// Generalized version of buildClimbableWall's pattern: stacked segments need an explicit
// base Y (the ledge below them) rather than deriving it from ground terrain.
function buildClimbSegment(
  wallX: number,
  baseZ: number,
  baseY: number,
  wallZWidth: number,
  height: number,
): { mesh: THREE.Mesh; wall: ClimbableWall } {
  const mesh = buildRockFaceMesh(0.6, height, wallZWidth, MOUNTAIN_WALL_COLOR);
  mesh.position.set(wallX, baseY + height / 2, baseZ);

  const wall: ClimbableWall = {
    normal: new THREE.Vector3(1, 0, 0),
    topY: baseY + height,
    bounds: new THREE.Box2(
      new THREE.Vector2(wallX - 0.3, baseZ - wallZWidth / 2),
      new THREE.Vector2(wallX + 0.3, baseZ + wallZWidth / 2),
    ),
    pathAt: () => ({ dx: 0, dz: 0 }), // real winding wired in a later task
  };
  return { mesh, wall };
}

function buildLedge(
  centerX: number,
  topY: number,
  centerZ: number,
  width: number,
  depth: number,
): { mesh: THREE.Mesh; position: THREE.Vector3 } {
  const thickness = 0.3;
  const geo = new THREE.BoxGeometry(width, thickness, depth);
  const mat = new THREE.MeshStandardMaterial({ color: MOUNTAIN_LEDGE_COLOR, roughness: 0.95, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(centerX, topY - thickness / 2, centerZ);
  mesh.receiveShadow = true;
  return { mesh, position: new THREE.Vector3(centerX, topY, centerZ) };
}

function buildSummitGate(position: THREE.Vector3): THREE.Group {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: MOUNTAIN_LEDGE_COLOR, roughness: 0.95, flatShading: true });
  const trimMat = new THREE.MeshStandardMaterial({
    color: MOUNTAIN_GATE_TRIM_COLOR,
    roughness: 0.6,
    metalness: 0.3,
    flatShading: true,
  });

  const pillarGeo = new THREE.BoxGeometry(0.4, 2.2, 0.4);
  const pillarL = new THREE.Mesh(pillarGeo, stoneMat);
  pillarL.position.set(position.x - 1.2, position.y + 1.1, position.z);
  pillarL.castShadow = true;
  const pillarR = new THREE.Mesh(pillarGeo, stoneMat);
  pillarR.position.set(position.x + 1.2, position.y + 1.1, position.z);
  pillarR.castShadow = true;

  const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.35, 0.5), trimMat);
  lintel.position.set(position.x, position.y + 2.35, position.z);
  lintel.castShadow = true;

  group.add(pillarL, pillarR, lintel);
  return group;
}

// Three linked climb segments stacked above the phase-1 wall's dismount point. Segment 2
// branches into two parallel paths (different x offsets) that both feed into ledge 2 —
// the design's required real branch. Every ledge is hazard-free beyond stamina — the real
// combat challenge lives in the jungle (Grove Bears) and the throne room (Elder Bear King),
// so the player can rest at any ledge while learning the stamina mechanic.
function buildMountain(
  wallX: number,
  baseZ: number,
  startY: number,
): {
  meshes: THREE.Object3D[];
  // Static-only subset of `meshes` (walls/ledges/gate) with the gate's Group flattened into
  // its real child Meshes — for camera-obstacle raycasting, which is non-recursive and needs
  // real Mesh objects, not Groups.
  climbMeshes: THREE.Object3D[];
  segments: ClimbSegment[];
  summitGate: THREE.Vector3;
} {
  const meshes: THREE.Object3D[] = [];
  const climbMeshes: THREE.Object3D[] = [];
  const segments: ClimbSegment[] = [];
  const segmentHeight = 6;
  const wallZWidth = 6;
  const branchOffset = 3;

  // Segment 1: single path directly above the phase-1 wall's dismount point.
  const seg1 = buildClimbSegment(wallX, baseZ, startY, wallZWidth, segmentHeight);
  meshes.push(seg1.mesh);
  climbMeshes.push(seg1.mesh);
  const ledge1 = buildLedge(wallX, seg1.wall.topY, baseZ, 8, 4);
  meshes.push(ledge1.mesh);
  climbMeshes.push(ledge1.mesh);
  segments.push({ wall: seg1.wall, ledgePosition: ledge1.position });

  // Segment 2: branches into two parallel paths that both lead to ledge 2.
  const seg2a = buildClimbSegment(wallX - branchOffset, baseZ, ledge1.position.y, wallZWidth, segmentHeight);
  const seg2b = buildClimbSegment(wallX + branchOffset, baseZ, ledge1.position.y, wallZWidth, segmentHeight);
  meshes.push(seg2a.mesh, seg2b.mesh);
  climbMeshes.push(seg2a.mesh, seg2b.mesh);
  const ledge2 = buildLedge(wallX, seg2a.wall.topY, baseZ, 8, 4);
  meshes.push(ledge2.mesh);
  climbMeshes.push(ledge2.mesh);
  segments.push({ wall: seg2a.wall, ledgePosition: ledge2.position });
  segments.push({ wall: seg2b.wall, ledgePosition: ledge2.position });

  // Segment 3: single path to the summit.
  const seg3 = buildClimbSegment(wallX, baseZ, ledge2.position.y, wallZWidth, segmentHeight);
  meshes.push(seg3.mesh);
  climbMeshes.push(seg3.mesh);
  const ledge3 = buildLedge(wallX, seg3.wall.topY, baseZ, 6, 4);
  meshes.push(ledge3.mesh);
  climbMeshes.push(ledge3.mesh);
  segments.push({ wall: seg3.wall, ledgePosition: ledge3.position });

  const summitGate = ledge3.position.clone();
  const summitGateGroup = buildSummitGate(summitGate);
  meshes.push(summitGateGroup);
  climbMeshes.push(...summitGateGroup.children);

  return { meshes, climbMeshes, segments, summitGate };
}

const THRONE_FLOOR_COLOR = 0x2e2c29; // colder, darker variant of MOUNTAIN_LEDGE_COLOR for the arena floor
const VILLAGE_BODY_COLOR = 0xb5793a; // warm ochre — deliberately contrasts the mountain's cold stone palette
const VILLAGE_TRIM_COLOR = 0xd9a441; // warm amber accent

// Same capsule-body + icosahedron-head primitive shape every creature in this project uses
// (see tuskBoar.ts, groveHare.ts) — but not rigged/animated, since these are non-interactive
// set dressing for the reveal beat, not combatants.
function buildVillager(position: THREE.Vector3): THREE.Group {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: VILLAGE_BODY_COLOR, flatShading: true, roughness: 0.85 });
  const headMat = new THREE.MeshStandardMaterial({ color: VILLAGE_TRIM_COLOR, flatShading: true, roughness: 0.6 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.5, 2, 6), bodyMat);
  body.position.set(0, 0.55, 0);
  body.castShadow = true;

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 0), headMat);
  head.position.set(0, 0.95, 0);
  head.castShadow = true;

  group.add(body, head);
  group.position.copy(position);
  group.visible = false; // hidden behind the still-closed gate until openGate() is called
  return group;
}

// Small bounded arena beyond the summit gate: the King's fight, then (hidden until the gate
// opens) the village tableau — the payoff for climbing the mountain. Follows buildMountain's
// {meshes, ...state} return shape so the call site adds meshes the same way.
function buildThroneRoom(summitGate: THREE.Vector3): { meshes: THREE.Object3D[]; throneRoom: ThroneRoom } {
  // Rectangular floor (matching every other flat surface in this file — buildLedge etc. — rather
  // than a circle, whose curvature would bulge sideways past its own bounding box and overlap
  // neighboring geometry unpredictably). ledge3 (== summitGate's own platform, built by
  // buildMountain) is a 6-wide x 4-deep slab CENTERED on summitGate, so its far edge sits at
  // summitGate.z + 2 — the floor's near edge starts a full meter past that, never overlapping it.
  const FLOOR_NEAR_Z_OFFSET = 3; // clears ledge3's far edge (summitGate.z + 2) with a 1m margin
  const FLOOR_FAR_Z_OFFSET = 24; // covers past the farthest villager (summitGate.z + 20) with a 4m margin
  const FLOOR_HALF_WIDTH = 8; // comfortably covers the king (x=0) and every villager (max |x offset| 1.6)

  const floorNearZ = summitGate.z + FLOOR_NEAR_Z_OFFSET;
  const floorFarZ = summitGate.z + FLOOR_FAR_Z_OFFSET;
  const floorDepth = floorFarZ - floorNearZ;
  const floorCenterZ = (floorNearZ + floorFarZ) / 2;

  const floorGeo = new THREE.BoxGeometry(FLOOR_HALF_WIDTH * 2, 0.3, floorDepth);
  const floorMat = new THREE.MeshStandardMaterial({ color: THRONE_FLOOR_COLOR, roughness: 1, flatShading: true });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.position.set(summitGate.x, summitGate.y - 0.15, floorCenterZ);
  floorMesh.receiveShadow = true;

  const bounds = new THREE.Box2(
    new THREE.Vector2(summitGate.x - FLOOR_HALF_WIDTH, floorNearZ),
    new THREE.Vector2(summitGate.x + FLOOR_HALF_WIDTH, floorFarZ),
  );

  // Genuine approach distance from the gate before the fight starts.
  const kingSpawn = new THREE.Vector3(summitGate.x, summitGate.y, summitGate.z + 10);
  const king = createElderBearKing();
  king.group.position.copy(kingSpawn);

  // Beyond the king, only revealed once the gate opens.
  const villageMeshes: THREE.Object3D[] = [
    buildVillager(new THREE.Vector3(summitGate.x - 1.2, summitGate.y, summitGate.z + 16)),
    buildVillager(new THREE.Vector3(summitGate.x + 1.0, summitGate.y, summitGate.z + 17.5)),
    buildVillager(new THREE.Vector3(summitGate.x - 0.4, summitGate.y, summitGate.z + 19)),
    buildVillager(new THREE.Vector3(summitGate.x + 1.6, summitGate.y, summitGate.z + 20)),
  ];

  // Real audience of animals — the ones the fox actually fought and grew stronger from —
  // flanking the aisle toward the King, in addition to the village reveal (the mountain's
  // people AND its animals both turn out for the coronation, not one replacing the other).
  // Purely decorative: real rigged models (same anatomy the user already asked to be "very real
  // looking"), no Combatant/EnemyAI, hidden until openGate() exactly like the villagers.
  const AUDIENCE_HALF_WIDTH = 6.5; // inside the floor's own 8m half-width, leaving a real margin
  const boulderMat = new THREE.MeshStandardMaterial({ color: MOUNTAIN_LEDGE_COLOR, roughness: 1, flatShading: true });
  const perchedOwlAt = (x: number, z: number): THREE.Group => {
    const group = new THREE.Group();
    const boulder = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), boulderMat);
    boulder.position.y = 0.3;
    boulder.castShadow = true;
    boulder.receiveShadow = true;
    const owl = createCanopyOwl();
    owl.group.position.y = 0.85; // clears the 0.5-radius boulder's top (center 0.3 + radius 0.5)
    group.add(boulder, owl.group);
    group.position.set(x, summitGate.y, z);
    group.visible = false;
    return group;
  };
  const groundAnimalAt = (build: () => { group: THREE.Group }, x: number, z: number, rotationY = 0): THREE.Group => {
    const entity = build();
    entity.group.position.set(x, summitGate.y, z);
    entity.group.rotation.y = rotationY;
    entity.group.visible = false;
    return entity.group;
  };
  const animalAudience: THREE.Object3D[] = [
    perchedOwlAt(summitGate.x - AUDIENCE_HALF_WIDTH, summitGate.z + 8),
    perchedOwlAt(summitGate.x + AUDIENCE_HALF_WIDTH, summitGate.z + 13),
    groundAnimalAt(createGroveBear, summitGate.x - AUDIENCE_HALF_WIDTH + 1, summitGate.z + 15, Math.PI / 2),
    groundAnimalAt(createGroveBear, summitGate.x + AUDIENCE_HALF_WIDTH - 1, summitGate.z + 6, -Math.PI / 2),
    groundAnimalAt(createVineViper, summitGate.x - AUDIENCE_HALF_WIDTH + 1.5, summitGate.z + 21, Math.PI / 2),
    groundAnimalAt(() => createGroveSquirrel(new THREE.Vector3()), summitGate.x + AUDIENCE_HALF_WIDTH - 1.5, summitGate.z + 20, -Math.PI / 2),
  ];

  const throneRoom: ThroneRoom = {
    bounds,
    kingSpawn,
    king,
    villageMeshes,
    animalAudience,
    gateOpen: false,
    openGate: () => {
      throneRoom.gateOpen = true;
      for (const mesh of throneRoom.villageMeshes) mesh.visible = true;
      for (const mesh of throneRoom.animalAudience) mesh.visible = true;
    },
  };

  // Rock-strewn perimeter along both long edges of the floor, outside the walkable bounds —
  // reads as an open rocky summit clearing rather than an indoor floor. Purely visual scatter,
  // built from the same rock-chunk clustering technique as buildRockFaceMesh but laid low and
  // wide (ground boulders) instead of tall and thin (a cliff face) — never touches `bounds`,
  // the altitude-guarded walkable footprint Game.ts's groundHeightWithLedges reads.
  const perimeterMeshes: THREE.Mesh[] = [];
  for (let i = 0; i < 14; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    // Strictly beyond FLOOR_HALF_WIDTH (never inside it) — these are perimeter dressing outside
    // the walkable floor, not props sitting on it.
    const x = summitGate.x + side * (FLOOR_HALF_WIDTH + 0.2 + Math.random() * 1.4);
    const z = floorNearZ + Math.random() * floorDepth;
    const radius = 0.35 + Math.random() * 0.55;
    const boulder = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 0), boulderMat);
    boulder.position.set(x, summitGate.y - 0.1 + radius * 0.3, z);
    boulder.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    boulder.castShadow = true;
    boulder.receiveShadow = true;
    perimeterMeshes.push(boulder);
  }

  return { meshes: [floorMesh, king.group, ...villageMeshes, ...animalAudience, ...perimeterMeshes], throneRoom };
}

function buildWater(): { mesh: THREE.Mesh; water: WaterBody } {
  const width = 8;
  const depth = 6;
  const centerX = 6;
  const centerZ = -4;
  const surfaceY = -0.3;

  const geo = new THREE.PlaneGeometry(width, depth, 24, 24);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ color: 0x0e2a3a, transparent: true, opacity: 0.75, roughness: 0.15, metalness: 0.1 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(centerX, surfaceY, centerZ);

  const water: WaterBody = {
    bounds: new THREE.Box3(
      new THREE.Vector3(centerX - width / 2, surfaceY - 2.5, centerZ - depth / 2),
      new THREE.Vector3(centerX + width / 2, surfaceY, centerZ + depth / 2),
    ),
    surfaceY,
    current: WIND.clone().multiplyScalar(0.8),
  };
  return { mesh, water };
}

// A real living sea beyond the jungle's own land bounds — real wave motion (a genuine
// vertex-shader displacement, not a static plane) and a real slow tide (the whole surface rises
// and falls over a multi-minute cycle), matching the jungle's existing night/moonlit palette
// (see Game.ts's setupLights) rather than a bright daytime ocean. Deliberately atmospheric/visual
// only, not a second swimmable WaterBody — Game.ts's swim detection reads exactly one water body
// today (this.level.water), and widening that to check multiple bodies is real, untested surface
// area on an already-proven system; the sea sits far beyond where normal play ever reaches (past
// x=20, outside the authored 40x40 chapter, well clear of the wall/mountain/throne-room/river,
// all of which stay comfortably west of x=0), so it reads as "the world continues past the
// jungle's coastline" without expanding what the player can actually do.
const SEA_SIZE = 400;
const SEA_SEGMENTS = 48;
const SEA_START_X = 20; // the jungle's own chapterBounds half-width — the sea begins right at its edge
const SEA_SURFACE_Y = -1.2; // below the jungle's own river's -0.3, reading as a real coastline drop-off
const SEA_TIDE_PERIOD_SECONDS = 150; // a real, slow tide — noticeable if watched, never jarring
const SEA_TIDE_AMPLITUDE = 0.4;

function buildLivingSea(): { mesh: THREE.Mesh; update: (time: number) => void } {
  const geo = new THREE.PlaneGeometry(SEA_SIZE, SEA_SIZE, SEA_SEGMENTS, SEA_SEGMENTS);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x0a2c3e,
    transparent: true,
    opacity: 0.88,
    roughness: 0.12,
    metalness: 0.2,
  });

  const uniforms = { uTime: { value: 0 }, uTide: { value: 0 } };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uTide = uniforms.uTide;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uTide;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        // Three overlapping sine trains at different wavelengths/speeds/directions — a single
        // sine reads as a mechanical ripple; three layered ones read as real open-water chop.
        float wave = sin(position.x * 0.07 + uTime * 0.9) * 0.32
                   + sin(position.z * 0.05 - uTime * 0.55) * 0.24
                   + sin((position.x + position.z) * 0.14 + uTime * 1.3) * 0.14;
        transformed.y += wave + uTide;`,
      );
  };

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'living-sea';
  mesh.position.set(SEA_START_X + SEA_SIZE / 2, SEA_SURFACE_Y, 0);
  mesh.receiveShadow = true;

  return {
    mesh,
    update: (time: number) => {
      uniforms.uTime.value = time;
      uniforms.uTide.value = Math.sin((time / SEA_TIDE_PERIOD_SECONDS) * Math.PI * 2) * SEA_TIDE_AMPLITUDE;
    },
  };
}

function randomPlaceablePosition(
  heightAt: (x: number, z: number) => number,
  water: WaterBody,
  wallBounds: THREE.Box2,
): THREE.Vector3 {
  let x = 0;
  let z = 0;
  let attempts = 0;
  do {
    x = (Math.random() - 0.5) * CHAPTER_SIZE;
    z = (Math.random() - 0.5) * CHAPTER_SIZE;
    attempts++;
  } while (!isPlaceable(x, z, water, wallBounds) && attempts < 100);
  return new THREE.Vector3(x, heightAt(x, z), z);
}

// How high above ground an owl perches — well clear of a standing player's reach, but low
// enough that its dive (OWL_DIVE_SPEED in Game.ts) closes the gap in well under a second.
const OWL_PERCH_HEIGHT = 3.2;
const FINCH_FLOCK_COUNT = 5; // set dressing, not a particle system — see the plan's own note

function buildWildlife(
  heightAt: (x: number, z: number) => number,
  water: WaterBody,
  wallBounds: THREE.Box2,
): {
  hares: GroveHare[];
  boars: TuskBoar[];
  bears: GroveBear[];
  owls: CanopyOwl[];
  vipers: VineViper[];
  squirrels: GroveSquirrel[];
  finchFlock: DuskFinchFlock;
  finchFlockCenter: THREE.Vector3;
} {
  const hares = Array.from({ length: 4 }, () => createGroveHare(randomPlaceablePosition(heightAt, water, wallBounds)));
  const boars = Array.from({ length: 2 }, () => {
    const boar = createTuskBoar();
    boar.group.position.copy(randomPlaceablePosition(heightAt, water, wallBounds));
    return boar;
  });
  const bears = Array.from({ length: 2 }, () => {
    const bear = createGroveBear();
    bear.group.position.copy(randomPlaceablePosition(heightAt, water, wallBounds));
    return bear;
  });
  const owls = Array.from({ length: 2 }, () => {
    const owl = createCanopyOwl();
    const ground = randomPlaceablePosition(heightAt, water, wallBounds);
    const perchY = ground.y + OWL_PERCH_HEIGHT;
    owl.perchY = perchY;
    owl.group.position.set(ground.x, perchY, ground.z);
    return owl;
  });
  const vipers = Array.from({ length: 3 }, () => {
    const viper = createVineViper();
    viper.group.position.copy(randomPlaceablePosition(heightAt, water, wallBounds));
    return viper;
  });
  const squirrels = Array.from({ length: 4 }, () =>
    createGroveSquirrel(randomPlaceablePosition(heightAt, water, wallBounds)),
  );
  const finchFlockCenter = randomPlaceablePosition(heightAt, water, wallBounds);
  const finchFlock = createDuskFinchFlock(finchFlockCenter, FINCH_FLOCK_COUNT);
  return { hares, boars, bears, owls, vipers, squirrels, finchFlock, finchFlockCenter };
}

export function createJungleLevel(): JungleLevel {
  const group = new THREE.Group();
  group.name = 'jungle-level';

  group.add(createSky());

  const { mesh: terrainMesh, heightAt } = buildTerrain();
  group.add(terrainMesh);

  const { mesh: wallMesh, wall } = buildClimbableWall(heightAt);
  group.add(wallMesh);

  const { mesh: waterMesh, water } = buildWater();
  group.add(waterMesh);

  const { meshes: foliageMeshes, update: updateFoliage, obstacles } = buildFoliage(heightAt, water, wall.bounds);
  group.add(...foliageMeshes);
  const obstacleGrid = new TreeObstacleGrid(obstacles);

  const { hares, boars, bears, owls, vipers, squirrels, finchFlock, finchFlockCenter } = buildWildlife(
    heightAt,
    water,
    wall.bounds,
  );
  group.add(...hares.map((hare) => hare.group));
  group.add(...boars.map((boar) => boar.group));
  group.add(...bears.map((bear) => bear.group));
  group.add(...owls.map((owl) => owl.group));
  group.add(...vipers.map((viper) => viper.group));
  group.add(...squirrels.map((squirrel) => squirrel.group));
  group.add(finchFlock.group);

  const mountain = buildMountain(-12, 8, wall.topY);
  group.add(...mountain.meshes);

  const { meshes: throneRoomMeshes, throneRoom } = buildThroneRoom(mountain.summitGate);
  group.add(...throneRoomMeshes);

  const { mesh: seaMesh, update: updateSea } = buildLivingSea();
  group.add(seaMesh);

  const half = CHAPTER_SIZE / 2;
  const chapterBounds = new THREE.Box3(new THREE.Vector3(-half, -5, -half), new THREE.Vector3(half, 40, half));

  return {
    group,
    groundHeightAt: heightAt,
    climbableWall: wall,
    water,
    chapterBounds,
    hares,
    boars,
    bears,
    owls,
    vipers,
    squirrels,
    finchFlock,
    finchFlockCenter,
    obstacleGrid,
    foliageMeshes,
    climbObstacleMeshes: [wallMesh, ...mountain.climbMeshes],
    mountain: { segments: mountain.segments, summitGate: mountain.summitGate },
    throneRoom,
    update: (time: number) => {
      updateFoliage(time);
      updateSea(time);
    },
  };
}
