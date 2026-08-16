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
import { resolveMeleeHit, applyDamage, isDefeated, CLAW_SWIPE, type Combatant } from './Combat';
import { Input, type PlayerAction } from './Input';
import { isInsideWaterBody } from './WaterBody';
import { HUD } from './HUD';
import { SKINS } from '../scene/skins';

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

  private input: Input;
  private hud: HUD;

  private moveInput = { x: 0, z: 0, jump: false };
  private jumpPressed = false;

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
      this.moveInput = { x, z, jump: this.jumpPressed };
      this.jumpPressed = false;
    });
    this.input.onAction((action: PlayerAction) => {
      if (action === 'jump') this.jumpPressed = true;
      if (action === 'attack') this.tryAttack();
    });

    this.hud = new HUD(container);

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
    this.level.update(time);

    if (this.playerController.mode === 'grounded') {
      // Box2.y here holds world Z, per createJungleLevel's construction
      const nearWall =
        this.playerController.body.position.x <= this.level.climbableWall.bounds.max.x + 0.5 &&
        this.playerController.body.position.x >= this.level.climbableWall.bounds.min.x - 0.5 &&
        this.playerController.body.position.z >= this.level.climbableWall.bounds.min.y &&
        this.playerController.body.position.z <= this.level.climbableWall.bounds.max.y;
      if (nearWall && this.moveInput.z > 0) {
        this.playerController.beginClimb(this.level.climbableWall.normal, this.level.climbableWall.topY);
      }
    }

    if (this.playerController.mode === 'climbing') {
      this.playerController.updateClimb(this.moveInput, delta);
    } else if (this.playerController.mode === 'swimming') {
      this.playerController.updateSwim(this.moveInput, delta, this.level.water);
    } else {
      this.playerController.update(this.moveInput, delta, this.level.groundHeightAt);
      if (isInsideWaterBody(this.playerController.body.position, this.level.water)) {
        this.playerController.beginSwim();
      }
    }

    this.fox.group.position.copy(this.playerController.body.position);
    this.fox.update(time, delta, this.playerController.moveSpeed);

    const distanceToPlayer = this.wraith.group.position.distanceTo(this.playerController.body.position);
    this.wraith.update(time, delta, distanceToPlayer);
    if (this.wraith.ai.shouldDealDamageThisFrame()) {
      const hit = resolveMeleeHit(getAttackHitbox(this.wraith), this.playerCombatant);
      if (hit) applyDamage(this.playerCombatant, 12);
    }
    if (isDefeated(this.playerCombatant)) {
      // silent checkpoint respawn — no game-over screen, matches the chapter-restart design spec
      this.playerController.body.position.copy(this.checkpoint);
      this.playerController.body.velocity.set(0, 0, 0);
      this.playerController.mode = 'grounded';
      this.playerCombatant.hp = this.playerCombatant.maxHp;
    }

    const mode = this.playerController.mode;
    this.cameraRig.update(this.playerController.body.position, mode, delta);

    this.hud.updateHealth(this.playerCombatant.hp, this.playerCombatant.maxHp);

    this.composer.render();
    requestAnimationFrame(this.animate);
  };

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
  }
}
