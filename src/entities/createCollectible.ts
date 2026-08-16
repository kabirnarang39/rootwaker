import * as THREE from 'three';
import { createGlowMaterial } from '../shaders/glow';

export interface Collectible {
  group: THREE.Group;
  mat: THREE.ShaderMaterial;
  lane: number;
  localZ: number;
  collected: boolean;
}

const MOTE_COLOR = 0xffe9a8;

export function createCollectible(lane: number, localZ: number): Collectible {
  const mat = createGlowMaterial({
    color: MOTE_COLOR,
    rimColor: 0xfff6d8,
    intensity: 1.1,
    fresnelPower: 1.5,
    pulseSpeed: 3,
  });
  const group = new THREE.Group();
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 1), mat);
  group.add(core);
  const light = new THREE.PointLight(MOTE_COLOR, 0.3, 1.5, 2);
  group.add(light);
  group.position.set(0, 0.9, localZ);
  return { group, mat, lane, localZ, collected: false };
}
