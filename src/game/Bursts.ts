import * as THREE from 'three';
import { createGlowMaterial } from '../shaders/glow';

const BURST_LIFE = 0.4;

interface Burst {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  age: number;
}

/** One-shot expanding glow ring for collect/power-up feedback — separate from the persistent WakeTrail. */
export class Bursts {
  readonly group = new THREE.Group();
  private items: Burst[] = [];

  spawn(x: number, y: number, z: number, color: number) {
    const mat = createGlowMaterial({ color, rimColor: 0xffffff, intensity: 1.8, fresnelPower: 1, pulseSpeed: 0 });
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 1), mat);
    mesh.position.set(x, y, z);
    this.group.add(mesh);
    this.items.push({ mesh, mat, age: 0 });
  }

  update(delta: number, worldDz: number) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const b = this.items[i];
      b.age += delta;
      b.mesh.position.z += worldDz;
      const t = b.age / BURST_LIFE;
      if (t >= 1) {
        this.group.remove(b.mesh);
        b.mesh.geometry.dispose();
        b.mat.dispose();
        this.items.splice(i, 1);
        continue;
      }
      const scale = 1 + t * 3.2;
      b.mesh.scale.setScalar(scale);
      b.mat.opacity = 1 - t;
    }
  }

  reset() {
    for (const b of this.items) {
      this.group.remove(b.mesh);
      b.mat.dispose();
    }
    this.items.length = 0;
  }
}
