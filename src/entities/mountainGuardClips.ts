import type { Clip } from '../scene/rig/Clip';
import { linear } from '../scene/rig/Clip';

export const idleClip: Clip = {
  name: 'guard-idle',
  duration: 2.0,
  loop: true,
  ease: linear,
  keyframes: [
    { time: 0, joint: 'spine', rotation: [0, 0, 0] },
    { time: 1.0, joint: 'spine', rotation: [0.04, 0, 0] },
    { time: 2.0, joint: 'spine', rotation: [0, 0, 0] },
  ],
};

const TELEGRAPH_PLUS_STRIKE = 0.9; // matches EnemyAI's TELEGRAPH_SECONDS + ATTACK_SECONDS

export const strikeClip: Clip = {
  name: 'guard-strike',
  duration: TELEGRAPH_PLUS_STRIKE,
  loop: false,
  ease: linear,
  keyframes: [
    { time: 0, joint: 'spine', rotation: [-0.2, 0, 0] }, // coiled telegraph, readable wind-up
    { time: 0.6, joint: 'spine', rotation: [0.4, 0, 0] }, // strike forward
    { time: 0.9, joint: 'spine', rotation: [0, 0, 0] },
  ],
};
