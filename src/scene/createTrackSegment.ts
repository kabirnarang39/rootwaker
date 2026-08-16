import * as THREE from 'three';
import { createGlowMaterial } from '../shaders/glow';

export const SEGMENT_LENGTH = 24;
export const LANE_WIDTH = 1.6;

export interface TrackSegment {
  group: THREE.Group;
  update(time: number): void;
}

const BARK_COLOR = 0x2c1e14;
const BARK_DARK = 0x1a120c;
const FOLIAGE_COLORS = [0x1f4d3a, 0x2c6b4a, 0x14392a];
const FLOOR_COLOR = 0x0f2318;
const PATH_COLOR = 0x1b3626;
const MOTE_GLOW = 0x8affc2;

function mulberry32(seed: number) {
  let a = seed;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildTree(rand: () => number): THREE.Group {
  const tree = new THREE.Group();
  const trunkHeight = 3.5 + rand() * 2.5;
  const trunkRadius = 0.22 + rand() * 0.12;

  const trunkMat = new THREE.MeshStandardMaterial({
    color: BARK_COLOR,
    flatShading: true,
    roughness: 0.95,
    metalness: 0.02,
  });
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(trunkRadius * 0.6, trunkRadius, trunkHeight, 6),
    trunkMat,
  );
  trunk.position.y = trunkHeight / 2;
  trunk.rotation.y = rand() * Math.PI;
  tree.add(trunk);

  const rootMat = new THREE.MeshStandardMaterial({ color: BARK_DARK, flatShading: true, roughness: 1 });
  for (let i = 0; i < 3; i++) {
    const root = new THREE.Mesh(new THREE.ConeGeometry(trunkRadius * 0.5, 0.9, 4), rootMat);
    const angle = (i / 3) * Math.PI * 2 + rand();
    root.position.set(Math.cos(angle) * trunkRadius * 0.9, 0.4, Math.sin(angle) * trunkRadius * 0.9);
    root.rotation.z = Math.cos(angle) * 0.5;
    root.rotation.x = Math.sin(angle) * 0.5;
    tree.add(root);
  }

  const foliageMat = new THREE.MeshStandardMaterial({
    color: FOLIAGE_COLORS[Math.floor(rand() * FOLIAGE_COLORS.length)],
    flatShading: true,
    roughness: 0.85,
  });
  const clumps = 3 + Math.floor(rand() * 2);
  for (let i = 0; i < clumps; i++) {
    const clump = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 + rand() * 0.6, 0), foliageMat);
    clump.position.set((rand() - 0.5) * 1.4, trunkHeight - 0.4 + rand() * 1.3, (rand() - 0.5) * 1.4);
    clump.rotation.set(rand(), rand(), rand());
    tree.add(clump);
  }

  return tree;
}

function buildGlowPlant(rand: () => number): { group: THREE.Group; mat: THREE.ShaderMaterial } {
  const mat = createGlowMaterial({
    color: MOTE_GLOW,
    rimColor: 0xdfffe9,
    intensity: 0.6,
    fresnelPower: 1.8,
    pulseSpeed: 1.2 + rand() * 1.2,
  });
  const g = new THREE.Group();
  const stemCount = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < stemCount; i++) {
    const h = 0.3 + rand() * 0.4;
    const stem = new THREE.Mesh(new THREE.ConeGeometry(0.03, h, 5), mat);
    stem.position.set((rand() - 0.5) * 0.3, h / 2, (rand() - 0.5) * 0.3);
    g.add(stem);
  }
  const light = new THREE.PointLight(MOTE_GLOW, 0.25, 2, 2);
  light.position.y = 0.3;
  g.add(light);
  return { group: g, mat };
}

/** One recyclable track module: forest floor + tree walls + glowing undergrowth. */
export function createTrackSegment(seed = 1): TrackSegment {
  const rand = mulberry32(seed);
  const group = new THREE.Group();
  group.name = 'track-segment';

  const floorMat = new THREE.MeshStandardMaterial({ color: FLOOR_COLOR, roughness: 1, flatShading: true });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, SEGMENT_LENGTH, 4, 8), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 0);
  group.add(floor);

  const pathMat = new THREE.MeshStandardMaterial({ color: PATH_COLOR, roughness: 0.9, flatShading: true });
  const path = new THREE.Mesh(new THREE.PlaneGeometry(LANE_WIDTH * 3.2, SEGMENT_LENGTH), pathMat);
  path.rotation.x = -Math.PI / 2;
  path.position.y = 0.01;
  group.add(path);

  const laneLineMat = new THREE.MeshBasicMaterial({ color: 0x2f5f45, transparent: true, opacity: 0.5 });
  for (const laneX of [-LANE_WIDTH / 2, LANE_WIDTH / 2]) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.04, SEGMENT_LENGTH), laneLineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(laneX, 0.02, 0);
    group.add(line);
  }

  const treeCount = 8;
  for (let i = 0; i < treeCount; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const tree = buildTree(rand);
    const x = side * (2.2 + rand() * 1.8);
    const z = -SEGMENT_LENGTH / 2 + (i / treeCount) * SEGMENT_LENGTH + (rand() - 0.5) * 2;
    tree.position.set(x, 0, z);
    tree.scale.setScalar(0.85 + rand() * 0.4);
    group.add(tree);
  }

  const glowMats: THREE.ShaderMaterial[] = [];
  const plantCount = 10;
  for (let i = 0; i < plantCount; i++) {
    const side = rand() > 0.5 ? 1 : -1;
    const { group: plant, mat } = buildGlowPlant(rand);
    const x = side * (1.4 + rand() * 0.6);
    const z = -SEGMENT_LENGTH / 2 + rand() * SEGMENT_LENGTH;
    plant.position.set(x, 0, z);
    group.add(plant);
    glowMats.push(mat);
  }

  function update(time: number) {
    glowMats.forEach((m) => {
      (m.uniforms.uTime.value as number) = time;
    });
  }

  return { group, update };
}
