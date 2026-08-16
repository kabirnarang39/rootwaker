import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createJungleLevel } from '../scene/createJungleLevel';
import { PlayerController } from './PlayerController';
import { CameraRig } from '../scene/CameraRig';
import { createFox } from '../scene/createFox';
import { createRootWraith, getAttackHitbox } from '../entities/rootWraith';
import { getBoarHitbox } from '../entities/tuskBoar';
import { getGuardHitbox } from '../entities/mountainGuard';
import type { GroveHare } from '../entities/groveHare';
import { resolveMeleeHit, applyDamage, isDefeated, CLAW_SWIPE, type Combatant } from './Combat';
import { Input, type PlayerAction } from './Input';
import { isInsideWaterBody } from './WaterBody';
import { computeApproachSpeed, checkPounceRange } from './Stalking';
import { HUD } from './HUD';
import { AudioFX } from './Audio';
import { AbilityKit } from './AbilityKit';
import { WindGust, type GustState } from './WindGust';
import { SKINS } from '../scene/skins';
import { resolvePlayerObstacleCollision } from './ObstacleCollision';
import { toCameraRelative } from './CameraRelativeMove';
import { computeFacingAngle } from './FoxFacing';

// Mirrors PlayerController's own (unexported) pounce range so the hunt-prompt lights up
// exactly when a pounce would actually succeed. Keep these two in sync by hand.
const HUNT_PROMPT_RANGE = 2;
const BOAR_HIT_DAMAGE = 12; // matches the root-wraith's melee hit — same claw-scale threat
const GUARD_HIT_DAMAGE = 12; // same claw-scale threat as the wraith/boar
const PLAYER_COLLISION_RADIUS = 0.35;
const PLAYER_COLLISION_HEIGHT = 0.9;
const LEDGE_REST_RADIUS = 1.5; // meters — how close to a mountain ledge counts as "resting" on it
const MAX_STAMINA = 100; // mirrors PlayerController's own (unexported) MAX_STAMINA
// ponytail: mountain ledges have no width/depth in ClimbSegment (only a center point), so this
// is a circular approximation of each ledge's rectangular footprint (real half-extents are up to
// 4x2m) rather than an exact box check. Upgrade to real bounds if a ledge ever proves too small
// for this radius or two ledges' radii start overlapping.
const MOUNTAIN_LEDGE_RADIUS = 4.5;
const LEDGE_SNAP_TOLERANCE = 1; // meters of downward drift still counted as "on the ledge" this frame
const WALL_CLIMB_HEIGHT_TOLERANCE = 2.0; // meters — disambiguates stacked wall/segments sharing x/z footprint

// All mountain wall/segments share a fixed 6-unit segment height, so each one's base is
// wall.topY - 6. Gate proximity checks on this so stacked segments (same x/z, different
// height) don't false-match each other.
function isNearWallHeight(playerY: number, wallTopY: number, segmentHeight: number): boolean {
  const wallBaseY = wallTopY - segmentHeight;
  return Math.abs(playerY - wallBaseY) <= WALL_CLIMB_HEIGHT_TOLERANCE;
}

export class Game {
  private scene = new THREE.Scene();
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private clock = new THREE.Clock();

  private level = createJungleLevel();
  private playerController = new PlayerController(new THREE.Vector3(0, 0, 12));
  private fox = createFox(SKINS[0]);
  private cameraRig = new CameraRig();
  private wraith = createRootWraith();
  private playerCombatant: Combatant = {
    hp: 100,
    maxHp: 100,
    hitbox: { start: new THREE.Vector3(), end: new THREE.Vector3(), radius: 0.4 },
  };
  private checkpoint = new THREE.Vector3(0, 0, 12);

  private audio = new AudioFX();
  private abilityKit = new AbilityKit();
  private windGust = new WindGust();
  private prevGustState: GustState = 'calm';
  private mountainWindStarted = false;
  private prevPlayerPosition = this.playerController.body.position.clone();

  private input: Input;
  private hud: HUD;

  private moveInput = { x: 0, z: 0, jump: false };
  // Raw (non-camera-relative) axis intent. Climbing reads z as "up/down the wall", not
  // "toward camera-forward" — the camera-relative transform would silently reverse or
  // zero out climb input depending on orbit yaw, so climb gates/updateClimb use this.
  private rawMoveInput = { x: 0, z: 0 };
  private jumpPressed = false;
  private foxFacingAngle = 0;

  // Base terrain heightAt() has no notion of the mountain's elevated ledges, so a player
  // topping out a climb segment would otherwise free-fall straight back down to jungle-floor
  // height next frame. Layer each nearby ledge in as a candidate floor, same shape as
  // groundHeightAt but ledge-aware — the only caller is this.playerController.update() below.
  private groundHeightWithLedges = (x: number, z: number): number => {
    let best = this.level.groundHeightAt(x, z);
    const playerY = this.playerController.body.position.y;
    for (const segment of this.level.mountain.segments) {
      const ledge = segment.ledgePosition;
      const horizontalDist = Math.hypot(x - ledge.x, z - ledge.z);
      if (horizontalDist <= MOUNTAIN_LEDGE_RADIUS && playerY + LEDGE_SNAP_TOLERANCE >= ledge.y) {
        best = Math.max(best, ledge.y);
      }
    }
    return best;
  };

  constructor(container: HTMLElement) {
    this.scene.background = new THREE.Color(0x0a1420);
    this.scene.fog = new THREE.FogExp2(0x0a1420, 0.014);

    // touch-primary devices are almost always the fill-rate-constrained ones (phone GPUs) —
    // cap resolution and shadow detail there; desktop keeps full quality.
    const isTouchPrimary = window.matchMedia('(pointer: coarse)').matches;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouchPrimary ? 1.5 : 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    this.setupLights(isTouchPrimary);

    this.scene.add(this.level.group);
    this.scene.add(this.fox.group);
    this.wraith.group.position.set(4, 0, 4);
    this.scene.add(this.wraith.group);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.cameraRig.camera));
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.45,
      0.4,
      0.82,
    );
    this.composer.addPass(bloomPass);
    this.composer.addPass(new OutputPass());

    this.input = new Input(this.renderer.domElement);
    this.input.onMove((x, z) => {
      const relative = toCameraRelative(x, z, this.cameraRig.orbitYaw);
      this.moveInput = { x: relative.x, z: relative.z, jump: this.jumpPressed };
      this.rawMoveInput = { x, z };
      this.jumpPressed = false;
    });
    this.input.onLook((dy, dp) => this.cameraRig.applyLookDelta(dy, dp));
    this.input.onAction((action: PlayerAction) => {
      if (action === 'jump') this.jumpPressed = true;
      if (action === 'attack') this.tryAttack();
      if (action === 'pounce') this.tryPounce();
      if (action === 'cycleView') this.cameraRig.cycleViewMode();
    });

    this.hud = new HUD(container);

    // AudioContext requires a user gesture to start — first keypress unlocks it and
    // kicks off the layered jungle ambience.
    window.addEventListener('keydown', () => this.audio.unlock(), { once: true });

    window.addEventListener('resize', this.onResize);

    if (import.meta.env.DEV) {
      (window as unknown as { __rw: unknown }).__rw = {
        renderer: this.renderer,
        scene: this.scene,
        camera: this.cameraRig.camera,
        playerController: this.playerController,
        wraith: this.wraith,
        clock: this.clock,
        hud: this.hud,
        game: this,
      };
    }
  }

  private setupLights(isTouchPrimary: boolean) {
    const hemi = new THREE.HemisphereLight(0x4a7a8a, 0x1c3226, 1.9);
    this.scene.add(hemi);

    const moon = new THREE.DirectionalLight(0xafc8ff, 2.0);
    moon.position.set(-4, 8, 3);
    moon.castShadow = true;
    const shadowRes = isTouchPrimary ? 512 : 1024;
    moon.shadow.mapSize.set(shadowRes, shadowRes);
    moon.shadow.camera.left = -18;
    moon.shadow.camera.right = 18;
    moon.shadow.camera.top = 18;
    moon.shadow.camera.bottom = -18;
    moon.shadow.camera.near = 1;
    moon.shadow.camera.far = 40;
    this.scene.add(moon);

    const fill = new THREE.AmbientLight(0x203045, 0.85);
    this.scene.add(fill);

    const rim = new THREE.PointLight(0x5ff7ff, 0.25, 8, 2);
    rim.position.set(0, 3, 6);
    this.scene.add(rim);
  }

  private onResize = () => {
    this.cameraRig.camera.aspect = window.innerWidth / window.innerHeight;
    this.cameraRig.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  };

  start() {
    this.animate();
  }

  private animate = () => {
    const delta = Math.min(this.clock.getDelta(), 0.05);
    const time = this.clock.elapsedTime;

    this.input.pollMove();
    this.input.pollLook();
    this.level.update(time);

    if (this.playerController.mode === 'grounded') {
      // Box2.y here holds world Z, per createJungleLevel's construction
      const nearWall =
        this.playerController.body.position.x <= this.level.climbableWall.bounds.max.x + 0.5 &&
        this.playerController.body.position.x >= this.level.climbableWall.bounds.min.x - 0.5 &&
        this.playerController.body.position.z >= this.level.climbableWall.bounds.min.y &&
        this.playerController.body.position.z <= this.level.climbableWall.bounds.max.y &&
        isNearWallHeight(this.playerController.body.position.y, this.level.climbableWall.topY, 6);
      if (nearWall && this.rawMoveInput.z > 0) {
        this.playerController.beginClimb(this.level.climbableWall.normal, this.level.climbableWall.topY);
      }

      if (this.playerController.mode === 'grounded' && this.rawMoveInput.z > 0) {
        for (const segment of this.level.mountain.segments) {
          const { wall } = segment;
          const nearSegmentWall =
            this.playerController.body.position.x <= wall.bounds.max.x + 0.5 &&
            this.playerController.body.position.x >= wall.bounds.min.x - 0.5 &&
            this.playerController.body.position.z >= wall.bounds.min.y &&
            this.playerController.body.position.z <= wall.bounds.max.y &&
            isNearWallHeight(this.playerController.body.position.y, wall.topY, 6);
          if (nearSegmentWall) {
            this.playerController.beginClimb(wall.normal, wall.topY, segment.ledgePosition);
            if (!this.mountainWindStarted) {
              this.mountainWindStarted = true;
              this.audio.startMountainWind(); // additive layer on top of jungle ambience — no zone-swap system exists in this project
            }
            break;
          }
        }
      }
    }

    if (this.playerController.mode === 'climbing') {
      this.playerController.updateClimb({ ...this.rawMoveInput, jump: false }, delta);
    } else if (this.playerController.mode === 'swimming') {
      this.playerController.updateSwim(this.moveInput, delta, this.level.water);
    } else {
      this.playerController.update(this.moveInput, delta, this.groundHeightWithLedges);
      // PLAYER_COLLISION_RADIUS (0.35m) must stay well under TreeObstacleGrid's cell size
      // (3m default) — nearby() ignores its radius arg and always does a fixed 3x3-cell
      // sweep, so a larger query radius could miss obstacles just outside that sweep.
      const nearbyObstacles = this.level.obstacleGrid.nearby(
        this.playerController.body.position.x,
        this.playerController.body.position.z,
        PLAYER_COLLISION_RADIUS,
      );
      resolvePlayerObstacleCollision(
        this.playerController.body.position,
        PLAYER_COLLISION_RADIUS,
        PLAYER_COLLISION_HEIGHT,
        nearbyObstacles,
      );
      if (isInsideWaterBody(this.playerController.body.position, this.level.water)) {
        this.playerController.beginSwim();
      }
    }

    if (this.playerController.mode === 'grounded') {
      for (const segment of this.level.mountain.segments) {
        if (this.playerController.body.position.distanceTo(segment.ledgePosition) <= LEDGE_REST_RADIUS) {
          this.playerController.restStamina(delta);
          break;
        }
      }
    }

    this.windGust.update(delta);
    if (this.windGust.state === 'telegraph' && this.prevGustState !== 'telegraph') {
      this.audio.playWindTelegraph();
    } else if (this.windGust.state === 'gusting' && this.prevGustState !== 'gusting') {
      this.audio.playGustHit();
    }
    this.prevGustState = this.windGust.state;
    if (this.playerController.mode === 'climbing') {
      this.playerController.body.position.add(this.windGust.forceVector().multiplyScalar(delta));
    }

    this.fox.group.position.copy(this.playerController.body.position);
    this.fox.update(time, delta, this.playerController.moveSpeed);
    this.foxFacingAngle = computeFacingAngle(
      this.playerController.body.velocity.x,
      this.playerController.body.velocity.z,
      this.foxFacingAngle,
      delta,
    );
    this.fox.group.rotation.y = this.foxFacingAngle;

    // Sync player combat hitbox to actual position every frame (was permanently pinned at world origin)
    this.playerCombatant.hitbox.start.copy(this.playerController.body.position);
    this.playerCombatant.hitbox.end.copy(this.playerController.body.position).add(new THREE.Vector3(0, 0.9, 0));

    const distanceToPlayer = this.wraith.group.position.distanceTo(this.playerController.body.position);
    this.wraith.update(time, delta, distanceToPlayer);
    if (this.wraith.ai.shouldDealDamageThisFrame()) {
      const hit = resolveMeleeHit(getAttackHitbox(this.wraith), this.playerCombatant);
      if (hit) applyDamage(this.playerCombatant, 12);
    }

    for (const hare of this.level.hares) {
      const hareDistance = hare.position.distanceTo(this.playerController.body.position);
      const approachSpeed = computeApproachSpeed(
        this.playerController.body.position,
        this.prevPlayerPosition,
        hare.position,
        delta,
      );
      hare.update(time, delta, hareDistance, approachSpeed);
      if (hare.ai.state === 'fleeing') {
        const dx = hare.position.x - this.playerController.body.position.x;
        const dz = hare.position.z - this.playerController.body.position.z;
        const horizontalDist = Math.hypot(dx, dz);
        const awayFromDir =
          horizontalDist > 1e-6
            ? new THREE.Vector3(dx / horizontalDist, 0, dz / horizontalDist)
            : new THREE.Vector3(0, 0, 1);
        hare.fleeStep(delta, awayFromDir);
        hare.position.y = this.level.groundHeightAt(hare.position.x, hare.position.z);
      }
    }

    for (const boar of this.level.boars) {
      const boarDistance = boar.group.position.distanceTo(this.playerController.body.position);
      boar.update(time, delta, boarDistance);
      if (boar.ai.shouldDealDamageThisFrame()) {
        const hit = resolveMeleeHit(getBoarHitbox(boar), this.playerCombatant);
        if (hit) applyDamage(this.playerCombatant, BOAR_HIT_DAMAGE);
      }
    }

    for (const guard of this.level.mountain.guards) {
      const guardDistance = guard.group.position.distanceTo(this.playerController.body.position);
      guard.update(time, delta, guardDistance);
      if (guard.ai.shouldDealDamageThisFrame()) {
        const hit = resolveMeleeHit(getGuardHitbox(guard), this.playerCombatant);
        if (hit) applyDamage(this.playerCombatant, GUARD_HIT_DAMAGE);
      }
    }

    if (isDefeated(this.playerCombatant)) {
      // silent checkpoint respawn — no game-over screen, matches the chapter-restart design spec
      this.playerController.body.position.copy(this.checkpoint);
      this.playerController.body.velocity.set(0, 0, 0);
      this.playerController.mode = 'grounded';
      this.playerCombatant.hp = this.playerCombatant.maxHp;
    }

    if (this.findNearestHareInRange()) this.hud.showHuntPrompt(true);
    else this.hud.hideHuntPrompt();

    const unlockedAbility = this.abilityKit.unlockedThisFrame();
    if (unlockedAbility) {
      this.hud.showAbilityUnlocked(unlockedAbility);
      this.audio.playAbilityUnlock();
    }

    const mode = this.playerController.mode;
    this.cameraRig.update(this.playerController.body.position, mode, delta, this.level.foliageMeshes, this.foxFacingAngle);

    this.hud.updateHealth(this.playerCombatant.hp, this.playerCombatant.maxHp);
    this.hud.updateStamina(this.playerController.stamina, MAX_STAMINA);

    // must run after every this-frame use of the old position (stalking's approach-speed calc above)
    this.prevPlayerPosition.copy(this.playerController.body.position);

    this.composer.render();
    requestAnimationFrame(this.animate);
  };

  private findNearestHareInRange(): GroveHare | null {
    let nearest: GroveHare | null = null;
    let nearestDistance = Infinity;
    for (const hare of this.level.hares) {
      const { inRange, distance } = checkPounceRange(this.playerController.body.position, hare.position, HUNT_PROMPT_RANGE);
      if (inRange && distance < nearestDistance) {
        nearestDistance = distance;
        nearest = hare;
      }
    }
    return nearest;
  }

  private tryPounce() {
    const nearestHare = this.findNearestHareInRange();
    if (!nearestHare) return;
    const result = this.playerController.tryPounce(nearestHare.position);
    this.audio.playPounceAttempt(result.success);
    if (!result.success) return;
    const idx = this.level.hares.indexOf(nearestHare);
    if (idx !== -1) {
      this.level.group.remove(nearestHare.group);
      this.level.hares.splice(idx, 1);
    }
    this.abilityKit.unlock('keen-ear');
  }

  private tryAttack() {
    const forward = new THREE.Vector3(0, 0, -1); // facing direction — refined once a facing/aim system exists; forward-only swipe is correct for this chapter's single enemy
    const attackHitbox = {
      start: this.playerController.body.position.clone(),
      end: this.playerController.body.position.clone().add(forward),
      radius: 0.6,
    };
    if (resolveMeleeHit(attackHitbox, this.wraith.combatant)) {
      applyDamage(this.wraith.combatant, CLAW_SWIPE.damage);
    }

    for (let i = this.level.boars.length - 1; i >= 0; i--) {
      const boar = this.level.boars[i];
      if (!resolveMeleeHit(attackHitbox, boar.combatant)) continue;
      applyDamage(boar.combatant, CLAW_SWIPE.damage);
      if (isDefeated(boar.combatant)) {
        this.level.group.remove(boar.group);
        this.level.boars.splice(i, 1);
        this.abilityKit.unlock('boar-charge');
      }
    }

    for (let i = this.level.mountain.guards.length - 1; i >= 0; i--) {
      const guard = this.level.mountain.guards[i];
      if (!resolveMeleeHit(attackHitbox, guard.combatant)) continue;
      applyDamage(guard.combatant, CLAW_SWIPE.damage);
      if (isDefeated(guard.combatant)) {
        this.level.group.remove(guard.group);
        this.level.mountain.guards.splice(i, 1);
        // no new ability tied to guard defeat — out of scope per this chapter's design (boss fight/village-trust payoff excluded)
      }
    }
  }
}
