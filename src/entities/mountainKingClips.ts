import type { Clip } from '../scene/rig/Clip';
import { linear } from '../scene/rig/Clip';

export const idleClip: Clip = {
  name: 'king-idle',
  duration: 2.4,
  loop: true,
  ease: linear,
  keyframes: [
    { time: 0, joint: 'spine', rotation: [0, 0, 0] },
    { time: 1.2, joint: 'spine', rotation: [0.05, 0, 0] },
    { time: 2.4, joint: 'spine', rotation: [0, 0, 0] },
  ],
};

// Calm-phase strike — same shape as mountainGuard's, held slightly longer to read as
// heavier/more deliberate (a king's blow, not a guard's).
const CALM_TELEGRAPH_PLUS_STRIKE = 0.95;

export const calmStrikeClip: Clip = {
  name: 'king-strike-calm',
  duration: CALM_TELEGRAPH_PLUS_STRIKE,
  loop: false,
  ease: linear,
  keyframes: [
    { time: 0, joint: 'spine', rotation: [-0.28, 0, 0] },
    { time: 0.65, joint: 'spine', rotation: [0.5, 0, 0] },
    { time: 0.95, joint: 'spine', rotation: [0, 0, 0] },
  ],
};

// Enraged-phase strike — the same wind-up-then-strike shape, compressed to match
// BossPhaseController's shorter enraged telegraphSeconds (0.35s vs calm's 0.6s).
const ENRAGED_TELEGRAPH_PLUS_STRIKE = 0.65;

export const enragedStrikeClip: Clip = {
  name: 'king-strike-enraged',
  duration: ENRAGED_TELEGRAPH_PLUS_STRIKE,
  loop: false,
  ease: linear,
  keyframes: [
    { time: 0, joint: 'spine', rotation: [-0.3, 0, 0] },
    { time: 0.4, joint: 'spine', rotation: [0.55, 0, 0] },
    { time: 0.65, joint: 'spine', rotation: [0, 0, 0] },
  ],
};
