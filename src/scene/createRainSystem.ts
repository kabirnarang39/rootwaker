import * as THREE from 'three';

const MAX_DROPS = 320;
const SPAWN_RADIUS = 14; // stays centered on the player rather than simulating the whole island
const FALL_TOP = 10;
const FALL_BOTTOM = -1;
const FALL_SPEED = 11; // m/s — a real raindrop's terminal-velocity-scale fall, not a gentle drift
const DROP_LENGTH = 0.55; // a real rain STREAK (motion-elongated), not a round particle

export interface RainSystem {
  group: THREE.Group;
  /** `intensity` 0..1 drives how many of the MAX_DROPS instances are actually visible/active —
   * a real storm has visibly more rain in the air than a light drizzle, not just louder audio. */
  update(center: THREE.Vector3, intensity: number, delta: number): void;
}

interface Drop {
  x: number;
  y: number;
  z: number;
  speed: number; // per-drop variance — real rain doesn't fall in perfect lockstep
}

/** Real rain as a bounded cloud of streaking instances centered on the player (not a level-wide
 * simulation — no game system here needs rain to exist far from the camera). Each drop is a thin,
 * elongated cylinder (a real streak, matching how falling rain actually reads at any real
 * fall speed, not a round blob) that loops from a ceiling back to a floor once it passes below the
 * player, respawning at a new random x/z offset so the cloud never visibly "resets" all at once. */
export function createRainSystem(): RainSystem {
  const geo = new THREE.CylinderGeometry(0.004, 0.006, DROP_LENGTH, 4);
  const mat = new THREE.MeshBasicMaterial({ color: 0xbcd6e8, transparent: true, opacity: 0.5 });
  const mesh = new THREE.InstancedMesh(geo, mat, MAX_DROPS);
  mesh.name = 'rain';
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const group = new THREE.Group();
  group.add(mesh);

  const drops: Drop[] = Array.from({ length: MAX_DROPS }, () => ({
    x: (Math.random() - 0.5) * SPAWN_RADIUS * 2,
    y: FALL_TOP * Math.random(),
    z: (Math.random() - 0.5) * SPAWN_RADIUS * 2,
    speed: 0.85 + Math.random() * 0.3,
  }));

  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  const zeroScale = new THREE.Vector3(0, 0, 0);
  const pos = new THREE.Vector3();
  const downAxis = new THREE.Vector3(0, -1, 0);

  function update(center: THREE.Vector3, intensity: number, delta: number): void {
    const activeCount = Math.round(MAX_DROPS * THREE.MathUtils.clamp(intensity, 0, 1));
    // A storm's wind gives rain real lateral tilt, not a perfectly vertical fall — scaled by
    // intensity so a light rain stays close to vertical and a storm visibly slants.
    const windTiltX = 0.25 * intensity;
    const tiltAxis = new THREE.Vector3(windTiltX, -1, 0).normalize();
    quat.setFromUnitVectors(downAxis, tiltAxis);

    for (let i = 0; i < MAX_DROPS; i++) {
      const drop = drops[i];
      if (i >= activeCount) {
        mesh.setMatrixAt(i, matrix.compose(pos.set(0, -9999, 0), quat.identity(), zeroScale));
        continue;
      }
      drop.y -= FALL_SPEED * drop.speed * delta;
      if (drop.y < FALL_BOTTOM) {
        drop.y = FALL_TOP;
        drop.x = (Math.random() - 0.5) * SPAWN_RADIUS * 2;
        drop.z = (Math.random() - 0.5) * SPAWN_RADIUS * 2;
      }
      pos.set(center.x + drop.x, center.y + drop.y, center.z + drop.z);
      matrix.compose(pos, quat, scale);
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  return { group, update };
}
