import type { Clip } from './rig/Clip';
import { linear, easeInOutQuad } from './rig/Clip';

const LEG_SWING = 0.4;

export const walkClip: Clip = {
  name: 'walk',
  duration: 0.6,
  loop: true,
  ease: linear,
  keyframes: [
    { time: 0, joint: 'forepawL', rotation: [-LEG_SWING, 0, 0] },
    { time: 0.3, joint: 'forepawL', rotation: [LEG_SWING, 0, 0] },
    { time: 0.6, joint: 'forepawL', rotation: [-LEG_SWING, 0, 0] },

    { time: 0, joint: 'forepawR', rotation: [LEG_SWING, 0, 0] },
    { time: 0.3, joint: 'forepawR', rotation: [-LEG_SWING, 0, 0] },
    { time: 0.6, joint: 'forepawR', rotation: [LEG_SWING, 0, 0] },

    { time: 0, joint: 'hindpawL', rotation: [LEG_SWING, 0, 0] },
    { time: 0.3, joint: 'hindpawL', rotation: [-LEG_SWING, 0, 0] },
    { time: 0.6, joint: 'hindpawL', rotation: [LEG_SWING, 0, 0] },

    { time: 0, joint: 'hindpawR', rotation: [-LEG_SWING, 0, 0] },
    { time: 0.3, joint: 'hindpawR', rotation: [LEG_SWING, 0, 0] },
    { time: 0.6, joint: 'hindpawR', rotation: [-LEG_SWING, 0, 0] },

    { time: 0, joint: 'spine', position: [0, 0, 0] },
    { time: 0.15, joint: 'spine', position: [0, 0.04, 0] },
    { time: 0.3, joint: 'spine', position: [0, 0, 0] },
    { time: 0.45, joint: 'spine', position: [0, 0.04, 0] },
    { time: 0.6, joint: 'spine', position: [0, 0, 0] },

    { time: 0, joint: 'tail0', rotation: [-0.2, -0.3, 0] },
    { time: 0.3, joint: 'tail0', rotation: [-0.2, 0.3, 0] },
    { time: 0.6, joint: 'tail0', rotation: [-0.2, -0.3, 0] },
  ],
};

export const idleClip: Clip = {
  name: 'idle',
  duration: 2.2,
  loop: true,
  ease: easeInOutQuad,
  keyframes: [
    { time: 0, joint: 'spine', position: [0, 0, 0] },
    { time: 1.1, joint: 'spine', position: [0, 0.02, 0] },
    { time: 2.2, joint: 'spine', position: [0, 0, 0] },

    { time: 0, joint: 'tail0', rotation: [-0.2, -0.15, 0] },
    { time: 1.1, joint: 'tail0', rotation: [-0.2, 0.15, 0] },
    { time: 2.2, joint: 'tail0', rotation: [-0.2, -0.15, 0] },
  ],
};

// The eat-ritual clip: head dips low and forward toward the kill, jaw opens and snaps shut in a
// real repeated bite (not a single nibble — this is meant to read as genuinely consuming
// something, the "gain the power" beat the user asked for), spine hunches down over the food, tail
// settles low and still (a fox does not wag its tail mid-meal the way it does while walking).
// Looping over a ~0.5s cycle, played for a few real seconds by Game.ts's eat-ritual timer, so it
// reads as 2-3 real chomps, not one twitch.
export const eatClip: Clip = {
  name: 'eat',
  duration: 0.5,
  loop: true,
  ease: easeInOutQuad,
  keyframes: [
    { time: 0, joint: 'spine', rotation: [0.35, 0, 0], position: [0, -0.05, 0.02] },
    { time: 0.5, joint: 'spine', rotation: [0.35, 0, 0], position: [0, -0.05, 0.02] },

    { time: 0, joint: 'head', rotation: [0.5, 0, 0] },
    { time: 0.15, joint: 'head', rotation: [0.65, 0, 0] },
    { time: 0.3, joint: 'head', rotation: [0.5, 0, 0] },
    { time: 0.5, joint: 'head', rotation: [0.5, 0, 0] },

    { time: 0, joint: 'jaw', rotation: [0, 0, 0] },
    { time: 0.1, joint: 'jaw', rotation: [-0.5, 0, 0] },
    { time: 0.2, joint: 'jaw', rotation: [0, 0, 0] },
    { time: 0.35, joint: 'jaw', rotation: [-0.4, 0, 0] },
    { time: 0.5, joint: 'jaw', rotation: [0, 0, 0] },

    { time: 0, joint: 'tail0', rotation: [-0.2, 0, 0] },
    { time: 0.5, joint: 'tail0', rotation: [-0.2, 0, 0] },
  ],
};
