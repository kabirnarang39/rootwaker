import type { Clip } from '../scene/rig/Clip';
import { linear } from '../scene/rig/Clip';

// Real macaque-type locomotion (per direct research: macaques have near-equal-length fore/
// hindlimbs — intermembral index ~90 — and are predominantly QUADRUPEDAL walkers/climbers, not
// arm-swinging brachiators like gibbons; this idle clip is deliberately a real diagonal-trot-
// ready quadruped pose, not a bipedal or hanging one).
export const idleClip: Clip = {
  name: 'monkey-idle',
  duration: 1.8,
  loop: true,
  ease: linear,
  keyframes: [
    { time: 0, joint: 'tail0', rotation: [0, 0, 0] },
    { time: 0.9, joint: 'tail0', rotation: [0, 0.15, 0] },
    { time: 1.8, joint: 'tail0', rotation: [0, 0, 0] },
    { time: 0, joint: 'head', rotation: [0, 0, 0] },
    { time: 0.9, joint: 'head', rotation: [0.08, -0.12, 0] }, // real alert head-turning, scanning
    { time: 1.8, joint: 'head', rotation: [0, 0, 0] },
  ],
};

// A real macaque's own quick, darting nature — this project's fastest telegraph+recovery cycle,
// matching real small-primate speed rather than a slow committed lunge like every larger species.
// Must match createMonkey.ts's own ai.telegraphSeconds (0.2) + EnemyAI's default attackSeconds
// (0.3) exactly, same convention every other species' own *_PLUS_* constant already follows.
const TELEGRAPH_PLUS_DART = 0.5;

export const dartClip: Clip = {
  name: 'monkey-dart',
  duration: TELEGRAPH_PLUS_DART,
  loop: false,
  ease: linear,
  keyframes: [
    { time: 0, joint: 'spine', rotation: [0, 0, 0], position: [0, 0, 0] },
    { time: 0, joint: 'jaw', rotation: [0, 0, 0] },
    { time: 0.25, joint: 'spine', rotation: [-0.1, 0, 0], position: [0, 0, -0.04] }, // brief real crouch-coil
    { time: 0.25, joint: 'jaw', rotation: [-0.3, 0, 0] }, // real bared-teeth threat
    { time: 0.35, joint: 'spine', rotation: [0.08, 0, 0], position: [0, 0, 0.22] }, // the actual dart-strike
    { time: 0.35, joint: 'jaw', rotation: [0, 0, 0] },
    { time: 0.5, joint: 'spine', rotation: [0, 0, 0], position: [0, 0, 0] },
  ],
};
