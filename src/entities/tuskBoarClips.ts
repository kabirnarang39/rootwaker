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

// Real wild boar gore mechanics: the head drives down through the charge (tusks lead the hit,
// not the body), then whips sharply UP at the moment of impact — a real boar tosses whatever it
// hits with a violent upward neck snap, driven by powerful neck muscles — before settling. Tusks
// flare slightly outward on the same toss, a real goring spread rather than a straight punch.
export const chargeClip: Clip = {
  name: 'boar-charge',
  duration: TELEGRAPH_PLUS_CHARGE,
  loop: false,
  ease: linear,
  keyframes: [
    { time: 0, joint: 'spine', rotation: [-0.15, 0, 0] }, // low, coiled telegraph
    { time: 0.6, joint: 'spine', rotation: [0.35, 0, 0] }, // charge forward, head down
    { time: 0.9, joint: 'spine', rotation: [0, 0, 0] },

    { time: 0, joint: 'head', rotation: [0, 0, 0] },
    { time: 0.5, joint: 'head', rotation: [0.25, 0, 0] }, // tusks lead, driving down through the charge
    { time: 0.65, joint: 'head', rotation: [-0.35, 0, 0] }, // the real upward toss at impact
    { time: 0.9, joint: 'head', rotation: [0, 0, 0] },

    { time: 0, joint: 'tuskL', rotation: [0, 0, 0] },
    { time: 0.65, joint: 'tuskL', rotation: [0, 0, 0.15] },
    { time: 0.9, joint: 'tuskL', rotation: [0, 0, 0] },
    { time: 0, joint: 'tuskR', rotation: [0, 0, 0] },
    { time: 0.65, joint: 'tuskR', rotation: [0, 0, -0.15] },
    { time: 0.9, joint: 'tuskR', rotation: [0, 0, 0] },
  ],
};
