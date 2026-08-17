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

// A real lion's attack is a full-body leaping tackle, not a headbutt (tuskBoar) or a claw swipe
// (grove bear): crouch low and coiled through the telegraph (the real "about to pounce" stillness
// a big cat holds before committing), then an explosive forward-and-up lunge with a real vertical
// hop (spine position, not just rotation — the only species in the game whose attack actually
// leaves the ground), landing low and forward.
export const pounceClip: Clip = {
  name: 'lion-pounce',
  duration: TELEGRAPH_PLUS_POUNCE,
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
  ],
};
