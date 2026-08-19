import type { Clip } from './rig/Clip';
import { linear } from './rig/Clip';

// Real flight-specific clips — the enemy CanopyOwl only ever needed perch-idle + a one-shot dive,
// since it hunts from a fixed perch. A PLAYER-controlled owl needs continuous real flight
// locomotion instead: a slow hover for near-zero airspeed and a real fast cruising wingbeat that
// blends in as horizontal speed climbs, the exact same idle<->walk blend idiom every other
// species already uses (see createPlayableCharacter.ts's own WALK_SPEED_FOR_FULL_BLEND pattern),
// just with hover/flap standing in for idle/walk.

export const hoverClip: Clip = {
  name: 'owl-hover',
  duration: 1.2,
  loop: true,
  ease: linear,
  keyframes: [
    { time: 0, joint: 'wingL', rotation: [0, 0, 0.3] },
    { time: 0.6, joint: 'wingL', rotation: [0, 0, 0.65] },
    { time: 1.2, joint: 'wingL', rotation: [0, 0, 0.3] },
    { time: 0, joint: 'wingR', rotation: [0, 0, -0.3] },
    { time: 0.6, joint: 'wingR', rotation: [0, 0, -0.65] },
    { time: 1.2, joint: 'wingR', rotation: [0, 0, -0.3] },
    { time: 0, joint: 'tail0', rotation: [0.1, 0, 0] },
    { time: 0.6, joint: 'tail0', rotation: [0.16, 0, 0] },
    { time: 1.2, joint: 'tail0', rotation: [0.1, 0, 0] },
  ],
};

// A real wingbeat is much faster than any hover — 0.4s per full cycle vs. the hover's 1.2s — and
// pitches the whole body forward into a real cruising attitude, tail trimmed for stable forward
// flight rather than the hover's braking-fan spread.
export const flapClip: Clip = {
  name: 'owl-flap',
  duration: 0.4,
  loop: true,
  ease: linear,
  keyframes: [
    { time: 0, joint: 'wingL', rotation: [0, -0.15, 0.15] },
    { time: 0.2, joint: 'wingL', rotation: [0, -0.15, 0.85] },
    { time: 0.4, joint: 'wingL', rotation: [0, -0.15, 0.15] },
    { time: 0, joint: 'wingR', rotation: [0, 0.15, -0.15] },
    { time: 0.2, joint: 'wingR', rotation: [0, 0.15, -0.85] },
    { time: 0.4, joint: 'wingR', rotation: [0, 0.15, -0.15] },
    { time: 0, joint: 'spine', rotation: [0.25, 0, 0] },
    { time: 0.4, joint: 'spine', rotation: [0.25, 0, 0] },
    { time: 0, joint: 'tail0', rotation: [0, 0, 0] },
    { time: 0.2, joint: 'tail0', rotation: [0.05, 0, 0] },
    { time: 0.4, joint: 'tail0', rotation: [0, 0, 0] },
  ],
};
