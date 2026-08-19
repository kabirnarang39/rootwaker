import type { Clip } from '../scene/rig/Clip';
import { linear } from '../scene/rig/Clip';

export const idleClip: Clip = {
  name: 'lion-idle',
  duration: 2.4,
  loop: true,
  ease: linear,
  keyframes: [
    { time: 0, joint: 'spine', rotation: [0, 0, 0] },
    { time: 1.2, joint: 'spine', rotation: [0.04, 0, 0] },
    { time: 2.4, joint: 'spine', rotation: [0, 0, 0] },

    // A slow tail sway at rest — real big-cat body language, distinct from the fox's own faster
    // walking tail (createFox.ts's walkClip) or the viper's coiled stillness.
    { time: 0, joint: 'tail0', rotation: [0, -0.15, 0] },
    { time: 1.2, joint: 'tail0', rotation: [0, 0.15, 0] },
    { time: 2.4, joint: 'tail0', rotation: [0, -0.15, 0] },
  ],
};

// Kept in sync by hand with createLion.ts's own ai.telegraphSeconds(0.4) + EnemyAI's default
// ATTACK_SECONDS(0.3) — same convention as tuskBoarClips' TELEGRAPH_PLUS_CHARGE.
const TELEGRAPH_PLUS_POUNCE = 0.7;
// Real lion kill technique isn't a bite-and-release like a crocodile's ambush strike — a lion's
// primary kill method is a throat bite held through the prey's struggle, suffocating it (the bulk
// of the lion's own weight and social hunting matter more than raw bite force alone). 0.5s covers
// the clamp-down and a real hold-through-struggle shake before releasing back to neutral.
const THROAT_BITE_HOLD = 0.5;
const POUNCE_PLUS_THROAT_BITE = TELEGRAPH_PLUS_POUNCE + THROAT_BITE_HOLD;

// A real lion's attack is a full-body leaping tackle, not a headbutt (tuskBoar) or a claw swipe
// (grove bear): crouch low and coiled through the telegraph (the real "about to pounce" stillness
// a big cat holds before committing), then an explosive forward-and-up lunge with a real vertical
// hop (spine position, not just rotation — the only species in the game whose attack actually
// leaves the ground), landing low and forward — then, still on top of the prey, the head and jaw
// clamp down into a real throat bite and hold, with a small tension shake standing in for the
// prey's struggle, before releasing.
export const pounceClip: Clip = {
  name: 'lion-pounce',
  duration: POUNCE_PLUS_THROAT_BITE,
  loop: false,
  ease: linear,
  keyframes: [
    { time: 0, joint: 'spine', rotation: [0, 0, 0], position: [0, 0, 0] },
    { time: 0.4, joint: 'spine', rotation: [-0.4, 0, 0], position: [0, -0.04, 0] }, // coiled crouch, telegraph
    { time: 0.55, joint: 'spine', rotation: [0.3, 0, 0], position: [0, 0.16, 0] }, // explosive leap, airborne
    { time: 0.7, joint: 'spine', rotation: [0.1, 0, 0], position: [0, 0, 0] }, // lands low and forward

    { time: 0, joint: 'tail0', rotation: [0, 0, 0] },
    { time: 0.4, joint: 'tail0', rotation: [0, -0.3, 0] },
    { time: 0.7, joint: 'tail0', rotation: [0, 0, 0] },

    // Throat bite: head/jaw clamp down and forward right after landing, hold through a small
    // struggle shake, then release back to neutral.
    { time: 0, joint: 'head', rotation: [0, 0, 0] },
    { time: 0.7, joint: 'head', rotation: [0, 0, 0] },
    { time: 0.78, joint: 'head', rotation: [-0.4, 0, 0] },
    { time: 0.9, joint: 'head', rotation: [-0.32, 0.06, 0] }, // struggle shake
    { time: 1.0, joint: 'head', rotation: [-0.4, -0.06, 0] },
    { time: 1.2, joint: 'head', rotation: [0, 0, 0] },
    { time: 0, joint: 'jaw', rotation: [0, 0, 0] },
    { time: 0.7, joint: 'jaw', rotation: [0, 0, 0] },
    { time: 0.78, joint: 'jaw', rotation: [-0.25, 0, 0] }, // clamped shut, held
    { time: 1.2, joint: 'jaw', rotation: [0, 0, 0] },
  ],
};
