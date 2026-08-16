import * as THREE from 'three';
import { createFox, type Fox } from '../scene/createFox';
import { createGlowMaterial } from '../shaders/glow';
import {
  DASH_DURATION,
  JUMP_DURATION,
  JUMP_HEIGHT,
  LANE_SWITCH_TIME,
  LANE_X,
  MAGNET_DURATION,
  PLAYER_Z,
  SHIELD_DURATION,
  SLIDE_DURATION,
} from './constants';
import type { PlayerAction } from './Input';
import type { PowerUpType } from '../entities/createPowerUp';

export interface PlayerCollisionState {
  lane: number;
  jumping: boolean;
  sliding: boolean;
}

export class Player {
  readonly group: THREE.Group;
  private fox: Fox;

  private lane = 1;
  private currentX = LANE_X[1];
  private laneT = 1; // 0..1 progress of current lane-switch tween
  private laneFrom = LANE_X[1];
  private laneTo = LANE_X[1];

  private jumpElapsed = -1; // -1 = not jumping
  private slideElapsed = -1; // -1 = not sliding

  alive = true;

  private invulnerableUntil = -1;
  private magnetUntil = -1;
  private aura: THREE.Mesh;
  private auraMat: THREE.ShaderMaterial;

  constructor() {
    this.fox = createFox();
    this.group = this.fox.group;
    this.group.position.set(this.currentX, 0, PLAYER_Z);

    this.auraMat = createGlowMaterial({
      color: 0xc98fff,
      rimColor: 0xffffff,
      intensity: 1.6,
      fresnelPower: 1.1,
      pulseSpeed: 5,
    });
    this.aura = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), this.auraMat);
    this.aura.position.y = 0.55;
    this.aura.visible = false;
    this.group.add(this.aura);
  }

  applyPowerUp(type: PowerUpType, time: number) {
    if (type === 'dash') this.invulnerableUntil = time + DASH_DURATION;
    else if (type === 'shield') this.invulnerableUntil = time + SHIELD_DURATION;
    else if (type === 'magnet') this.magnetUntil = time + MAGNET_DURATION;
  }

  isInvulnerable(time: number) {
    return time < this.invulnerableUntil;
  }

  isMagnetActive(time: number) {
    return time < this.magnetUntil;
  }

  remainingBuffTime(time: number): { label: string; seconds: number } | null {
    const invuln = this.invulnerableUntil - time;
    const magnet = this.magnetUntil - time;
    if (invuln > 0 && invuln >= magnet) return { label: 'spirit ward', seconds: invuln };
    if (magnet > 0) return { label: 'light-seed magnet', seconds: magnet };
    return null;
  }

  handleAction(action: PlayerAction) {
    if (!this.alive) return;
    if (action === 'left') this.changeLane(-1);
    else if (action === 'right') this.changeLane(1);
    else if (action === 'jump') this.startJump();
    else if (action === 'slide') this.startSlide();
  }

  private changeLane(dir: -1 | 1) {
    const next = THREE.MathUtils.clamp(this.lane + dir, 0, LANE_X.length - 1);
    if (next === this.lane) return;
    this.lane = next;
    this.laneFrom = this.currentX;
    this.laneTo = LANE_X[this.lane];
    this.laneT = 0;
  }

  private startJump() {
    if (this.jumpElapsed >= 0 || this.slideElapsed >= 0) return;
    this.jumpElapsed = 0;
  }

  private startSlide() {
    if (this.slideElapsed >= 0 || this.jumpElapsed >= 0) return;
    this.slideElapsed = 0;
  }

  update(time: number, delta: number) {
    this.fox.update(time, delta);

    if (this.laneT < 1) {
      this.laneT = Math.min(1, this.laneT + delta / LANE_SWITCH_TIME);
      const eased = 1 - Math.pow(1 - this.laneT, 3);
      this.currentX = THREE.MathUtils.lerp(this.laneFrom, this.laneTo, eased);
    }
    this.group.position.x = this.currentX;

    let jumpY = 0;
    if (this.jumpElapsed >= 0) {
      this.jumpElapsed += delta;
      if (this.jumpElapsed >= JUMP_DURATION) {
        this.jumpElapsed = -1;
      } else {
        jumpY = Math.sin((this.jumpElapsed / JUMP_DURATION) * Math.PI) * JUMP_HEIGHT;
      }
    }
    this.group.position.y = jumpY;

    let slideScale = 1;
    if (this.slideElapsed >= 0) {
      this.slideElapsed += delta;
      if (this.slideElapsed >= SLIDE_DURATION) {
        this.slideElapsed = -1;
      } else {
        const t = this.slideElapsed / SLIDE_DURATION;
        const ease = Math.sin(t * Math.PI); // ramps down then back up
        slideScale = 1 - ease * 0.55;
      }
    }
    this.group.scale.y = slideScale;
    this.group.position.y += (1 - slideScale) * -0.15; // hug the ground while sliding

    const invulnerable = this.isInvulnerable(time);
    this.aura.visible = invulnerable;
    if (invulnerable) {
      this.auraMat.uniforms.uTime.value = time;
      const pulse = 1 + Math.sin(time * 8) * 0.06;
      this.aura.scale.setScalar(pulse);
    }
  }

  getCollisionState(): PlayerCollisionState {
    return {
      lane: this.lane,
      jumping: this.jumpElapsed >= 0,
      sliding: this.slideElapsed >= 0,
    };
  }

  reset() {
    this.lane = 1;
    this.currentX = LANE_X[1];
    this.laneFrom = this.currentX;
    this.laneTo = this.currentX;
    this.laneT = 1;
    this.jumpElapsed = -1;
    this.slideElapsed = -1;
    this.group.position.set(this.currentX, 0, PLAYER_Z);
    this.group.scale.set(1, 1, 1);
    this.alive = true;
    this.invulnerableUntil = -1;
    this.magnetUntil = -1;
    this.aura.visible = false;
  }
}
