import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Player } from './Player';
import { TrackManager } from './TrackManager';
import { Input } from './Input';
import { HUD } from './HUD';
import { WakeTrail } from './WakeTrail';
import { Bursts } from './Bursts';
import { AudioFX } from './Audio';
import { biomeForDistance } from './biomes';
import { BASE_SPEED, MAX_SPEED, PLAYER_Z, SPEED_RAMP_PER_METER } from './constants';

type GameStatus = 'idle' | 'running' | 'dead';

export class Game {
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private clock = new THREE.Clock();

  private player = new Player();
  private track = new TrackManager();
  private wake = new WakeTrail();
  private bursts = new Bursts();
  private audio = new AudioFX();
  private input: Input;
  private hud: HUD;

  private status: GameStatus = 'idle';
  private speed = BASE_SPEED;
  private distance = 0;
  private motes = 0;
  private currentBiomeName = '';
  private shakeTime = 0;
  private shakeMagnitude = 0;

  constructor(container: HTMLElement) {
    this.scene.background = new THREE.Color(0x030509);
    this.scene.fog = new THREE.FogExp2(0x030509, 0.028);

    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(0, 2.2, PLAYER_Z + 4);

    // touch-primary devices are almost always the fill-rate-constrained ones (phone GPUs) —
    // cap resolution and shadow detail there; desktop keeps full quality.
    const isTouchPrimary = window.matchMedia('(pointer: coarse)').matches;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouchPrimary ? 1.5 : 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    this.setupLights(isTouchPrimary);
    this.scene.add(this.player.group);
    this.scene.add(this.track.group);
    this.scene.add(this.wake.group);
    this.scene.add(this.bursts.group);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.45,
      0.4,
      0.82,
    );
    this.composer.addPass(bloomPass);
    this.composer.addPass(new OutputPass());

    this.input = new Input(this.renderer.domElement);
    this.input.onAction((action) => {
      if (this.status === 'idle') {
        this.beginRun();
        return;
      }
      if (this.status === 'dead') return;
      this.player.handleAction(action);
    });
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Space' && e.code !== 'Enter') return;
      if (this.status === 'idle') this.beginRun();
      else if (this.status === 'dead') this.restart();
    });
    this.renderer.domElement.addEventListener('touchstart', () => {
      if (this.status === 'idle') this.beginRun();
      else if (this.status === 'dead') this.restart();
    });

    this.hud = new HUD(container);
    this.hud.showStart();

    window.addEventListener('resize', this.onResize);

    if (import.meta.env.DEV) {
      (window as unknown as { __rw: unknown }).__rw = {
        renderer: this.renderer,
        scene: this.scene,
        camera: this.camera,
        player: this.player,
        clock: this.clock,
        hud: this.hud,
      };
    }
  }

  private beginRun() {
    this.audio.unlock();
    this.status = 'running';
    this.hud.hideGameOver();
  }

  private setupLights(isTouchPrimary: boolean) {
    const hemi = new THREE.HemisphereLight(0x4a7a8a, 0x14231a, 1.4);
    this.scene.add(hemi);

    const moon = new THREE.DirectionalLight(0xafc8ff, 2.0);
    moon.position.set(-4, 8, 3);
    moon.castShadow = true;
    const shadowRes = isTouchPrimary ? 512 : 1024;
    moon.shadow.mapSize.set(shadowRes, shadowRes);
    moon.shadow.camera.left = -6;
    moon.shadow.camera.right = 6;
    moon.shadow.camera.top = 6;
    moon.shadow.camera.bottom = -6;
    moon.shadow.camera.near = 1;
    moon.shadow.camera.far = 20;
    this.scene.add(moon);

    const fill = new THREE.AmbientLight(0x203045, 0.6);
    this.scene.add(fill);

    const rim = new THREE.PointLight(0x5ff7ff, 0.25, 8, 2);
    rim.position.set(0, 3, PLAYER_Z - 2);
    this.scene.add(rim);
  }

  private onResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  };

  private restart() {
    this.player.reset();
    this.track.reset();
    this.wake.reset();
    this.bursts.reset();
    this.speed = BASE_SPEED;
    this.distance = 0;
    this.motes = 0;
    this.status = 'running';
    this.currentBiomeName = '';
    this.shakeTime = 0;
    this.hud.hideGameOver();
  }

  start() {
    this.animate();
  }

  private animate = () => {
    const delta = Math.min(this.clock.getDelta(), 0.05);
    const time = this.clock.elapsedTime;

    if (this.status === 'running') {
      this.distance += this.speed * delta;
      this.speed = Math.min(MAX_SPEED, BASE_SPEED + this.distance * SPEED_RAMP_PER_METER);

      this.player.update(time, delta);
      this.track.update(time, delta, this.speed, this.distance);
      this.wake.update(delta, this.speed, this.player.group.position.x);
      this.bursts.update(delta, this.speed * delta);

      const magnetActive = this.player.isMagnetActive(time);
      const result = this.track.checkCollisions(this.player.getCollisionState(), magnetActive);
      if (result.motesCollected > 0) {
        this.motes += result.motesCollected;
        this.bursts.spawn(this.player.group.position.x, 0.9, PLAYER_Z, biomeForDistance(this.distance).palette.moteGlow);
        this.audio.playCollect();
      }
      for (const type of result.powerUpsCollected) {
        this.player.applyPowerUp(type, time);
        this.bursts.spawn(this.player.group.position.x, 1, PLAYER_Z, 0xc98fff);
        this.audio.playPowerUp();
      }
      if (result.hitObstacle && !this.player.isInvulnerable(time)) {
        this.status = 'dead';
        this.player.alive = false;
        this.hud.showGameOver(this.distance, this.motes);
        this.audio.playHit();
        this.shakeTime = 0.4;
        this.shakeMagnitude = 0.35;
      }
      this.hud.update(this.distance, this.motes);
      this.hud.setBuff(this.player.remainingBuffTime(time));

      const biome = biomeForDistance(this.distance);
      if (biome.name !== this.currentBiomeName) {
        const isFirstBiome = this.currentBiomeName === '';
        this.currentBiomeName = biome.name;
        this.wake.setColor(biome.palette.moteGlow);
        if (!isFirstBiome) this.audio.playBiomeShift();
      }
      const targetFog = new THREE.Color(biome.fogColor);
      const targetBg = new THREE.Color(biome.bgColor);
      (this.scene.fog as THREE.FogExp2).color.lerp(targetFog, delta * 0.3);
      (this.scene.background as THREE.Color).lerp(targetBg, delta * 0.3);
    }

    const camTargetX = this.player.group.position.x * 0.6;
    this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, camTargetX, 0.08);
    this.camera.position.y = 2.2 + Math.sin(time * 0.9) * 0.03;

    let shakeX = 0;
    let shakeY = 0;
    if (this.shakeTime > 0) {
      this.shakeTime = Math.max(0, this.shakeTime - delta);
      const strength = this.shakeMagnitude * (this.shakeTime / 0.4);
      shakeX = (Math.random() - 0.5) * strength;
      shakeY = (Math.random() - 0.5) * strength;
    }
    this.camera.lookAt(camTargetX * 0.4 + shakeX, 0.9 + shakeY, PLAYER_Z - 6);

    this.composer.render();
    requestAnimationFrame(this.animate);
  };
}
