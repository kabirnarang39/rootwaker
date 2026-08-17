import type { Clip } from '../scene/rig/Clip';
import { linear, easeInOutQuad } from '../scene/rig/Clip';

// A perched owl is almost entirely still except for its head: it hunts by ear from a perch,
// swivelling to triangulate sound rather than shifting its body (see the design doc's owl
// research). So the loop is a slow head sweep left/right with only a faint wing settle — not
// the bear idle's whole-spine breathing bob, which on a bird would read as a wobbling toy.
export const perchClip: Clip = {
  name: 'owl-perch',
  duration: 3.6,
  loop: true,
  ease: easeInOutQuad,
  keyframes: [
    { time: 0, joint: 'head', rotation: [0, 0, 0] },
    { time: 0.9, joint: 'head', rotation: [0, 0.85, 0] },
    { time: 1.8, joint: 'head', rotation: [0, 0, 0] },
    { time: 2.7, joint: 'head', rotation: [0, -0.85, 0] },
    { time: 3.6, joint: 'head', rotation: [0, 0, 0] },
    { time: 0, joint: 'wingL', rotation: [0, 0, 0] },
    { time: 1.8, joint: 'wingL', rotation: [0, 0, 0.08] },
    { time: 3.6, joint: 'wingL', rotation: [0, 0, 0] },
    { time: 0, joint: 'wingR', rotation: [0, 0, 0] },
    { time: 1.8, joint: 'wingR', rotation: [0, 0, -0.08] },
    { time: 3.6, joint: 'wingR', rotation: [0, 0, 0] },
  ],
};

// EnemyAI's telegraph window for the owl (ai.telegraphSeconds = 0.5) plus its fixed
// ATTACK_SECONDS (0.3). Keep in sync with createCanopyOwl's telegraph assignment by hand —
// same convention as groveBearClips' TELEGRAPH_PLUS_SWIPE.
const TELEGRAPH_PLUS_DIVE = 0.8;

// The real strike shape: wings sweep back and up over the wind-up (an owl folds into the stoop
// rather than flapping down at prey), then the legs swing forward and the talons are thrust out
// at the last moment. The spine position keyframes are OFFSETS from the bind pose — Clip.ts
// routes them through rig.applyPositionOffset — so they are small deltas around zero and t=0
// must be exactly [0,0,0] or the first frame would visibly teleport the body.
export const diveClip: Clip = {
  name: 'owl-dive-strike',
  duration: TELEGRAPH_PLUS_DIVE,
  loop: false,
  ease: linear,
  keyframes: [
    // Wind-up: body tips back, wings sweep back and up, legs tuck.
    { time: 0, joint: 'spine', rotation: [0, 0, 0], position: [0, 0, 0] },
    { time: 0.5, joint: 'spine', rotation: [-0.3, 0, 0], position: [0, 0.05, -0.04] },
    { time: 0.66, joint: 'spine', rotation: [0.45, 0, 0], position: [0, -0.06, 0.1] },
    { time: 0.8, joint: 'spine', rotation: [0, 0, 0], position: [0, 0, 0] },

    { time: 0, joint: 'wingL', rotation: [0, 0, 0] },
    { time: 0.5, joint: 'wingL', rotation: [0, -0.5, 1.0] },
    { time: 0.66, joint: 'wingL', rotation: [0, 0.25, -0.35] },
    { time: 0.8, joint: 'wingL', rotation: [0, 0, 0] },
    { time: 0, joint: 'wingR', rotation: [0, 0, 0] },
    { time: 0.5, joint: 'wingR', rotation: [0, 0.5, -1.0] },
    { time: 0.66, joint: 'wingR', rotation: [0, -0.25, 0.35] },
    { time: 0.8, joint: 'wingR', rotation: [0, 0, 0] },

    // Talons: tucked under during the wind-up, thrust forward on the strike frame.
    { time: 0, joint: 'hipL', rotation: [0, 0, 0] },
    { time: 0.5, joint: 'hipL', rotation: [0.6, 0, 0] },
    { time: 0.66, joint: 'hipL', rotation: [-1.1, 0, 0] },
    { time: 0.8, joint: 'hipL', rotation: [0, 0, 0] },
    { time: 0, joint: 'hipR', rotation: [0, 0, 0] },
    { time: 0.5, joint: 'hipR', rotation: [0.6, 0, 0] },
    { time: 0.66, joint: 'hipR', rotation: [-1.1, 0, 0] },
    { time: 0.8, joint: 'hipR', rotation: [0, 0, 0] },

    // Head stays locked on the target through the stoop — owls fixate, their eyes barely move
    // in the socket, so the head counter-rotates against the pitching body.
    { time: 0, joint: 'head', rotation: [0, 0, 0] },
    { time: 0.5, joint: 'head', rotation: [0.3, 0, 0] },
    { time: 0.66, joint: 'head', rotation: [-0.3, 0, 0] },
    { time: 0.8, joint: 'head', rotation: [0, 0, 0] },

    // Tail fans down as an air brake on the strike.
    { time: 0, joint: 'tail0', rotation: [0, 0, 0] },
    { time: 0.5, joint: 'tail0', rotation: [-0.25, 0, 0] },
    { time: 0.66, joint: 'tail0', rotation: [0.5, 0, 0] },
    { time: 0.8, joint: 'tail0', rotation: [0, 0, 0] },
  ],
};
