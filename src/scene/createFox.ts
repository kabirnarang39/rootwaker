import * as THREE from 'three';
import { createGlowMaterial } from '../shaders/glow';

export interface Fox {
  group: THREE.Group;
  update(time: number, delta: number): void;
}

const FUR_COLOR = 0xd9622b;
const FUR_DARK = 0x7a3418;
const BELLY_COLOR = 0xf2ead2;
const GLOW_COLOR = 0x5ff7ff;
const GLOW_RIM = 0xbfffef;

function furMaterial(color: THREE.ColorRepresentation) {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: 0.75,
    metalness: 0.05,
  });
}

/** Builds a custom stylized low-poly fox-spirit from primitives — no external model. */
export function createFox(): Fox {
  const group = new THREE.Group();
  group.name = 'fox-spirit';

  const fur = furMaterial(FUR_COLOR);
  const furDark = furMaterial(FUR_DARK);
  const belly = furMaterial(BELLY_COLOR);
  const glowShellMat = createGlowMaterial({
    color: GLOW_COLOR,
    rimColor: GLOW_RIM,
    intensity: 0.35,
    fresnelPower: 3.2,
  });
  const glowCoreMat = createGlowMaterial({
    color: GLOW_COLOR,
    rimColor: GLOW_RIM,
    intensity: 0.55,
    fresnelPower: 1.4,
    pulseSpeed: 2.2,
  });

  // --- torso ---
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.55, 2, 6), fur);
  torso.rotation.z = Math.PI / 2;
  torso.position.set(0, 0.55, 0);
  torso.castShadow = true;
  group.add(torso);

  const torsoShell = new THREE.Mesh(torso.geometry.clone(), glowShellMat);
  torsoShell.rotation.copy(torso.rotation);
  torsoShell.position.copy(torso.position);
  torsoShell.scale.setScalar(1.06);
  group.add(torsoShell);

  const bellyMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.5, 2, 6), belly);
  bellyMesh.rotation.z = Math.PI / 2;
  bellyMesh.position.set(0, 0.42, 0.08);
  group.add(bellyMesh);

  // --- chest glow core (also a real light source) ---
  const chestCore = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 0), glowCoreMat);
  chestCore.position.set(0, 0.46, 0.22);
  group.add(chestCore);
  const chestLight = new THREE.PointLight(GLOW_COLOR, 0.25, 3.5, 2);
  chestLight.position.copy(chestCore.position);
  group.add(chestLight);

  // --- head ---
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 0), fur);
  head.scale.set(1, 0.92, 1.15);
  head.position.set(0, 0.78, 0.45);
  group.add(head);

  const headShell = new THREE.Mesh(head.geometry.clone(), glowShellMat);
  headShell.scale.copy(head.scale).multiplyScalar(1.08);
  headShell.position.copy(head.position);
  group.add(headShell);

  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.32, 5), furDark);
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, 0.73, 0.72);
  group.add(snout);

  // --- eyes (glowing) ---
  const eyeGeo = new THREE.SphereGeometry(0.035, 6, 6);
  const eyeL = new THREE.Mesh(eyeGeo, glowCoreMat);
  eyeL.position.set(-0.1, 0.82, 0.63);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.1;
  group.add(eyeL, eyeR);

  // --- ears ---
  const earGeo = new THREE.ConeGeometry(0.13, 0.3, 4);
  const earL = new THREE.Mesh(earGeo, fur);
  earL.position.set(-0.16, 1.02, 0.4);
  earL.rotation.z = 0.25;
  const earR = earL.clone();
  earR.position.x = 0.16;
  earR.rotation.z = -0.25;
  group.add(earL, earR);

  const earInnerGeo = new THREE.ConeGeometry(0.07, 0.2, 4);
  const earInnerL = new THREE.Mesh(earInnerGeo, furDark);
  earInnerL.position.set(-0.16, 1.0, 0.46);
  earInnerL.rotation.z = 0.25;
  const earInnerR = earInnerL.clone();
  earInnerR.position.x = 0.16;
  earInnerR.rotation.z = -0.25;
  group.add(earInnerL, earInnerR);

  // --- legs ---
  const legGeo = new THREE.CylinderGeometry(0.045, 0.055, 0.48, 5);
  const legPositions: Array<[number, number, number]> = [
    [-0.16, 0.24, 0.28],
    [0.16, 0.24, 0.28],
    [-0.16, 0.24, -0.22],
    [0.16, 0.24, -0.22],
  ];
  const legs = legPositions.map(([x, y, z]) => {
    const leg = new THREE.Mesh(legGeo, furDark);
    leg.position.set(x, y, z);
    group.add(leg);
    return leg;
  });

  // --- tail: chained low-poly segments curling upward, glowing tip ---
  const tailRoot = new THREE.Group();
  tailRoot.position.set(0, 0.62, -0.42);
  group.add(tailRoot);

  const segmentCount = 5;
  let parent: THREE.Object3D = tailRoot;
  const tailSegments: THREE.Object3D[] = [];
  for (let i = 0; i < segmentCount; i++) {
    const t = i / (segmentCount - 1);
    const radius = 0.11 * (1 - t * 0.75);
    const length = 0.22;
    const segGeo = new THREE.CylinderGeometry(radius * 0.8, radius, length, 5);
    const isTip = i === segmentCount - 1;
    const mat = isTip ? glowCoreMat : i > segmentCount - 3 ? furDark : fur;
    const seg = new THREE.Mesh(segGeo, mat);
    seg.position.y = i === 0 ? 0 : length;
    seg.rotation.x = -0.28;
    const pivot = new THREE.Group();
    pivot.position.y = i === 0 ? 0 : length;
    pivot.rotation.x = -0.28;
    pivot.add(seg);
    seg.position.y = length / 2;
    parent.add(pivot);
    parent = pivot;
    tailSegments.push(pivot);
  }

  // --- ground contact shadow (fake, cheap) ---
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 });
  const shadowMesh = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.01;
  group.add(shadowMesh);

  const glowMaterials = [glowShellMat, glowCoreMat];

  function update(time: number, delta: number) {
    glowMaterials.forEach((m) => {
      (m.uniforms.uTime.value as number) = time;
    });

    const bob = Math.sin(time * 3.2) * 0.03;
    torso.position.y = 0.55 + bob;
    torsoShell.position.y = torso.position.y;
    head.position.y = 0.78 + bob * 1.2;
    headShell.position.y = head.position.y;
    snout.position.y = 0.73 + bob * 1.2;
    eyeL.position.y = 0.82 + bob * 1.2;
    eyeR.position.y = eyeL.position.y;
    earL.position.y = 1.02 + bob * 1.2;
    earR.position.y = earL.position.y;
    earInnerL.position.y = 1.0 + bob * 1.2;
    earInnerR.position.y = earInnerL.position.y;
    chestCore.position.y = 0.46 + bob;
    chestLight.position.y = chestCore.position.y;

    legs.forEach((leg, i) => {
      const phase = i % 2 === 0 ? 0 : Math.PI;
      leg.rotation.x = Math.sin(time * 6 + phase) * 0.25;
    });

    tailRoot.rotation.x = -0.2 + Math.sin(time * 2.4) * 0.08;
    tailSegments.forEach((seg, i) => {
      seg.rotation.y = Math.sin(time * 2.4 + i * 0.5) * 0.35;
    });

    void delta;
  }

  return { group, update };
}
