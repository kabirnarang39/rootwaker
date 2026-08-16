import type { Clip } from '../scene/rig/Clip';
import { linear } from '../scene/rig/Clip';

export const idleClip: Clip = {
  name: 'boar-idle',
  duration: 1.8,
  loop: true,
  ease: linear,
  keyframes: [
    { time: 0, joint: 'spine', rotation: [0, 0, 0] },
    { time: 0.9, joint: 'spine', rotation: [0.05, 0, 0] },
    { time: 1.8, joint: 'spine', rotation: [0, 0, 0] },
  ],
};

const TELEGRAPH_PLUS_CHARGE = 0.9; // matches EnemyAI's TELEGRAPH_SECONDS + ATTACK_SECONDS

export const chargeClip: Clip = {
  name: 'boar-charge',
  duration: TELEGRAPH_PLUS_CHARGE,
  loop: false,
  ease: linear,
  keyframes: [
    { time: 0, joint: 'spine', rotation: [-0.15, 0, 0] }, // low, coiled telegraph
    { time: 0.6, joint: 'spine', rotation: [0.35, 0, 0] }, // charge forward, head down
    { time: 0.9, joint: 'spine', rotation: [0, 0, 0] },
  ],
};
