import * as THREE from 'three';
import { createTrackSegment, SEGMENT_LENGTH, type TrackSegment } from '../scene/createTrackSegment';
import { createObstacle, clearRuleFor, type Obstacle, type ObstacleType } from '../entities/createObstacle';
import { createCollectible, type Collectible } from '../entities/createCollectible';
import { createPowerUp, type PowerUp, type PowerUpType } from '../entities/createPowerUp';
import { COLLISION_WINDOW, LANE_X, MOTE_COLLECT_WINDOW, PLAYER_Z, POWERUP_COLLECT_WINDOW } from './constants';
import { biomeForDistance } from './biomes';
import type { PlayerCollisionState } from './Player';

const SEGMENT_COUNT = 5;
const HAZARD_SPACING = 3.4;

const OBSTACLE_TYPES: ObstacleType[] = ['root', 'boulder', 'log'];
const POWERUP_TYPES: PowerUpType[] = ['dash', 'magnet', 'shield'];

interface ManagedSegment {
  seg: TrackSegment;
  obstacles: Obstacle[];
  collectibles: Collectible[];
  powerUps: PowerUp[];
}

export interface CollisionResult {
  hitObstacle: Obstacle | null;
  motesCollected: number;
  powerUpsCollected: PowerUpType[];
}

function disposeGroup(group: THREE.Group) {
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((m) => m.dispose());
    }
  });
}

export class TrackManager {
  readonly group = new THREE.Group();
  private managed: ManagedSegment[] = [];
  private nextSeed = 100;
  private distance = 0;

  constructor() {
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const baseZ = -SEGMENT_LENGTH / 2 + 4 - i * SEGMENT_LENGTH;
      this.managed.push(this.buildSegment(baseZ, i === 0));
    }
  }

  private buildSegment(baseZ: number, isFirst: boolean): ManagedSegment {
    const biome = biomeForDistance(this.distance);
    const seg = createTrackSegment(this.nextSeed++, biome.palette);
    seg.group.position.z = baseZ;
    this.group.add(seg.group);

    const obstacles: Obstacle[] = [];
    const collectibles: Collectible[] = [];
    const powerUps: PowerUp[] = [];
    this.populateHazards(seg.group, obstacles, collectibles, powerUps, isFirst, biome.hazardDensity);

    return { seg, obstacles, collectibles, powerUps };
  }

  private populateHazards(
    segGroup: THREE.Group,
    obstacles: Obstacle[],
    collectibles: Collectible[],
    powerUps: PowerUp[],
    isFirst: boolean,
    hazardDensity: number,
  ) {
    const spacing = HAZARD_SPACING / hazardDensity;
    for (let z = -SEGMENT_LENGTH / 2 + 3; z < SEGMENT_LENGTH / 2 - 3; z += spacing) {
      const roll = Math.random();
      if (!isFirst && roll < 0.42) {
        const lane = Math.floor(Math.random() * LANE_X.length);
        const type = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
        const obstacle = createObstacle(type, lane, z);
        obstacle.group.position.set(LANE_X[lane], 0, z);
        segGroup.add(obstacle.group);
        obstacles.push(obstacle);

        for (let l = 0; l < LANE_X.length; l++) {
          if (l !== lane && Math.random() < 0.5) {
            const c = createCollectible(l, z);
            c.group.position.set(LANE_X[l], 0.9, z);
            segGroup.add(c.group);
            collectibles.push(c);
          }
        }
      } else if (roll < 0.75) {
        const laneCount = 1 + Math.floor(Math.random() * 3);
        const lanes = [0, 1, 2].sort(() => Math.random() - 0.5).slice(0, laneCount);
        for (const l of lanes) {
          const c = createCollectible(l, z);
          c.group.position.set(LANE_X[l], 0.9, z);
          segGroup.add(c.group);
          collectibles.push(c);
        }
      }

      if (!isFirst && Math.random() < 0.07) {
        const lane = Math.floor(Math.random() * LANE_X.length);
        const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
        const p = createPowerUp(type, lane, z + 0.6);
        p.group.position.set(LANE_X[lane], 1, z + 0.6);
        segGroup.add(p.group);
        powerUps.push(p);
      }
    }
  }

  private recycle(m: ManagedSegment) {
    const furthestZ = Math.min(...this.managed.map((s) => s.seg.group.position.z));
    const newBaseZ = furthestZ - SEGMENT_LENGTH;

    this.group.remove(m.seg.group);
    disposeGroup(m.seg.group);

    const biome = biomeForDistance(this.distance);
    const seg = createTrackSegment(this.nextSeed++, biome.palette);
    seg.group.position.z = newBaseZ;
    this.group.add(seg.group);

    m.seg = seg;
    m.obstacles = [];
    m.collectibles = [];
    m.powerUps = [];
    this.populateHazards(seg.group, m.obstacles, m.collectibles, m.powerUps, false, biome.hazardDensity);
  }

  update(time: number, delta: number, speed: number, distance: number) {
    this.distance = distance;
    for (const m of this.managed) {
      m.seg.group.position.z += speed * delta;
      m.seg.update(time);
      if (m.seg.group.position.z - SEGMENT_LENGTH / 2 > PLAYER_Z + 6) {
        this.recycle(m);
      }
    }
  }

  checkCollisions(player: PlayerCollisionState, magnetActive: boolean): CollisionResult {
    let hitObstacle: Obstacle | null = null;
    let motesCollected = 0;
    const powerUpsCollected: PowerUpType[] = [];

    for (const m of this.managed) {
      const baseZ = m.seg.group.position.z;

      for (const o of m.obstacles) {
        if (o.hit) continue;
        const worldZ = baseZ + o.localZ;
        if (Math.abs(worldZ - PLAYER_Z) > COLLISION_WINDOW) continue;
        o.hit = true;
        if (o.lane !== player.lane) continue;
        const rule = clearRuleFor(o.type);
        const cleared = (rule === 'jump' && player.jumping) || (rule === 'slide' && player.sliding);
        if (!cleared) hitObstacle = o;
      }

      for (const c of m.collectibles) {
        if (c.collected) continue;
        const worldZ = baseZ + c.localZ;
        const window = magnetActive ? MOTE_COLLECT_WINDOW * 2.2 : MOTE_COLLECT_WINDOW;
        if (Math.abs(worldZ - PLAYER_Z) > window) continue;
        if (!magnetActive && c.lane !== player.lane) continue;
        c.collected = true;
        c.group.visible = false;
        motesCollected++;
      }

      for (const p of m.powerUps) {
        if (p.collected) continue;
        const worldZ = baseZ + p.localZ;
        if (Math.abs(worldZ - PLAYER_Z) > POWERUP_COLLECT_WINDOW) continue;
        if (p.lane !== player.lane) continue;
        p.collected = true;
        p.group.visible = false;
        powerUpsCollected.push(p.type);
      }
    }

    return { hitObstacle, motesCollected, powerUpsCollected };
  }

  reset() {
    this.distance = 0;
    for (let i = 0; i < this.managed.length; i++) {
      const m = this.managed[i];
      this.group.remove(m.seg.group);
      disposeGroup(m.seg.group);

      const baseZ = -SEGMENT_LENGTH / 2 + 4 - i * SEGMENT_LENGTH;
      const seg = createTrackSegment(this.nextSeed++, biomeForDistance(0).palette);
      seg.group.position.z = baseZ;
      this.group.add(seg.group);

      m.seg = seg;
      m.obstacles = [];
      m.collectibles = [];
      m.powerUps = [];
      this.populateHazards(seg.group, m.obstacles, m.collectibles, m.powerUps, i === 0, 1);
    }
  }
}
