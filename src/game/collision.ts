import * as THREE from 'three';

export interface Capsule {
  start: THREE.Vector3;
  end: THREE.Vector3;
  radius: number;
}

export interface Box {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

export interface HitResult {
  hit: boolean;
  normal: THREE.Vector3;
  depth: number;
}

function closestPointsSegmentSegment(
  p1: THREE.Vector3,
  q1: THREE.Vector3,
  p2: THREE.Vector3,
  q2: THREE.Vector3,
): { c1: THREE.Vector3; c2: THREE.Vector3 } {
  const EPS = 1e-8;
  const d1 = q1.clone().sub(p1);
  const d2 = q2.clone().sub(p2);
  const r = p1.clone().sub(p2);
  const a = d1.dot(d1);
  const e = d2.dot(d2);
  const f = d2.dot(r);

  let s: number;
  let t: number;

  if (a <= EPS && e <= EPS) {
    return { c1: p1.clone(), c2: p2.clone() };
  }
  if (a <= EPS) {
    s = 0;
    t = THREE.MathUtils.clamp(f / e, 0, 1);
  } else {
    const c = d1.dot(r);
    if (e <= EPS) {
      t = 0;
      s = THREE.MathUtils.clamp(-c / a, 0, 1);
    } else {
      const b = d1.dot(d2);
      const denom = a * e - b * b;
      s = denom !== 0 ? THREE.MathUtils.clamp((b * f - c * e) / denom, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = THREE.MathUtils.clamp(-c / a, 0, 1);
      } else if (t > 1) {
        t = 1;
        s = THREE.MathUtils.clamp((b - c) / a, 0, 1);
      }
    }
  }

  return {
    c1: p1.clone().addScaledVector(d1, s),
    c2: p2.clone().addScaledVector(d2, t),
  };
}

export function capsuleVsCapsule(a: Capsule, b: Capsule): HitResult {
  const { c1, c2 } = closestPointsSegmentSegment(a.start, a.end, b.start, b.end);
  const delta = c1.clone().sub(c2);
  const dist = delta.length();
  const radiusSum = a.radius + b.radius;
  if (dist >= radiusSum) {
    return { hit: false, normal: new THREE.Vector3(0, 1, 0), depth: 0 };
  }
  const normal = dist > 1e-8 ? delta.normalize() : new THREE.Vector3(0, 1, 0);
  return { hit: true, normal, depth: radiusSum - dist };
}

/**
 * Approximates the capsule's closest point to the box by testing both
 * endpoints and the midpoint — accurate enough for the small hitbox/prop
 * sizes this game uses. Not a general-purpose exact solver.
 */
export function capsuleVsBox(cap: Capsule, box: Box): HitResult {
  const clampToBox = (p: THREE.Vector3) =>
    new THREE.Vector3(
      THREE.MathUtils.clamp(p.x, box.min.x, box.max.x),
      THREE.MathUtils.clamp(p.y, box.min.y, box.max.y),
      THREE.MathUtils.clamp(p.z, box.min.z, box.max.z),
    );

  const candidates = [cap.start, cap.end, cap.start.clone().lerp(cap.end, 0.5)];
  let bestPoint = clampToBox(candidates[0]);
  let bestSource = candidates[0];
  let bestDist = bestSource.distanceTo(bestPoint);
  for (const p of candidates.slice(1)) {
    const cp = clampToBox(p);
    const dist = p.distanceTo(cp);
    if (dist < bestDist) {
      bestDist = dist;
      bestPoint = cp;
      bestSource = p;
    }
  }

  if (bestDist >= cap.radius) {
    return { hit: false, normal: new THREE.Vector3(0, 1, 0), depth: 0 };
  }
  const normal = bestDist > 1e-8 ? bestSource.clone().sub(bestPoint).normalize() : new THREE.Vector3(0, 1, 0);
  return { hit: true, normal, depth: cap.radius - bestDist };
}
