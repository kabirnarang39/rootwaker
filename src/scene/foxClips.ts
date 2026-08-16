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
