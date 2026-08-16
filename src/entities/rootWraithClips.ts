import type { Clip } from '../scene/rig/Clip';
import { linear } from '../scene/rig/Clip';

export const crawlClip: Clip = {
  name: 'crawl',
  duration: 0.8,
  loop: true,
  ease: linear,
  keyframes: [
    { time: 0, joint: 'forepawL', rotation: [-0.5, 0, 0] },
    { time: 0.4, joint: 'forepawL', rotation: [0.5, 0, 0] },
    { time: 0.8, joint: 'forepawL', rotation: [-0.5, 0, 0] },
    { time: 0, joint: 'forepawR', rotation: [0.5, 0, 0] },
    { time: 0.4, joint: 'forepawR', rotation: [-0.5, 0, 0] },
    { time: 0.8, joint: 'forepawR', rotation: [0.5, 0, 0] },
    { time: 0, joint: 'tail0', rotation: [0, -0.4, 0] },
    { time: 0.4, joint: 'tail0', rotation: [0, 0.4, 0] },
    { time: 0.8, joint: 'tail0', rotation: [0, -0.4, 0] },
  ],
};

const TELEGRAPH_PLUS_ATTACK = 0.9; // matches EnemyAI's TELEGRAPH_SECONDS + ATTACK_SECONDS

export const lungeClip: Clip = {
  name: 'lunge',
  duration: TELEGRAPH_PLUS_ATTACK,
  loop: false,
  ease: linear,
  keyframes: [
    { time: 0, joint: 'spine', rotation: [0.3, 0, 0] }, // wind-up: coil back — the visible telegraph
    { time: 0.6, joint: 'spine', rotation: [-0.5, 0, 0] }, // strike forward
    { time: 0.9, joint: 'spine', rotation: [0, 0, 0] },
  ],
};
