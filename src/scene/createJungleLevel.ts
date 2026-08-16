import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { WaterBody } from '../game/WaterBody';
import { createSky } from './createSky';
import { createGroveHare, type GroveHare } from '../entities/groveHare';
import { createTuskBoar, type TuskBoar } from '../entities/tuskBoar';
import { TreeObstacleGrid, type TreeObstacle } from './TreeObstacleGrid';

export interface ClimbableWall {
  normal: THREE.Vector3;
  topY: number;
  bounds: THREE.Box2; // x/z footprint at the wall's base
}

export interface JungleLevel {
  group: THREE.Group;
  groundHeightAt(x: number, z: number): number;
  climbableWall: ClimbableWall;
  water: WaterBody;
  chapterBounds: THREE.Box3;
  hares: GroveHare[];
  boars: TuskBoar[];
  obstacleGrid: TreeObstacleGrid;
  foliageMeshes: THREE.InstancedMesh[];
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

function buildClimbableWall(heightAt: (x: number, z: number) => number): { mesh: THREE.Mesh; wall: ClimbableWall } {
  const wallX = -12;
  const wallZWidth = 6;
  const baseZ = 8;
  const baseY = heightAt(wallX, baseZ);
  const height = 6;

  const geo = new THREE.BoxGeometry(0.6, height, wallZWidth);
  const mat = new THREE.MeshStandardMaterial({ color: 0x2c2216, roughness: 1, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(wallX, baseY + height / 2, baseZ);
  mesh.castShadow = true;

  const wall: ClimbableWall = {
    normal: new THREE.Vector3(1, 0, 0),
    topY: baseY + height,
    bounds: new THREE.Box2(
      new THREE.Vector2(wallX - 0.3, baseZ - wallZWidth / 2),
      new THREE.Vector2(wallX + 0.3, baseZ + wallZWidth / 2),
    ),
  };
  return { mesh, wall };
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

function buildWildlife(
  heightAt: (x: number, z: number) => number,
  water: WaterBody,
  wallBounds: THREE.Box2,
): { hares: GroveHare[]; boars: TuskBoar[] } {
  const hares = Array.from({ length: 4 }, () => createGroveHare(randomPlaceablePosition(heightAt, water, wallBounds)));
  const boars = Array.from({ length: 2 }, () => {
    const boar = createTuskBoar();
    boar.group.position.copy(randomPlaceablePosition(heightAt, water, wallBounds));
    return boar;
  });
  return { hares, boars };
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

  const { hares, boars } = buildWildlife(heightAt, water, wall.bounds);
  group.add(...hares.map((hare) => hare.group));
  group.add(...boars.map((boar) => boar.group));

  const half = CHAPTER_SIZE / 2;
  const chapterBounds = new THREE.Box3(new THREE.Vector3(-half, -5, -half), new THREE.Vector3(half, 10, half));

  return {
    group,
    groundHeightAt: heightAt,
    climbableWall: wall,
    water,
    chapterBounds,
    hares,
    boars,
    obstacleGrid,
    foliageMeshes,
    update: updateFoliage,
  };
}
