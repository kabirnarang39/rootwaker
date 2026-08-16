import type { Clip } from '../scene/rig/Clip';
import { linear } from '../scene/rig/Clip';

export const idleClip: Clip = {
  name: 'bear-idle',
  duration: 2.2,
  loop: true,
  ease: linear,
  keyframes: [
    { time: 0, joint: 'spine', rotation: [0, 0, 0] },
    { time: 1.1, joint: 'spine', rotation: [0.06, 0, 0] },
    { time: 2.2, joint: 'spine', rotation: [0, 0, 0] },
  ],
};

// A heavy claw swipe: rear up, then swipe down/forward — distinct from the boar's low
// head-down charge, reading as a real bear attack rather than a reused generic strike.
const TELEGRAPH_PLUS_SWIPE = 0.9; // matches EnemyAI's TELEGRAPH_SECONDS + ATTACK_SECONDS

export const clawSwipeClip: Clip = {
  name: 'bear-claw-swipe',
  duration: TELEGRAPH_PLUS_SWIPE,
  loop: false,
  ease: linear,
  keyframes: [
    { time: 0, joint: 'spine', rotation: [-0.3, 0, 0] }, // rearing up, telegraph
    { time: 0.6, joint: 'spine', rotation: [0.45, 0, 0] }, // swipe down/forward
    { time: 0.9, joint: 'spine', rotation: [0, 0, 0] },
  ],
};
