import * as THREE from 'three';
import { Rig } from '../scene/rig/Rig';
import { blendClips } from '../scene/rig/Clip';
import { grazeClip, fleeClip } from './groveHareClips';
import { WildlifeAI } from './WildlifeAI';

const FLEE_SPEED = 3.2; // m/s — fast enough that catching a fleeing hare is a real race, not free

export interface GroveHare {
  group: THREE.Group;
  ai: WildlifeAI;
  position: THREE.Vector3;
  update(time: number, delta: number, distanceToPlayer: number, approachSpeed: number): void;
  fleeStep(delta: number, awayFromDir: THREE.Vector3): void;
}

export function createGroveHare(spawnPosition: THREE.Vector3): GroveHare {
  const rig = new Rig(['root', 'spine', 'head', 'earL', 'earR', 'hindpawL', 'hindpawR', 'forepawL', 'forepawR']);
  rig.attach('spine', 'root');
  rig.attach('head', 'spine');
  rig.attach('earL', 'head');
  rig.attach('earR', 'head');
  rig.attach('hindpawL', 'root');
  rig.attach('hindpawR', 'root');
  rig.attach('forepawL', 'spine');
  rig.attach('forepawR', 'spine');

  rig.setLocalPosition('spine', 0, 0.16, 0);
  rig.setLocalPosition('head', 0, 0.1, 0.14);
  rig.setLocalPosition('earL', -0.03, 0.08, 0);
  rig.setLocalPosition('earR', 0.03, 0.08, 0);
  rig.setLocalPosition('hindpawL', -0.05, 0.05, -0.1);
  rig.setLocalPosition('hindpawR', 0.05, 0.05, -0.1);
  rig.setLocalPosition('forepawL', -0.04, -0.05, 0.08);
  rig.setLocalPosition('forepawR', 0.04, -0.05, 0.08);

  const furMat = new THREE.MeshStandardMaterial({ color: 0x8a7256, flatShading: true, roughness: 0.9 });
  const earMat = new THREE.MeshStandardMaterial({ color: 0xb89a78, flatShading: true, roughness: 0.85 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.14, 2, 6), furMat);
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  rig.getJoint('spine').add(body);

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), furMat);
  rig.getJoint('head').add(head);

  const earGeo = new THREE.ConeGeometry(0.018, 0.12, 4);
  const earL = new THREE.Mesh(earGeo, earMat);
  earL.position.y = 0.06;
  rig.getJoint('earL').add(earL);
  const earR = new THREE.Mesh(earGeo, earMat);
  earR.position.y = 0.06;
  rig.getJoint('earR').add(earR);

  const legGeo = new THREE.CylinderGeometry(0.014, 0.018, 0.1, 5);
  for (const joint of ['hindpawL', 'hindpawR', 'forepawL', 'forepawR'] as const) {
    const leg = new THREE.Mesh(legGeo, furMat);
    leg.position.y = -0.05;
    rig.getJoint(joint).add(leg);
  }

  rig.root.position.copy(spawnPosition);

  const ai = new WildlifeAI();
  const position = spawnPosition.clone();
  let fleeTime = 0;

  function update(time: number, delta: number, distanceToPlayer: number, approachSpeed: number) {
    ai.update(distanceToPlayer, approachSpeed, delta);
    if (ai.state === 'fleeing') {
      fleeTime += delta;
      blendClips(rig, grazeClip, time, fleeClip, fleeTime, 1);
    } else {
      fleeTime = 0;
      blendClips(rig, grazeClip, time, fleeClip, 0, 0);
    }
    rig.root.position.copy(position);
  }

  function fleeStep(delta: number, awayFromDir: THREE.Vector3) {
    if (ai.state !== 'fleeing') return;
    position.addScaledVector(awayFromDir, FLEE_SPEED * delta);
  }

  return { group: rig.root, ai, position, update, fleeStep };
}
