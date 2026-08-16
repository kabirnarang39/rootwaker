import * as THREE from 'three';
import { createGlowMaterial } from '../shaders/glow';
import { PLAYER_Z } from './constants';

const SPAWN_INTERVAL = 1.1; // meters of travel between wake bursts
const GROWTH_TIME = 0.35;
const FADE_START = 1.8;
const FADE_TIME = 1.6;
const MAX_BEHIND = FADE_START + FADE_TIME + 1;

interface WakeNode {
  group: THREE.Group;
  mat: THREE.ShaderMaterial;
  age: number;
  z: number;
}

/** Vines/glow bursting from the ground in the fox's wake — a persistent trail, not a one-shot particle. */
export class WakeTrail {
  readonly group = new THREE.Group();
  private nodes: WakeNode[] = [];
  private distanceSinceSpawn = 0;
  private color: number;

  constructor(color = 0x5ff7ff) {
    this.color = color;
  }

  setColor(color: number) {
    this.color = color;
  }

  private spawn(x: number) {
    const mat = createGlowMaterial({
      color: this.color,
      rimColor: 0xffffff,
      intensity: 1.2,
      fresnelPower: 1.3,
      pulseSpeed: 4,
    });
    const group = new THREE.Group();
    const tendrils = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < tendrils; i++) {
      const h = 0.25 + Math.random() * 0.3;
      const tendril = new THREE.Mesh(new THREE.ConeGeometry(0.025, h, 4), mat);
      const angle = (i / tendrils) * Math.PI * 2;
      tendril.position.set(Math.cos(angle) * 0.15, h / 2, Math.sin(angle) * 0.15);
      tendril.rotation.z = Math.cos(angle) * 0.3;
      tendril.rotation.x = Math.sin(angle) * 0.3 + 0.15;
      group.add(tendril);
    }
    group.position.set(x, 0, PLAYER_Z);
    group.scale.setScalar(0.001);
    this.group.add(group);
    this.nodes.push({ group, mat, age: 0, z: PLAYER_Z });
  }

  /** Call every frame with the player's current lane x and distance travelled this frame. */
  update(delta: number, speed: number, playerX: number) {
    this.distanceSinceSpawn += speed * delta;
    if (this.distanceSinceSpawn >= SPAWN_INTERVAL) {
      this.distanceSinceSpawn = 0;
      this.spawn(playerX);
    }

    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const n = this.nodes[i];
      n.age += delta;
      n.z += speed * delta;
      n.group.position.z = n.z;
      n.mat.uniforms.uTime.value = n.age;

      const scale = Math.min(1, n.age / GROWTH_TIME);
      const eased = 1 - Math.pow(1 - scale, 3);
      n.group.scale.setScalar(Math.max(0.001, eased));

      const behind = n.z - PLAYER_Z;
      if (behind > FADE_START) {
        const fadeT = Math.min(1, (behind - FADE_START) / FADE_TIME);
        n.mat.opacity = 1 - fadeT;
      }

      if (behind > MAX_BEHIND) {
        this.group.remove(n.group);
        n.group.traverse((child) => {
          if (child instanceof THREE.Mesh) child.geometry.dispose();
        });
        n.mat.dispose();
        this.nodes.splice(i, 1);
      }
    }
  }

  reset() {
    for (const n of this.nodes) {
      this.group.remove(n.group);
      n.mat.dispose();
    }
    this.nodes.length = 0;
    this.distanceSinceSpawn = 0;
  }
}
