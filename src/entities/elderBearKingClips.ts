import type { Clip } from '../scene/rig/Clip';
import { linear } from '../scene/rig/Clip';

export const idleClip: Clip = {
  name: 'elder-bear-idle',
  duration: 2.6,
  loop: true,
  ease: linear,
  keyframes: [
    { time: 0, joint: 'spine', rotation: [0, 0, 0] },
    { time: 1.3, joint: 'spine', rotation: [0.05, 0, 0] },
    { time: 2.6, joint: 'spine', rotation: [0, 0, 0] },
  ],
};

// Calm-phase: a heavy, deliberate claw-swipe — same shape as the Grove Bear's, held longer to
// read as an elder's weightier blow.
const CALM_TELEGRAPH_PLUS_SWIPE = 0.95;

export const calmSwipeClip: Clip = {
  name: 'elder-bear-swipe-calm',
  duration: CALM_TELEGRAPH_PLUS_SWIPE,
  loop: false,
  ease: linear,
  keyframes: [
    { time: 0, joint: 'spine', rotation: [-0.32, 0, 0] },
    { time: 0.65, joint: 'spine', rotation: [0.5, 0, 0] },
    { time: 0.95, joint: 'spine', rotation: [0, 0, 0] },
  ],
};

// Enraged-phase: compressed to match BossPhaseController's shorter enraged telegraphSeconds.
const ENRAGED_TELEGRAPH_PLUS_SWIPE = 0.65;

export const enragedSwipeClip: Clip = {
  name: 'elder-bear-swipe-enraged',
  duration: ENRAGED_TELEGRAPH_PLUS_SWIPE,
  loop: false,
  ease: linear,
  keyframes: [
    { time: 0, joint: 'spine', rotation: [-0.35, 0, 0] },
    { time: 0.4, joint: 'spine', rotation: [0.55, 0, 0] },
    { time: 0.65, joint: 'spine', rotation: [0, 0, 0] },
  ],
};
