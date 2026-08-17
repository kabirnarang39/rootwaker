import type { Clip } from '../scene/rig/Clip';
import { linear } from '../scene/rig/Clip';

// A small bird's wingbeat is fast — much faster than anything the owl's rig ever does. The owl
// never truly flaps: perchClip's wing "settle" cycles once every 3.6s and diveClip's single wing
// sweep spans the whole 0.8s stoop. This clip cycles a full up-down beat in 0.12s (roughly 8Hz),
// an order of magnitude faster than either.
export const flapClip: Clip = {
  name: 'finch-flap',
  duration: 0.12,
  loop: true,
  ease: linear,
  keyframes: [
    { time: 0, joint: 'wingL', rotation: [0, 0, 0.1] },
    { time: 0.06, joint: 'wingL', rotation: [0, 0, 1.15] },
    { time: 0.12, joint: 'wingL', rotation: [0, 0, 0.1] },
    { time: 0, joint: 'wingR', rotation: [0, 0, -0.1] },
    { time: 0.06, joint: 'wingR', rotation: [0, 0, -1.15] },
    { time: 0.12, joint: 'wingR', rotation: [0, 0, -0.1] },
  ],
};
