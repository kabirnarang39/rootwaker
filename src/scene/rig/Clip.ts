import * as THREE from 'three';
import { Rig, type JointName } from './Rig';

export type Vec3Tuple = [number, number, number];
export type Ease = (t: number) => number;

export const linear: Ease = (t) => t;
export const easeInOutQuad: Ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export interface Keyframe {
  time: number;
  joint: JointName;
  rotation?: Vec3Tuple;
  position?: Vec3Tuple;
}

export interface Clip {
  name: string;
  duration: number;
  loop: boolean;
  ease: Ease;
  keyframes: Keyframe[];
}

interface Sample {
  rotation?: Vec3Tuple;
  position?: Vec3Tuple;
}

function lerpTuple(a: Vec3Tuple, b: Vec3Tuple, t: number): Vec3Tuple {
  return [
    THREE.MathUtils.lerp(a[0], b[0], t),
    THREE.MathUtils.lerp(a[1], b[1], t),
    THREE.MathUtils.lerp(a[2], b[2], t),
  ];
}

export function sampleClip(clip: Clip, time: number): Map<JointName, Sample> {
  const t = clip.loop ? ((time % clip.duration) + clip.duration) % clip.duration : Math.min(Math.max(time, 0), clip.duration);

  const byJoint = new Map<JointName, Keyframe[]>();
  for (const kf of clip.keyframes) {
    const list = byJoint.get(kf.joint) ?? [];
    list.push(kf);
    byJoint.set(kf.joint, list);
  }

  const result = new Map<JointName, Sample>();
  for (const [joint, framesUnsorted] of byJoint) {
    const frames = [...framesUnsorted].sort((a, b) => a.time - b.time);
    let prev = frames[0];
    let next = frames[frames.length - 1];
    for (let i = 0; i < frames.length - 1; i++) {
      if (frames[i].time <= t && frames[i + 1].time >= t) {
        prev = frames[i];
        next = frames[i + 1];
        break;
      }
    }
    // Clamp to boundary keyframes instead of extrapolating
    if (t < frames[0].time) {
      prev = frames[0];
      next = frames[0];
    } else if (t > frames[frames.length - 1].time) {
      prev = frames[frames.length - 1];
      next = frames[frames.length - 1];
    }
    const span = next.time - prev.time;
    const localT = span === 0 ? 0 : clip.ease((t - prev.time) / span);
    const sample: Sample = {};
    if (prev.rotation && next.rotation) {
      sample.rotation = lerpTuple(prev.rotation, next.rotation, localT);
    } else if (prev.rotation || next.rotation) {
      sample.rotation = prev.rotation ?? next.rotation;
    }
    if (prev.position && next.position) {
      sample.position = lerpTuple(prev.position, next.position, localT);
    } else if (prev.position || next.position) {
      sample.position = prev.position ?? next.position;
    }
    result.set(joint, sample);
  }
  return result;
}

export function applyClipToRig(rig: Rig, clip: Clip, time: number): void {
  for (const [joint, sample] of sampleClip(clip, time)) {
    if (sample.rotation) rig.setLocalRotation(joint, ...sample.rotation);
    if (sample.position) rig.applyPositionOffset(joint, ...sample.position);
  }
}

/** Blends two clips (e.g. walk -> attack-swipe) onto the rig by weight [0..1]. */
export function blendClips(rig: Rig, clipA: Clip, timeA: number, clipB: Clip, timeB: number, weight: number): void {
  const a = sampleClip(clipA, timeA);
  const b = sampleClip(clipB, timeB);
  const joints = new Set<JointName>([...a.keys(), ...b.keys()]);
  for (const joint of joints) {
    const sa = a.get(joint);
    const sb = b.get(joint);
    if (sa?.rotation && sb?.rotation) rig.setLocalRotation(joint, ...lerpTuple(sa.rotation, sb.rotation, weight));
    else if (sa?.rotation) rig.setLocalRotation(joint, ...sa.rotation);
    else if (sb?.rotation) rig.setLocalRotation(joint, ...sb.rotation);

    if (sa?.position && sb?.position) rig.applyPositionOffset(joint, ...lerpTuple(sa.position, sb.position, weight));
    else if (sa?.position) rig.applyPositionOffset(joint, ...sa.position);
    else if (sb?.position) rig.applyPositionOffset(joint, ...sb.position);
  }
}
