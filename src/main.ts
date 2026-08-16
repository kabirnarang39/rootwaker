import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createFox } from './scene/createFox';
import { createTrackSegment, SEGMENT_LENGTH } from './scene/createTrackSegment';

const app = document.querySelector<HTMLDivElement>('#app')!;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x030509);
scene.fog = new THREE.FogExp2(0x030509, 0.028);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 2.2, 5.2);
camera.lookAt(0, 0.8, -2);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
app.appendChild(renderer.domElement);

// --- lighting: hemisphere fill + a cool moonlight key, no unlit flats ---
const hemi = new THREE.HemisphereLight(0x4a7a8a, 0x14231a, 1.4);
scene.add(hemi);

const moon = new THREE.DirectionalLight(0xafc8ff, 2.0);
moon.position.set(-4, 8, 3);
moon.castShadow = true;
moon.shadow.mapSize.set(1024, 1024);
scene.add(moon);

const fillLight = new THREE.AmbientLight(0x203045, 0.6);
scene.add(fillLight);

const rimFill = new THREE.PointLight(0x5ff7ff, 0.25, 8, 2);
rimFill.position.set(0, 3, -2);
scene.add(rimFill);

// --- fox-spirit ---
const fox = createFox();
fox.group.position.set(0, 0, 1.2);
scene.add(fox.group);

// --- track: two segments chained so the module boundary is provable now,
// procedural recycling arrives in Phase 1 ---
const segmentA = createTrackSegment(7);
segmentA.group.position.z = -SEGMENT_LENGTH / 2 + 4;
scene.add(segmentA.group);

const segmentB = createTrackSegment(23);
segmentB.group.position.z = segmentA.group.position.z - SEGMENT_LENGTH;
scene.add(segmentB.group);

// --- bloom: base materials stay under threshold, glow shaders push past it ---
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.45, // strength
  0.4, // radius
  0.82, // threshold
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();

function animate() {
  const delta = clock.getDelta();
  const time = clock.elapsedTime;

  fox.update(time, delta);
  segmentA.update(time);
  segmentB.update(time);

  // slow hero-shot camera drift — proves the scene reads in motion, not just a screenshot
  camera.position.x = Math.sin(time * 0.15) * 0.6;
  camera.position.y = 2.2 + Math.sin(time * 0.35) * 0.06;
  camera.lookAt(0, 0.85, -2);

  composer.render();
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
