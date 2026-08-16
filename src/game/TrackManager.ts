import * as THREE from 'three';
import { createTrackSegment, SEGMENT_LENGTH, type TrackSegment } from '../scene/createTrackSegment';
import { createObstacle, clearRuleFor, type Obstacle, type ObstacleType } from '../entities/createObstacle';
import { createCollectible, type Collectible } from '../entities/createCollectible';
import { COLLISION_WINDOW, LANE_X, MOTE_COLLECT_WINDOW, PLAYER_Z } from './constants';
import type { PlayerCollisionState } from './Player';

const SEGMENT_COUNT = 5;
const HAZARD_SPACING = 3.4;

const OBSTACLE_TYPES: ObstacleType[] = ['root', 'boulder', 'log'];

interface ManagedSegment {
  seg: TrackSegment;
  obstacles: Obstacle[];
  collectibles: Collectible[];
}

export interface CollisionResult {
  hitObstacle: Obstacle | null;
  motesCollected: number;
}

export class TrackManager {
  readonly group = new THREE.Group();
  private managed: ManagedSegment[] = [];
  private nextSeed = 100;

  constructor() {
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const baseZ = -SEGMENT_LENGTH / 2 + 4 - i * SEGMENT_LENGTH;
      this.managed.push(this.buildSegment(baseZ, i === 0));
    }
  }

  private buildSegment(baseZ: number, isFirst: boolean): ManagedSegment {
    const seg = createTrackSegment(this.nextSeed++);
    seg.group.position.z = baseZ;
    this.group.add(seg.group);

    const obstacles: Obstacle[] = [];
    const collectibles: Collectible[] = [];
    this.populateHazards(seg.group, obstacles, collectibles, isFirst);

    return { seg, obstacles, collectibles };
  }

  private populateHazards(
    segGroup: THREE.Group,
    obstacles: Obstacle[],
    collectibles: Collectible[],
    isFirst: boolean,
  ) {
    for (let z = -SEGMENT_LENGTH / 2 + 3; z < SEGMENT_LENGTH / 2 - 3; z += HAZARD_SPACING) {
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
    }
  }

  private recycle(m: ManagedSegment) {
    const furthestZ = Math.min(...this.managed.map((s) => s.seg.group.position.z));
    for (const o of m.obstacles) {
      m.seg.group.remove(o.group);
      o.group.traverse((child) => {
        if (child instanceof THREE.Mesh) child.geometry.dispose();
      });
    }
    for (const c of m.collectibles) {
      m.seg.group.remove(c.group);
      c.mat.dispose();
    }
    m.obstacles.length = 0;
    m.collectibles.length = 0;
    m.seg.group.position.z = furthestZ - SEGMENT_LENGTH;
    this.populateHazards(m.seg.group, m.obstacles, m.collectibles, false);
  }

  update(time: number, delta: number, speed: number) {
    for (const m of this.managed) {
      m.seg.group.position.z += speed * delta;
      m.seg.update(time);
      if (m.seg.group.position.z - SEGMENT_LENGTH / 2 > PLAYER_Z + 6) {
        this.recycle(m);
      }
    }
  }

  checkCollisions(player: PlayerCollisionState): CollisionResult {
    let hitObstacle: Obstacle | null = null;
    let motesCollected = 0;

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
        if (Math.abs(worldZ - PLAYER_Z) > MOTE_COLLECT_WINDOW) continue;
        if (c.lane !== player.lane) continue;
        c.collected = true;
        c.group.visible = false;
        motesCollected++;
      }
    }

    return { hitObstacle, motesCollected };
  }

  reset() {
    for (let i = 0; i < this.managed.length; i++) {
      const m = this.managed[i];
      for (const o of m.obstacles) m.seg.group.remove(o.group);
      for (const c of m.collectibles) m.seg.group.remove(c.group);
      m.obstacles.length = 0;
      m.collectibles.length = 0;
      m.seg.group.position.z = -SEGMENT_LENGTH / 2 + 4 - i * SEGMENT_LENGTH;
      this.populateHazards(m.seg.group, m.obstacles, m.collectibles, i === 0);
    }
  }
}
