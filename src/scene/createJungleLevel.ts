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
import { createLion, type Lion } from '../entities/createLion';
import { createGroveSquirrel, type GroveSquirrel } from '../entities/createGroveSquirrel';
import { createCrocodile, type Crocodile } from '../entities/createCrocodile';
import { createDuskFinchFlock, type DuskFinchFlock } from '../entities/createDuskFinchFlock';
import { createFishSchool } from '../entities/createFishSchool';
import { createShark, type Shark } from '../entities/createShark';
import { createMonkey, type Monkey } from '../entities/createMonkey';
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
  // The living sea's own real swimmable bounds — 4 bodies, one per ring slab (see
  // buildLivingSea's own comment on the 4-slab-ring shape), each a real WaterBody so
  // Game.ts's existing swim-entry/updateSwim machinery works identically to the jungle pond,
  // just against a different body. Previously the sea was deliberately visual-only (walking
  // straight through it) — the user directly asked for real swim gating, closing that gap.
  livingSea: WaterBody[];
  sharks: Shark[];
  chapterBounds: THREE.Box3;
  hares: GroveHare[];
  boars: TuskBoar[];
  bears: GroveBear[];
  owls: CanopyOwl[];
  vipers: VineViper[];
  lions: Lion[];
  squirrels: GroveSquirrel[];
  crocodiles: Crocodile[];
  monkeys: Monkey[];
  finchFlock: DuskFinchFlock;
  // Not exposed by DuskFinchFlock itself (its `group` stays at local origin — each finch's own
  // rig.root carries its real world position) — Game.ts needs this to compute distanceToPlayer
  // for the flock's own update() call.
  finchFlockCenter: THREE.Vector3;
  obstacleGrid: TreeObstacleGrid;
  foliageMeshes: THREE.InstancedMesh[];
  // Trunk-only subset of foliageMeshes for camera obstacle-avoidance raycasting. A tree trunk is
  // a real hard blocker worth pulling the camera in for; a leafy canopy lobe is decoration — camera
  // avoidance treating canopy as a solid obstacle was pulling the camera in (or triggering the
  // player's own render-layer self-hide) at ~36%/~5% of random jungle positions respectively, since
  // 1300 densely-placed trees' canopy lobes routinely overlap the sightline even when nothing solid
  // actually blocks it. Rendering (`foliageMeshes`, unchanged) still includes canopy; only the
  // camera obstacle list is narrowed.
  treeTrunkMeshes: THREE.InstancedMesh[];
  // Static wall/ledge/gate meshes (real Meshes, Groups pre-flattened) the camera should also
  // raycast against — e.g. the hawk-eye view being blocked by an overhanging mountain ledge.
  climbObstacleMeshes: THREE.Object3D[];
  mountain: {
    segments: ClimbSegment[];
    summitGate: THREE.Vector3;
  };
  throneRoom: ThroneRoom;
  // tideAmplitudeMultiplier defaults to 1 (the original fixed-amplitude tide) so every existing
  // caller that only ever passed `time` — including this file's own test suite — stays
  // byte-identical; WeatherSystem is the only real caller of the widened form.
  update(time: number, tideAmplitudeMultiplier?: number): void;
}

const CHAPTER_SIZE = 40; // meters, one bounded region
const TERRAIN_SEGMENTS = 48;
const WIND = new THREE.Vector3(0.6, 0, 0.2).normalize(); // shared by foliage sway and water waves
// Real, previously-missing seafloor: the rendered terrain MESH already stops exactly at the
// island's edge (PlaneGeometry sized to CHAPTER_SIZE below), but heightAt() itself is a pure
// formula with no boundary check — called with any x/z (Game.ts's groundHeightWithLedges calls
// it for the player's real position everywhere, including out over the living sea). Without this
// guard, walking off the island's edge toward the sea kept "landing" on the jungle sine-formula's
// own extrapolated noise (near y=0) instead of ever falling — real swim-entry into the sea could
// never trigger, since the player's grounded Y never dropped into any sea body's real Y range.
// -20 sits safely below every sea body's own min.y (SEA_SURFACE_Y - SEA_SWIM_DEPTH = -7.2).
const DEEP_OCEAN_FLOOR_Y = -20;

function buildTerrain(): { mesh: THREE.Mesh; heightAt: (x: number, z: number) => number } {
  const geo = new THREE.PlaneGeometry(CHAPTER_SIZE, CHAPTER_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const islandHalf = CHAPTER_SIZE / 2;
  const heightAt = (x: number, z: number) => {
    if (Math.abs(x) > islandHalf || Math.abs(z) > islandHalf) return DEEP_OCEAN_FLOOR_Y;
    return Math.sin(x * 0.15) * 0.6 + Math.cos(z * 0.12) * 0.5 - Math.max(0, 3 - Math.hypot(x - 6, z + 4)) * 0.4; // riverbank dip near the water crossing
  };

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
): {
  meshes: THREE.InstancedMesh[];
  trunkMeshes: THREE.InstancedMesh[];
  update: (time: number) => void;
  obstacles: TreeObstacle[];
} {
  const COUNT = 1300;
  const windDir2 = new THREE.Vector2(WIND.x, WIND.z).normalize();

  const perSpeciesCount = Math.ceil(COUNT / TREE_SPECIES.length);
  const speciesMeshes = TREE_SPECIES.map((species) => buildTreeSpeciesMeshes(species, perSpeciesCount, windDir2));
  const placedPerSpecies = new Array(TREE_SPECIES.length).fill(0);
  const treeObstacles: TreeObstacle[] = [];

  const dummy = new THREE.Object3D();
  let totalPlaced = 0;
  let attempts = 0;

  // Real forests keep a minimum crown-to-crown spacing between trunks (that's WHY canopies don't
  // permanently overlap each other) — the old placement loop had zero such check, so trunks could
  // land arbitrarily close by pure chance. That was the real root cause of the camera's obstacle
  // avoidance frequently pulling in/self-hiding the player (measured live: ~12% of random jungle
  // positions triggered the fox's own render-layer self-hide before this fix) — not just canopy
  // being treated as a hard obstacle (fixed separately, see treeTrunkMeshes above). MIN_TREE_SPACING
  // is checked against every already-placed tree's own (unscaled-worst-case) trunk radius.
  const MIN_TREE_SPACING = 0.7;

  while (totalPlaced < COUNT && attempts < COUNT * 6) {
    attempts++;
    const x = (Math.random() - 0.5) * CHAPTER_SIZE;
    const z = (Math.random() - 0.5) * CHAPTER_SIZE;
    if (!isPlaceable(x, z, water, wallBounds)) continue;
    if (treeObstacles.some((tree) => (tree.x - x) ** 2 + (tree.z - z) ** 2 < MIN_TREE_SPACING ** 2)) continue;

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
  const trunkMeshes: THREE.InstancedMesh[] = [];
  speciesMeshes.forEach(({ trunkMesh, canopyMesh }, i) => {
    trunkMesh.count = placedPerSpecies[i];
    canopyMesh.count = placedPerSpecies[i];
    trunkMesh.instanceMatrix.needsUpdate = true;
    canopyMesh.instanceMatrix.needsUpdate = true;
    meshes.push(trunkMesh, canopyMesh);
    trunkMeshes.push(trunkMesh);
  });

  return {
    meshes,
    trunkMeshes,
    update: (time: number) => {
      speciesMeshes.forEach(({ uniforms }) => {
        uniforms.uTime.value = time;
      });
    },
    obstacles: treeObstacles,
  };
}

const FERN_COLOR = 0x2c5a34;
const FERN_COLOR_DARK = 0x1e4526;
const LOG_COLOR = 0x4a3626;
const CLUTTER_ROCK_COLOR = 0x5a5648;

/** Real jungle-floor detail: ferns, fallen logs, and scattered rocks — the ground-level density
 * "improve the area of jungle" was actually asking for. `buildFoliage` above already puts 1300
 * real trees across the island (canopy density was never the gap); what the floor BETWEEN those
 * trees has always lacked is anything at eye level. Purely visual, same as the throne room's own
 * perimeter boulders — no new collision geometry, so this can't regress movement/pathing. */
function buildFern(): THREE.BufferGeometry {
  // A real fern's silhouette: several thin, flattened, tapering fronds radiating from one base
  // point at different angles/heights — not a single blob. Built the same lobe-merge technique
  // buildTreeSpeciesMeshes uses for canopies.
  const frondGeoms: THREE.BufferGeometry[] = [];
  const frondCount = 6;
  for (let i = 0; i < frondCount; i++) {
    const angle = (i / frondCount) * Math.PI * 2 + Math.random() * 0.3;
    const frond = new THREE.ConeGeometry(0.035, 0.32, 3);
    frond.rotateX(Math.PI / 2 - 0.5); // tilts the frond up and outward from vertical
    frond.rotateY(angle);
    frond.translate(Math.cos(angle) * 0.12, 0.12, Math.sin(angle) * 0.12);
    frondGeoms.push(frond);
  }
  const merged = mergeGeometries(frondGeoms, false);
  if (!merged) throw new Error('buildFern: failed to merge frond geometry');
  return merged;
}

function buildGroundClutter(
  heightAt: (x: number, z: number) => number,
  water: WaterBody,
  wallBounds: THREE.Box2,
): THREE.Object3D[] {
  const meshes: THREE.Object3D[] = [];
  const dummy = new THREE.Object3D();

  const FERN_COUNT = 450;
  const fernGeo = buildFern();
  const fernMat = new THREE.MeshStandardMaterial({ color: FERN_COLOR, flatShading: true, roughness: 0.9 });
  const fernMesh = new THREE.InstancedMesh(fernGeo, fernMat, FERN_COUNT);
  fernMesh.name = 'ground-ferns';
  let fernPlaced = 0;
  let attempts = 0;
  while (fernPlaced < FERN_COUNT && attempts < FERN_COUNT * 4) {
    attempts++;
    const x = (Math.random() - 0.5) * CHAPTER_SIZE;
    const z = (Math.random() - 0.5) * CHAPTER_SIZE;
    if (!isPlaceable(x, z, water, wallBounds)) continue;
    dummy.position.set(x, heightAt(x, z), z);
    dummy.rotation.y = Math.random() * Math.PI * 2;
    dummy.scale.setScalar(0.7 + Math.random() * 0.8);
    dummy.updateMatrix();
    fernMesh.setMatrixAt(fernPlaced, dummy.matrix);
    fernPlaced++;
  }
  fernMesh.count = fernPlaced;
  fernMesh.instanceMatrix.needsUpdate = true;
  meshes.push(fernMesh);

  // A second, darker fern variant scattered more sparsely — real jungle floor has real color
  // variety underfoot, not one repeated plant.
  const FERN_DARK_COUNT = 180;
  const fernDarkMat = new THREE.MeshStandardMaterial({ color: FERN_COLOR_DARK, flatShading: true, roughness: 0.95 });
  const fernDarkMesh = new THREE.InstancedMesh(fernGeo, fernDarkMat, FERN_DARK_COUNT);
  fernDarkMesh.name = 'ground-ferns-dark';
  let fernDarkPlaced = 0;
  attempts = 0;
  while (fernDarkPlaced < FERN_DARK_COUNT && attempts < FERN_DARK_COUNT * 4) {
    attempts++;
    const x = (Math.random() - 0.5) * CHAPTER_SIZE;
    const z = (Math.random() - 0.5) * CHAPTER_SIZE;
    if (!isPlaceable(x, z, water, wallBounds)) continue;
    dummy.position.set(x, heightAt(x, z), z);
    dummy.rotation.y = Math.random() * Math.PI * 2;
    dummy.scale.setScalar(0.55 + Math.random() * 0.6);
    dummy.updateMatrix();
    fernDarkMesh.setMatrixAt(fernDarkPlaced, dummy.matrix);
    fernDarkPlaced++;
  }
  fernDarkMesh.count = fernDarkPlaced;
  fernDarkMesh.instanceMatrix.needsUpdate = true;
  meshes.push(fernDarkMesh);

  // Fallen logs: sparse, real forest-floor decay — a living jungle has dead wood on the ground,
  // not just standing trees.
  const LOG_COUNT = 18;
  const logGeo = new THREE.CylinderGeometry(0.09, 0.11, 1.4, 6);
  const logMat = new THREE.MeshStandardMaterial({ color: LOG_COLOR, flatShading: true, roughness: 0.95 });
  for (let i = 0; i < LOG_COUNT; i++) {
    let x = 0;
    let z = 0;
    let placed = false;
    for (let a = 0; a < 20; a++) {
      x = (Math.random() - 0.5) * CHAPTER_SIZE;
      z = (Math.random() - 0.5) * CHAPTER_SIZE;
      if (isPlaceable(x, z, water, wallBounds)) {
        placed = true;
        break;
      }
    }
    if (!placed) continue;
    const log = new THREE.Mesh(logGeo, logMat);
    log.name = 'ground-log';
    log.position.set(x, heightAt(x, z) + 0.09, z);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = Math.random() * Math.PI * 2;
    log.scale.setScalar(0.8 + Math.random() * 0.5);
    log.castShadow = true;
    log.receiveShadow = true;
    meshes.push(log);
  }

  // Scattered rocks: small 2-lobe clusters (same clustering technique as the mane/canopy lobes),
  // real terrain variety, not perfectly smooth ground everywhere.
  const ROCK_COUNT = 60;
  const rockMat = new THREE.MeshStandardMaterial({ color: CLUTTER_ROCK_COLOR, flatShading: true, roughness: 1 });
  for (let i = 0; i < ROCK_COUNT; i++) {
    let x = 0;
    let z = 0;
    let placed = false;
    for (let a = 0; a < 20; a++) {
      x = (Math.random() - 0.5) * CHAPTER_SIZE;
      z = (Math.random() - 0.5) * CHAPTER_SIZE;
      if (isPlaceable(x, z, water, wallBounds)) {
        placed = true;
        break;
      }
    }
    if (!placed) continue;
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1 + Math.random() * 0.1, 0), rockMat);
    rock.name = 'ground-rock';
    rock.position.set(x, heightAt(x, z) + 0.05, z);
    rock.rotation.set(Math.random(), Math.random() * Math.PI * 2, Math.random());
    rock.castShadow = true;
    rock.receiveShadow = true;
    meshes.push(rock);
  }

  return meshes;
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
function buildRockFaceMesh(
  thickness: number,
  height: number,
  faceWidth: number,
  color: number,
  pathAt: (heightAboveBase: number) => { dx: number; dz: number } = () => ({ dx: 0, dz: 0 }),
): THREE.Mesh {
  const CHUNK_COUNT = 12;
  const geoms: THREE.BufferGeometry[] = [];
  for (let i = 0; i < CHUNK_COUNT; i++) {
    const radius = thickness * (1.1 + Math.random() * 0.9);
    const geo = new THREE.IcosahedronGeometry(radius, 0);
    // Flatten toward a slab (thin along X, the wall's thickness axis) rather than a round boulder.
    geo.scale(0.55 + Math.random() * 0.35, 1 + Math.random() * 0.7, 0.7 + Math.random() * 0.6);
    const x = thickness * (0.15 + Math.random() * 0.55); // biased outward — chunks jut toward the climber
    const y = (Math.random() - 0.5) * height * 0.96;
    // Bias toward the real path's own drift at this chunk's height (y ranges -height/2..height/2,
    // so shift to a real 0..height "heightAboveBase" before sampling the path), plus real jitter
    // so it doesn't read as a mechanically precise line of boulders.
    const heightAboveBase = y + height / 2;
    const { dz: pathDz } = pathAt(heightAboveBase);
    const z = pathDz + (Math.random() - 0.5) * faceWidth * 0.4;
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

  const path = makeWindingPath(CLIMB_PATH_AMPLITUDE, CLIMB_PATH_WAVELENGTH);
  const mesh = buildRockFaceMesh(0.6, height, wallZWidth, 0x2c2216, path);
  mesh.position.set(wallX, baseY + height / 2, baseZ);

  const wall: ClimbableWall = {
    normal: new THREE.Vector3(1, 0, 0),
    topY: baseY + height,
    bounds: new THREE.Box2(
      new THREE.Vector2(wallX - 0.3, baseZ - wallZWidth / 2),
      new THREE.Vector2(wallX + 0.3, baseZ + wallZWidth / 2),
    ),
    pathAt: path,
  };
  return { mesh, wall };
}

const MOUNTAIN_WALL_COLOR = 0x2c2216; // matches the phase-1 climbable wall
const MOUNTAIN_LEDGE_COLOR = 0x4a4842; // matches mountainGuard.ts's stone
const MOUNTAIN_GATE_TRIM_COLOR = 0x8a6a3a; // matches mountainGuard.ts's trim
const CLIMB_PATH_AMPLITUDE = 1.2; // meters either side of the wall's own base Z — inside wallZWidth=6
const CLIMB_PATH_WAVELENGTH = 4; // meters of height per full winding cycle

// Generalized version of buildClimbableWall's pattern: stacked segments need an explicit
// base Y (the ledge below them) rather than deriving it from ground terrain.
function buildClimbSegment(
  wallX: number,
  baseZ: number,
  baseY: number,
  wallZWidth: number,
  height: number,
): { mesh: THREE.Mesh; wall: ClimbableWall } {
  const path = makeWindingPath(CLIMB_PATH_AMPLITUDE, CLIMB_PATH_WAVELENGTH);
  const mesh = buildRockFaceMesh(0.6, height, wallZWidth, MOUNTAIN_WALL_COLOR, path);
  mesh.position.set(wallX, baseY + height / 2, baseZ);

  const wall: ClimbableWall = {
    normal: new THREE.Vector3(1, 0, 0),
    topY: baseY + height,
    bounds: new THREE.Box2(
      new THREE.Vector2(wallX - 0.3, baseZ - wallZWidth / 2),
      new THREE.Vector2(wallX + 0.3, baseZ + wallZWidth / 2),
    ),
    pathAt: path,
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
  // Real path endpoint — where the wall's own winding path actually lands after a full
  // segment's height — not the shared, fixed baseZ every segment used to sit on. seg1's own
  // pathAt(0) is guaranteed (0, 0) by construction, so this is exactly baseZ plus the real
  // drift at segmentHeight.
  const seg1LedgeZ = baseZ + seg1.wall.pathAt(segmentHeight).dz;
  const ledge1 = buildLedge(wallX, seg1.wall.topY, seg1LedgeZ, 8, 4);
  meshes.push(ledge1.mesh);
  climbMeshes.push(ledge1.mesh);
  segments.push({ wall: seg1.wall, ledgePosition: ledge1.position });

  // Segment 2: branches into two parallel paths, each based at ledge 1's real Z, that both lead
  // to ledge 2.
  const seg2a = buildClimbSegment(wallX - branchOffset, seg1LedgeZ, ledge1.position.y, wallZWidth, segmentHeight);
  const seg2b = buildClimbSegment(wallX + branchOffset, seg1LedgeZ, ledge1.position.y, wallZWidth, segmentHeight);
  meshes.push(seg2a.mesh, seg2b.mesh);
  climbMeshes.push(seg2a.mesh, seg2b.mesh);
  // Both branches share ledge 2's real position; anchoring to seg2a's own path endpoint is an
  // arbitrary-but-consistent choice — a player finishing either branch lands on the same real
  // ledge2 object either way, exactly like before this change.
  const ledge2Z = seg1LedgeZ + seg2a.wall.pathAt(segmentHeight).dz;
  const ledge2 = buildLedge(wallX, seg2a.wall.topY, ledge2Z, 8, 4);
  meshes.push(ledge2.mesh);
  climbMeshes.push(ledge2.mesh);
  segments.push({ wall: seg2a.wall, ledgePosition: ledge2.position });
  segments.push({ wall: seg2b.wall, ledgePosition: ledge2.position });

  // Segment 3: single path to the summit, based at ledge 2's real Z.
  const seg3 = buildClimbSegment(wallX, ledge2Z, ledge2.position.y, wallZWidth, segmentHeight);
  meshes.push(seg3.mesh);
  climbMeshes.push(seg3.mesh);
  const seg3LedgeZ = ledge2Z + seg3.wall.pathAt(segmentHeight).dz;
  const ledge3 = buildLedge(wallX, seg3.wall.topY, seg3LedgeZ, 6, 4);
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
// vertex-shader displacement, not a static plane), foam/whitecap tinting at wave crests (a real
// fragment-shader brightening keyed off the same wave height the vertex stage computes, not a
// texture), and a real slow tide (the whole surface rises and falls over a multi-minute cycle),
// matching the jungle's existing night/moonlit palette (see Game.ts's setupLights) rather than a
// bright daytime ocean. Deliberately atmospheric/visual only, not a second swimmable WaterBody —
// Game.ts's swim detection reads exactly one water body today (this.level.water), and widening
// that to check multiple bodies is real, untested surface area on an already-proven system.
//
// Built as a 4-slab RING around the whole 40x40 island (not one strip off the east edge, which is
// what shipped originally and is what the user later flagged as "not covering the entire
// island") — north/south slabs are full outer-width (CHAPTER_SIZE + 2*SEA_SIZE) so they also
// cover the 4 corners; east/west slabs only need to span the island's own depth, since the
// corners are already covered. Every slab starts exactly at the island's edge (x=±20 or z=±20)
// and extends outward, the same "well clear of the wall/mountain/throne-room/river, all of which
// stay comfortably inside x∈[-20,20]" safety property the original single strip had.
const SEA_SIZE = 400; // how far each slab extends outward past the island's edge
const SEA_SEGMENTS = 48;
const ISLAND_HALF = CHAPTER_SIZE / 2; // 20 — matches chapterBounds' own half-width below
const SEA_SURFACE_Y = -1.2; // below the jungle's own river's -0.3, reading as a real coastline drop-off
const SEA_TIDE_PERIOD_SECONDS = 150; // a real, slow tide — noticeable if watched, never jarring
const SEA_TIDE_AMPLITUDE = 0.4;

const SEA_MAT_PARAMS = {
  color: 0x1c4a63,
  transparent: true,
  opacity: 0.9,
  roughness: 0.08,
  metalness: 0.25,
  emissive: 0x0d2333,
  emissiveIntensity: 0.55,
} as const;

function buildSeaSlab(width: number, depth: number, x: number, z: number, uniforms: { uTime: { value: number }; uTide: { value: number } }): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(width, depth, SEA_SEGMENTS, SEA_SEGMENTS);
  geo.rotateX(-Math.PI / 2);
  // Found live: the sea was rendering correctly all along, but its original color (0x0a2c3e) was
  // nearly identical to the scene's own fog/background color (0x0a1420) — a real ocean blended
  // invisibly into the night sky the instant fog started dimming it. A lighter, more saturated
  // base color plus a real emissive tint (moonlight's own cool 0xafc8ff hue, the same one Game.ts's
  // directional moonlight already uses) gives the surface a base visibility that doesn't depend on
  // catching direct light at the right angle.
  const mat = new THREE.MeshStandardMaterial({ ...SEA_MAT_PARAMS });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uTide = uniforms.uTide;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uTide;
        varying float vWaveHeight;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        // Three overlapping sine trains at different wavelengths/speeds/directions — a single
        // sine reads as a mechanical ripple; three layered ones read as real open-water chop.
        float wave = sin(position.x * 0.07 + uTime * 0.9) * 0.32
                   + sin(position.z * 0.05 - uTime * 0.55) * 0.24
                   + sin((position.x + position.z) * 0.14 + uTime * 1.3) * 0.14;
        transformed.y += wave + uTide;
        vWaveHeight = wave;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying float vWaveHeight;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        // Real whitecap foam: wave crests (the top of the 0.7-amplitude combined sine train)
        // brighten toward a pale foam tint, troughs stay the base dark water color — a cheap,
        // real per-vertex-driven equivalent of a foam texture, matching this project's
        // shader-not-texture convention for every other animated surface (foliage sway, tide).
        float foam = smoothstep(0.45, 0.7, vWaveHeight);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.82, 0.92, 0.95), foam * 0.5);`,
      );
  };

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'living-sea';
  mesh.position.set(x, SEA_SURFACE_Y, z);
  mesh.receiveShadow = true;
  return mesh;
}

// Real ocean depth for swim bounds — deeper than the jungle pond's own 2.5m (buildWater()),
// matching a real open sea rather than a shallow pond.
const SEA_SWIM_DEPTH = 6;

/** One real WaterBody per ring slab, matching that slab's exact width/depth/x/z footprint —
 * lets Game.ts's existing isInsideWaterBody/updateSwim machinery treat the sea exactly like the
 * jungle pond, just as 4 separate real bodies instead of one. A real, slightly stronger current
 * than the pond's (the open sea pulls harder than still pond water). */
function seaSlabWaterBody(width: number, depth: number, x: number, z: number): WaterBody {
  return {
    bounds: new THREE.Box3(
      new THREE.Vector3(x - width / 2, SEA_SURFACE_Y - SEA_SWIM_DEPTH, z - depth / 2),
      new THREE.Vector3(x + width / 2, SEA_SURFACE_Y, z + depth / 2),
    ),
    surfaceY: SEA_SURFACE_Y,
    current: WIND.clone().multiplyScalar(1.4),
  };
}

function buildLivingSea(): {
  meshes: THREE.Mesh[];
  bodies: WaterBody[];
  update: (time: number, tideAmplitudeMultiplier: number) => void;
} {
  const uniforms = { uTime: { value: 0 }, uTide: { value: 0 } };

  const outerHalfWidth = ISLAND_HALF + SEA_SIZE; // north/south slabs' half-width, reaching past the corners
  const slabParams: Array<[number, number, number, number]> = [
    [SEA_SIZE, CHAPTER_SIZE, ISLAND_HALF + SEA_SIZE / 2, 0], // east
    [SEA_SIZE, CHAPTER_SIZE, -(ISLAND_HALF + SEA_SIZE / 2), 0], // west
    [outerHalfWidth * 2, SEA_SIZE, 0, ISLAND_HALF + SEA_SIZE / 2], // north (covers corners)
    [outerHalfWidth * 2, SEA_SIZE, 0, -(ISLAND_HALF + SEA_SIZE / 2)], // south (covers corners)
  ];
  const meshes = slabParams.map(([width, depth, x, z]) => buildSeaSlab(width, depth, x, z, uniforms));
  const bodies = slabParams.map(([width, depth, x, z]) => seaSlabWaterBody(width, depth, x, z));

  return {
    meshes,
    bodies,
    update: (time: number, tideAmplitudeMultiplier: number) => {
      uniforms.uTime.value = time;
      uniforms.uTide.value = Math.sin((time / SEA_TIDE_PERIOD_SECONDS) * Math.PI * 2) * SEA_TIDE_AMPLITUDE * tideAmplitudeMultiplier;
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

// A real ambush predator's real position: right at the water's edge, not deep in the jungle
// canopy where every other ground species roams. Samples a random point just outside one of the
// water body's 4 edges (a real narrow band, not "anywhere placeable") — isPlaceable's own
// exclusion margin already keeps it out of the water itself.
function randomWaterEdgePosition(
  heightAt: (x: number, z: number) => number,
  water: WaterBody,
  wallBounds: THREE.Box2,
): THREE.Vector3 {
  const { min, max } = water.bounds;
  const bandMin = EXCLUSION_MARGIN;
  const bandMax = EXCLUSION_MARGIN + 2.5;
  let x = 0;
  let z = 0;
  let attempts = 0;
  do {
    const side = Math.floor(Math.random() * 4);
    const along = Math.random();
    const offset = bandMin + Math.random() * (bandMax - bandMin);
    switch (side) {
      case 0:
        x = min.x + along * (max.x - min.x);
        z = min.z - offset;
        break;
      case 1:
        x = min.x + along * (max.x - min.x);
        z = max.z + offset;
        break;
      case 2:
        x = min.x - offset;
        z = min.z + along * (max.z - min.z);
        break;
      default:
        x = max.x + offset;
        z = min.z + along * (max.z - min.z);
        break;
    }
    attempts++;
  } while (!isPlaceable(x, z, water, wallBounds) && attempts < 40);
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
  lions: Lion[];
  squirrels: GroveSquirrel[];
  crocodiles: Crocodile[];
  monkeys: Monkey[];
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
  // A real apex predator is rare, not one of a small pack — one lion, the same "singular, worth
  // real caution" scarcity the King (also singular) gets, distinct from every other species'
  // 2-4 count.
  const lions = Array.from({ length: 1 }, () => {
    const lion = createLion();
    lion.group.position.copy(randomPlaceablePosition(heightAt, water, wallBounds));
    return lion;
  });
  const squirrels = Array.from({ length: 4 }, () =>
    createGroveSquirrel(randomPlaceablePosition(heightAt, water, wallBounds)),
  );
  // A real ambush predator belongs at the water's edge, not scattered anywhere in the jungle
  // like every other ground species — same "rare, worth real caution" scarcity as the lion.
  const crocodiles = Array.from({ length: 1 }, () => {
    const crocodile = createCrocodile();
    crocodile.group.position.copy(randomWaterEdgePosition(heightAt, water, wallBounds));
    return crocodile;
  });
  // Real monkeys travel in a small troop, not scattered solo like the lion/crocodile's
  // deliberate rarity — a real social-group count, matching the hare/squirrel's own 3-4 range.
  const monkeys = Array.from({ length: 3 }, () => {
    const monkey = createMonkey();
    monkey.group.position.copy(randomPlaceablePosition(heightAt, water, wallBounds));
    return monkey;
  });
  const finchFlockCenter = randomPlaceablePosition(heightAt, water, wallBounds);
  const finchFlock = createDuskFinchFlock(finchFlockCenter, FINCH_FLOCK_COUNT);
  return { hares, boars, bears, owls, vipers, lions, squirrels, crocodiles, monkeys, finchFlock, finchFlockCenter };
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

  const {
    meshes: foliageMeshes,
    trunkMeshes: treeTrunkMeshes,
    update: updateFoliage,
    obstacles,
  } = buildFoliage(heightAt, water, wall.bounds);
  group.add(...foliageMeshes);
  const obstacleGrid = new TreeObstacleGrid(obstacles);

  const groundClutterMeshes = buildGroundClutter(heightAt, water, wall.bounds);
  group.add(...groundClutterMeshes);

  const { hares, boars, bears, owls, vipers, lions, squirrels, crocodiles, monkeys, finchFlock, finchFlockCenter } =
    buildWildlife(heightAt, water, wall.bounds);
  group.add(...hares.map((hare) => hare.group));
  group.add(...boars.map((boar) => boar.group));
  group.add(...bears.map((bear) => bear.group));
  group.add(...owls.map((owl) => owl.group));
  group.add(...vipers.map((viper) => viper.group));
  group.add(...lions.map((lion) => lion.group));
  group.add(...squirrels.map((squirrel) => squirrel.group));
  group.add(...crocodiles.map((crocodile) => crocodile.group));
  group.add(...monkeys.map((monkey) => monkey.group));
  group.add(finchFlock.group);

  const mountain = buildMountain(-12, 8, wall.topY);
  group.add(...mountain.meshes);

  const { meshes: throneRoomMeshes, throneRoom } = buildThroneRoom(mountain.summitGate);
  group.add(...throneRoomMeshes);

  const { meshes: seaMeshes, bodies: livingSea, update: updateSea } = buildLivingSea();
  group.add(...seaMeshes);

  // One fish school just offshore of each of the 4 coastlines — real sea life, not an empty ring
  // of water. Placed a little past the island's edge and a little into each sea slab, at a real
  // swimming depth (createFishSchool's own SCHOOL_DEPTH_BELOW_SURFACE keeps them under the waves).
  const half = CHAPTER_SIZE / 2;
  const OFFSHORE_MARGIN = 6;
  const fishSchools = [
    createFishSchool(new THREE.Vector3(half + OFFSHORE_MARGIN, SEA_SURFACE_Y, 0)),
    createFishSchool(new THREE.Vector3(-(half + OFFSHORE_MARGIN), SEA_SURFACE_Y, 0)),
    createFishSchool(new THREE.Vector3(0, SEA_SURFACE_Y, half + OFFSHORE_MARGIN)),
    createFishSchool(new THREE.Vector3(0, SEA_SURFACE_Y, -(half + OFFSHORE_MARGIN))),
  ];
  group.add(...fishSchools.map((school) => school.group));

  // One real shark for the living sea — the first fightable species that never touches the
  // ground at all. Placed offshore of the east coastline (same real footprint the east sea
  // slab/fish school already use) at a real mid-water swimming depth, not right at the surface.
  const sharks = [createShark()];
  sharks[0].group.position.set(half + OFFSHORE_MARGIN, SEA_SURFACE_Y - 2, 0);
  group.add(...sharks.map((shark) => shark.group));

  const chapterBounds = new THREE.Box3(new THREE.Vector3(-half, -5, -half), new THREE.Vector3(half, 40, half));

  return {
    group,
    groundHeightAt: heightAt,
    climbableWall: wall,
    water,
    livingSea,
    sharks,
    chapterBounds,
    hares,
    boars,
    bears,
    owls,
    vipers,
    lions,
    squirrels,
    crocodiles,
    monkeys,
    finchFlock,
    finchFlockCenter,
    obstacleGrid,
    foliageMeshes,
    treeTrunkMeshes,
    climbObstacleMeshes: [wallMesh, ...mountain.climbMeshes],
    mountain: { segments: mountain.segments, summitGate: mountain.summitGate },
    throneRoom,
    update: (time: number, tideAmplitudeMultiplier = 1) => {
      updateFoliage(time);
      updateSea(time, tideAmplitudeMultiplier);
      for (const school of fishSchools) school.update(time);
    },
  };
}
