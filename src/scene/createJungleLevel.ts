import * as THREE from 'three';
import type { WaterBody } from '../game/WaterBody';
import { createSky } from './createSky';

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

function buildFoliage(
  heightAt: (x: number, z: number) => number,
  water: WaterBody,
  wallBounds: THREE.Box2,
): { mesh: THREE.InstancedMesh; update: (time: number) => void } {
  const COUNT = 900;
  const geo = new THREE.ConeGeometry(0.18, 0.6, 5);
  const mat = new THREE.MeshStandardMaterial({ color: 0x1f4d3a, flatShading: true, roughness: 0.9 });

  const windDir = WIND.clone().normalize();
  const uniforms = { uTime: { value: 0 }, uWindDir: { value: new THREE.Vector2(windDir.x, windDir.z) } };
  mat.onBeforeCompile = (shader) => {
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
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float swayAmount = (position.y + 0.3) / 0.6;
        float sway = sin(uTime * 1.6 + (instanceMatrix[3].x + instanceMatrix[3].z) * 0.5) * 0.08 * swayAmount;
        transformed.x += uWindDir.x * sway;
        transformed.z += uWindDir.y * sway;`,
      );
  };

  const mesh = new THREE.InstancedMesh(geo, mat, COUNT);
  mesh.castShadow = true;
  const dummy = new THREE.Object3D();
  let placed = 0;
  let attempts = 0;
  const waterMinX = water.bounds.min.x - 0.4;
  const waterMaxX = water.bounds.max.x + 0.4;
  const waterMinZ = water.bounds.min.z - 0.4;
  const waterMaxZ = water.bounds.max.z + 0.4;
  while (placed < COUNT && attempts < COUNT * 4) {
    attempts++;
    const x = (Math.random() - 0.5) * CHAPTER_SIZE;
    const z = (Math.random() - 0.5) * CHAPTER_SIZE;
    const inWater = x >= waterMinX && x <= waterMaxX && z >= waterMinZ && z <= waterMaxZ;
    const inWall =
      x >= wallBounds.min.x - 0.4 && x <= wallBounds.max.x + 0.4 && z >= wallBounds.min.y - 0.4 && z <= wallBounds.max.y + 0.4;
    if (inWater || inWall) continue;
    dummy.position.set(x, heightAt(x, z) + 0.3, z);
    dummy.rotation.y = Math.random() * Math.PI * 2;
    const scale = 0.6 + Math.random() * 0.8;
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(placed, dummy.matrix);
    placed++;
  }
  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;

  return { mesh, update: (time: number) => { uniforms.uTime.value = time; } };
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

  const { mesh: foliageMesh, update: updateFoliage } = buildFoliage(heightAt, water, wall.bounds);
  group.add(foliageMesh);

  const half = CHAPTER_SIZE / 2;
  const chapterBounds = new THREE.Box3(new THREE.Vector3(-half, -5, -half), new THREE.Vector3(half, 10, half));

  return {
    group,
    groundHeightAt: heightAt,
    climbableWall: wall,
    water,
    chapterBounds,
    update: updateFoliage,
  };
}
