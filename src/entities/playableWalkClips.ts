import type { Clip } from '../scene/rig/Clip';
import { linear } from '../scene/rig/Clip';

const LEG_SWING = 0.32;

// Real per-species locomotion for the 3 newly-playable species (boar/lion/crocodile) — only
// needed for player control, since none of their enemy versions ever locomote via a walk clip
// (tuskBoar/createLion/createCrocodile only ever idle or charge/pounce/lunge in place). Standard
// diagonal-trot pairing (forepawL with hindpawR), matching createFox.ts's own walkClip convention
// — the same quadruped joint set (shoulderL/R, hipL/R, forepawL/R, hindpawL/R) every one of these
// 3 species already shares with the fox/bear/lion/boar/crocodile enemy rigs.

export const boarWalkClip: Clip = {
  name: 'boar-walk',
  duration: 0.5, // a real boar's trot is quicker/choppier than the fox's own 0.6s cadence
  loop: true,
  ease: linear,
  keyframes: [
    { time: 0, joint: 'forepawL', rotation: [-LEG_SWING, 0, 0] },
    { time: 0.25, joint: 'forepawL', rotation: [LEG_SWING, 0, 0] },
    { time: 0.5, joint: 'forepawL', rotation: [-LEG_SWING, 0, 0] },

    { time: 0, joint: 'forepawR', rotation: [LEG_SWING, 0, 0] },
    { time: 0.25, joint: 'forepawR', rotation: [-LEG_SWING, 0, 0] },
    { time: 0.5, joint: 'forepawR', rotation: [LEG_SWING, 0, 0] },

    { time: 0, joint: 'hindpawL', rotation: [LEG_SWING, 0, 0] },
    { time: 0.25, joint: 'hindpawL', rotation: [-LEG_SWING, 0, 0] },
    { time: 0.5, joint: 'hindpawL', rotation: [LEG_SWING, 0, 0] },

    { time: 0, joint: 'hindpawR', rotation: [-LEG_SWING, 0, 0] },
    { time: 0.25, joint: 'hindpawR', rotation: [LEG_SWING, 0, 0] },
    { time: 0.5, joint: 'hindpawR', rotation: [-LEG_SWING, 0, 0] },

    { time: 0, joint: 'head', rotation: [0.04, 0, 0] },
    { time: 0.25, joint: 'head', rotation: [-0.04, 0, 0] },
    { time: 0.5, joint: 'head', rotation: [0.04, 0, 0] },
  ],
};

export const lionWalkClip: Clip = {
  name: 'lion-walk',
  duration: 0.65, // a real big cat's stride is slower/longer than the fox's own quick trot
  loop: true,
  ease: linear,
  keyframes: [
    { time: 0, joint: 'forepawL', rotation: [-LEG_SWING, 0, 0] },
    { time: 0.325, joint: 'forepawL', rotation: [LEG_SWING, 0, 0] },
    { time: 0.65, joint: 'forepawL', rotation: [-LEG_SWING, 0, 0] },

    { time: 0, joint: 'forepawR', rotation: [LEG_SWING, 0, 0] },
    { time: 0.325, joint: 'forepawR', rotation: [-LEG_SWING, 0, 0] },
    { time: 0.65, joint: 'forepawR', rotation: [LEG_SWING, 0, 0] },

    { time: 0, joint: 'hindpawL', rotation: [LEG_SWING, 0, 0] },
    { time: 0.325, joint: 'hindpawL', rotation: [-LEG_SWING, 0, 0] },
    { time: 0.65, joint: 'hindpawL', rotation: [LEG_SWING, 0, 0] },

    { time: 0, joint: 'hindpawR', rotation: [-LEG_SWING, 0, 0] },
    { time: 0.325, joint: 'hindpawR', rotation: [LEG_SWING, 0, 0] },
    { time: 0.65, joint: 'hindpawR', rotation: [-LEG_SWING, 0, 0] },

    { time: 0, joint: 'tail0', rotation: [-0.2, -0.25, 0] },
    { time: 0.325, joint: 'tail0', rotation: [-0.2, 0.25, 0] },
    { time: 0.65, joint: 'tail0', rotation: [-0.2, -0.25, 0] },
  ],
};

// A real crocodile's walk is a lateral-sequence sprawl, not a trot — the body itself undulates
// side to side as the legs splay outward, distinct from every other quadruped's walk in this
// game (all diagonal trots). The spine's own yaw sway is the real distinguishing trait here.
export const crocodileWalkClip: Clip = {
  name: 'crocodile-walk',
  duration: 0.9, // a slow, deliberate crawl — matches the enemy version's own near-motionless idle identity
  loop: true,
  ease: linear,
  keyframes: [
    { time: 0, joint: 'forepawL', rotation: [-0.22, 0, 0] },
    { time: 0.45, joint: 'forepawL', rotation: [0.22, 0, 0] },
    { time: 0.9, joint: 'forepawL', rotation: [-0.22, 0, 0] },

    { time: 0, joint: 'forepawR', rotation: [0.22, 0, 0] },
    { time: 0.45, joint: 'forepawR', rotation: [-0.22, 0, 0] },
    { time: 0.9, joint: 'forepawR', rotation: [0.22, 0, 0] },

    { time: 0, joint: 'hindpawL', rotation: [0.22, 0, 0] },
    { time: 0.45, joint: 'hindpawL', rotation: [-0.22, 0, 0] },
    { time: 0.9, joint: 'hindpawL', rotation: [0.22, 0, 0] },

    { time: 0, joint: 'hindpawR', rotation: [-0.22, 0, 0] },
    { time: 0.45, joint: 'hindpawR', rotation: [0.22, 0, 0] },
    { time: 0.9, joint: 'hindpawR', rotation: [-0.22, 0, 0] },

    { time: 0, joint: 'spine', rotation: [0, -0.09, 0] },
    { time: 0.45, joint: 'spine', rotation: [0, 0.09, 0] },
    { time: 0.9, joint: 'spine', rotation: [0, -0.09, 0] },

    { time: 0, joint: 'tail0', rotation: [0, 0.18, 0] },
    { time: 0.45, joint: 'tail0', rotation: [0, -0.18, 0] },
    { time: 0.9, joint: 'tail0', rotation: [0, 0.18, 0] },
  ],
};
