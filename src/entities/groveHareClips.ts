import type { Clip } from '../scene/rig/Clip';
import { linear, easeInOutQuad } from '../scene/rig/Clip';

export const grazeClip: Clip = {
  name: 'graze',
  duration: 2.4,
  loop: true,
  ease: easeInOutQuad,
  keyframes: [
    { time: 0, joint: 'spine', rotation: [0.1, 0, 0] },
    { time: 1.2, joint: 'spine', rotation: [0.3, 0, 0] },
    { time: 2.4, joint: 'spine', rotation: [0.1, 0, 0] },
    { time: 0, joint: 'earL', rotation: [0, -0.1, 0] },
    { time: 1.2, joint: 'earL', rotation: [0, 0.15, 0] },
    { time: 2.4, joint: 'earL', rotation: [0, -0.1, 0] },
  ],
};

export const fleeClip: Clip = {
  name: 'flee',
  duration: 0.32,
  loop: true,
  ease: linear,
  keyframes: [
    { time: 0, joint: 'hindpawL', rotation: [-0.9, 0, 0] },
    { time: 0.16, joint: 'hindpawL', rotation: [0.9, 0, 0] },
    { time: 0.32, joint: 'hindpawL', rotation: [-0.9, 0, 0] },
    { time: 0, joint: 'hindpawR', rotation: [0.9, 0, 0] },
    { time: 0.16, joint: 'hindpawR', rotation: [-0.9, 0, 0] },
    { time: 0.32, joint: 'hindpawR', rotation: [0.9, 0, 0] },
    { time: 0, joint: 'spine', position: [0, 0, 0] },
    { time: 0.16, joint: 'spine', position: [0, 0.08, 0] },
    { time: 0.32, joint: 'spine', position: [0, 0, 0] },
  ],
};
