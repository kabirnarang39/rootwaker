import * as THREE from 'three';

export type ObstacleType = 'root' | 'boulder' | 'log';

export interface Obstacle {
  group: THREE.Group;
  type: ObstacleType;
  lane: number;
  localZ: number;
  hit: boolean;
}

const ROCK_COLOR = 0x5a5850;
const ROCK_DARK = 0x3c3a35;
const ROOT_COLOR = 0x4a3018;
const LOG_COLOR = 0x5c3a1e;
const LOG_DARK = 0x38220f;

function buildBoulder(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: ROCK_COLOR, flatShading: true, roughness: 0.9 });
  const matDark = new THREE.MeshStandardMaterial({ color: ROCK_DARK, flatShading: true, roughness: 0.95 });
  const main = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), mat);
  main.position.y = 0.4;
  main.rotation.set(0.4, 0.6, 0.1);
  g.add(main);
  const small = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 0), matDark);
  small.position.set(0.3, 0.18, 0.15);
  g.add(small);
  return g;
}

function buildRoot(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: ROOT_COLOR, flatShading: true, roughness: 1 });
  const spikeCount = 5;
  for (let i = 0; i < spikeCount; i++) {
    const h = 0.35 + Math.random() * 0.4;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06 + Math.random() * 0.03, h, 5), mat);
    spike.position.set((Math.random() - 0.5) * 0.9, h / 2, (Math.random() - 0.5) * 0.4);
    spike.rotation.z = (Math.random() - 0.5) * 0.5;
    spike.rotation.x = (Math.random() - 0.5) * 0.3;
    g.add(spike);
  }
  return g;
}

function buildLog(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: LOG_COLOR, flatShading: true, roughness: 0.85 });
  const matDark = new THREE.MeshStandardMaterial({ color: LOG_DARK, flatShading: true, roughness: 0.9 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 3.2, 7), mat);
  trunk.rotation.z = Math.PI / 2;
  trunk.position.y = 0.62;
  g.add(trunk);
  for (const capZ of [-1.55, 1.55]) {
    const cap = new THREE.Mesh(new THREE.CircleGeometry(0.22, 7), matDark);
    cap.rotation.y = Math.PI / 2;
    cap.position.set(capZ, 0.62, 0);
    g.add(cap);
  }
  return g;
}

const CLEAR_RULE: Record<ObstacleType, 'jump' | 'slide' | 'dodge'> = {
  boulder: 'jump',
  log: 'slide',
  root: 'dodge',
};

export function clearRuleFor(type: ObstacleType) {
  return CLEAR_RULE[type];
}

export function createObstacle(type: ObstacleType, lane: number, localZ: number): Obstacle {
  const group = type === 'boulder' ? buildBoulder() : type === 'log' ? buildLog() : buildRoot();
  group.position.z = localZ;
  return { group, type, lane, localZ, hit: false };
}
