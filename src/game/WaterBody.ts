import * as THREE from 'three';

export interface WaterBody {
  bounds: THREE.Box3;
  surfaceY: number;
  /** World-space push applied to anything swimming in this body. */
  current: THREE.Vector3;
}

export function isInsideWaterBody(point: THREE.Vector3, water: WaterBody): boolean {
  return water.bounds.containsPoint(point);
}
