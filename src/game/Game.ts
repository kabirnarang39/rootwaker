import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Player } from './Player';
import { TrackManager } from './TrackManager';
import { Input } from './Input';
import { HUD } from './HUD';
import { BASE_SPEED, MAX_SPEED, PLAYER_Z, SPEED_RAMP_PER_METER } from './constants';

type GameStatus = 'running' | 'dead';

export class Game {
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private clock = new THREE.Clock();

  private player = new Player();
  private track = new TrackManager();
  private input: Input;
  private hud: HUD;

  private status: GameStatus = 'running';
  private speed = BASE_SPEED;
  private distance = 0;
  private motes = 0;

  constructor(container: HTMLElement) {
    this.scene.background = new THREE.Color(0x030509);
    this.scene.fog = new THREE.FogExp2(0x030509, 0.028);

    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(0, 2.2, PLAYER_Z + 4);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    this.setupLights();
    this.scene.add(this.player.group);
    this.scene.add(this.track.group);

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
      if (this.status === 'dead') return;
      this.player.handleAction(action);
    });
    window.addEventListener('keydown', (e) => {
      if (this.status === 'dead' && (e.code === 'Space' || e.code === 'Enter')) this.restart();
    });
    this.renderer.domElement.addEventListener('touchstart', () => {
      if (this.status === 'dead') this.restart();
    });

    this.hud = new HUD(container);

    window.addEventListener('resize', this.onResize);
  }

  private setupLights() {
    const hemi = new THREE.HemisphereLight(0x4a7a8a, 0x14231a, 1.4);
    this.scene.add(hemi);

    const moon = new THREE.DirectionalLight(0xafc8ff, 2.0);
    moon.position.set(-4, 8, 3);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
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
    this.speed = BASE_SPEED;
    this.distance = 0;
    this.motes = 0;
    this.status = 'running';
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
      this.track.update(time, delta, this.speed);

      const result = this.track.checkCollisions(this.player.getCollisionState());
      if (result.motesCollected > 0) this.motes += result.motesCollected;
      if (result.hitObstacle) {
        this.status = 'dead';
        this.player.alive = false;
        this.hud.showGameOver(this.distance, this.motes);
      }
      this.hud.update(this.distance, this.motes);
    }

    const camTargetX = this.player.group.position.x * 0.6;
    this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, camTargetX, 0.08);
    this.camera.position.y = 2.2 + Math.sin(time * 0.9) * 0.03;
    this.camera.lookAt(camTargetX * 0.4, 0.9, PLAYER_Z - 6);

    this.composer.render();
    requestAnimationFrame(this.animate);
  };
}
