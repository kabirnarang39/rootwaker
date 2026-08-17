import type { Clip } from '../scene/rig/Clip';
import { linear } from '../scene/rig/Clip';

const LEG_SWING = 0.35;

// Real bears use a pacing gait — both legs on the SAME side swing together (forepawL with
// hindpawL, forepawR with hindpawR), unlike a fox/dog's diagonal trot (createFox.ts's walkClip,
// which pairs forepawL with hindpawR instead). That same-side pairing is what produces a real
// bear's distinctive side-to-side lumber, so the spine gets a matching roll (z-rotation) here that
// the fox's walk never needs. Only used by the player-controlled bear (createPlayableBear.ts) —
// the enemy grove bear never locomotes, it just swipes in place.
export const walkClip: Clip = {
  name: 'bear-walk',
  duration: 0.8, // slower cadence than the fox's 0.6s trot — a heavier, more deliberate gait
  loop: true,
  ease: linear,
  keyframes: [
    { time: 0, joint: 'forepawL', rotation: [-LEG_SWING, 0, 0] },
    { time: 0.4, joint: 'forepawL', rotation: [LEG_SWING, 0, 0] },
    { time: 0.8, joint: 'forepawL', rotation: [-LEG_SWING, 0, 0] },

    { time: 0, joint: 'hindpawL', rotation: [-LEG_SWING, 0, 0] },
    { time: 0.4, joint: 'hindpawL', rotation: [LEG_SWING, 0, 0] },
    { time: 0.8, joint: 'hindpawL', rotation: [-LEG_SWING, 0, 0] },

    { time: 0, joint: 'forepawR', rotation: [LEG_SWING, 0, 0] },
    { time: 0.4, joint: 'forepawR', rotation: [-LEG_SWING, 0, 0] },
    { time: 0.8, joint: 'forepawR', rotation: [LEG_SWING, 0, 0] },

    { time: 0, joint: 'hindpawR', rotation: [LEG_SWING, 0, 0] },
    { time: 0.4, joint: 'hindpawR', rotation: [-LEG_SWING, 0, 0] },
    { time: 0.8, joint: 'hindpawR', rotation: [LEG_SWING, 0, 0] },

    { time: 0, joint: 'spine', rotation: [0, 0, -0.05] },
    { time: 0.4, joint: 'spine', rotation: [0, 0, 0.05] },
    { time: 0.8, joint: 'spine', rotation: [0, 0, -0.05] },
  ],
};

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
