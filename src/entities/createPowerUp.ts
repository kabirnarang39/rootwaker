import * as THREE from 'three';
import { createGlowMaterial } from '../shaders/glow';

export type PowerUpType = 'dash' | 'magnet' | 'shield';

export interface PowerUp {
  group: THREE.Group;
  mat: THREE.ShaderMaterial;
  type: PowerUpType;
  lane: number;
  localZ: number;
  collected: boolean;
}

const POWERUP_COLOR: Record<PowerUpType, number> = {
  dash: 0x8fe8ff,
  magnet: 0xffc65f,
  shield: 0xc98fff,
};

function buildGeometry(type: PowerUpType): THREE.BufferGeometry {
  if (type === 'dash') return new THREE.ConeGeometry(0.14, 0.42, 4);
  if (type === 'magnet') return new THREE.TorusGeometry(0.16, 0.06, 6, 10);
  return new THREE.OctahedronGeometry(0.2, 0);
}

export function createPowerUp(type: PowerUpType, lane: number, localZ: number): PowerUp {
  const mat = createGlowMaterial({
    color: POWERUP_COLOR[type],
    rimColor: 0xffffff,
    intensity: 1.4,
    fresnelPower: 1.3,
    pulseSpeed: 2.4,
  });
  const group = new THREE.Group();
  const core = new THREE.Mesh(buildGeometry(type), mat);
  if (type === 'dash') core.rotation.x = Math.PI / 2;
  group.add(core);
  const light = new THREE.PointLight(POWERUP_COLOR[type], 0.4, 2, 2);
  group.add(light);
  group.position.set(0, 1, localZ);
  return { group, mat, type, lane, localZ, collected: false };
}
