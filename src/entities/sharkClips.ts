import type { Clip } from '../scene/rig/Clip';
import { linear } from '../scene/rig/Clip';

// Real shark locomotion: unlike a snake's whole-body serpentine wave, a shark's rigid torpedo
// body barely flexes — propulsion concentrates almost entirely at the tail, with the pectoral
// fins staying comparatively stiff (used for lift/steering, not thrust). A shark is also almost
// NEVER fully still (unlike the crocodile's deliberately near-motionless ambush idle) — real
// sharks patrol in a constant slow cruise even when not hunting, which is the real anatomical/
// behavioral distinction this idle clip is built to read as.
export const cruiseClip: Clip = {
  name: 'shark-cruise',
  duration: 1.6,
  loop: true,
  ease: linear,
  keyframes: [
    { time: 0, joint: 'tail0', rotation: [0, -0.22, 0] },
    { time: 0.8, joint: 'tail0', rotation: [0, 0.22, 0] },
    { time: 1.6, joint: 'tail0', rotation: [0, -0.22, 0] },

    { time: 0, joint: 'tail1', rotation: [0, 0.3, 0] },
    { time: 0.8, joint: 'tail1', rotation: [0, -0.3, 0] },
    { time: 1.6, joint: 'tail1', rotation: [0, 0.3, 0] },

    { time: 0, joint: 'tail2', rotation: [0, -0.4, 0] },
    { time: 0.8, joint: 'tail2', rotation: [0, 0.4, 0] },
    { time: 1.6, joint: 'tail2', rotation: [0, -0.4, 0] },

    // A real, very slight steering wobble on the pectoral fins — never the tail's own amplitude.
    { time: 0, joint: 'wingL', rotation: [0, 0, -0.05] },
    { time: 0.8, joint: 'wingL', rotation: [0, 0, 0.05] },
    { time: 1.6, joint: 'wingL', rotation: [0, 0, -0.05] },
    { time: 0, joint: 'wingR', rotation: [0, 0, 0.05] },
    { time: 0.8, joint: 'wingR', rotation: [0, 0, -0.05] },
    { time: 1.6, joint: 'wingR', rotation: [0, 0, 0.05] },
  ],
};

const TELEGRAPH_PLUS_LUNGE = 0.9; // matches EnemyAI's own TELEGRAPH_SECONDS + ATTACK_SECONDS

// Real predatory ram-and-bite: unlike the crocodile's ambush-from-stillness lunge, a shark's
// real attack builds from an already-moving cruise into a fast committed acceleration, jaw
// snapping wide open right at the moment of contact — the tail whips harder (larger amplitude
// than cruiseClip's own) to drive the actual ramming speed.
export const lungeClip: Clip = {
  name: 'shark-lunge',
  duration: TELEGRAPH_PLUS_LUNGE,
  loop: false,
  ease: linear,
  keyframes: [
    { time: 0, joint: 'spine', rotation: [0, 0, 0] },
    { time: 0, joint: 'jaw', rotation: [0, 0, 0] },
    { time: 0, joint: 'tail2', rotation: [0, 0, 0] },
    { time: 0.4, joint: 'spine', rotation: [0.1, 0, 0], position: [0, 0, -0.1] }, // real coiling wind-up
    { time: 0.4, joint: 'jaw', rotation: [-0.15, 0, 0] },
    { time: 0.4, joint: 'tail2', rotation: [0, -0.7, 0] },
    { time: 0.62, joint: 'spine', rotation: [-0.12, 0, 0], position: [0, 0, 0.45] }, // the actual ram
    { time: 0.62, joint: 'jaw', rotation: [-0.75, 0, 0] }, // real wide-open bite at the strike instant
    { time: 0.62, joint: 'tail2', rotation: [0, 0.75, 0] },
    { time: 0.9, joint: 'spine', rotation: [0, 0, 0], position: [0, 0, 0] },
    { time: 0.9, joint: 'jaw', rotation: [0, 0, 0] },
    { time: 0.9, joint: 'tail2', rotation: [0, 0, 0] },
  ],
};
