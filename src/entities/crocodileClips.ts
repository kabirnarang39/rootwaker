import type { Clip } from '../scene/rig/Clip';
import { linear } from '../scene/rig/Clip';

// Real crocodiles are ambush predators that stay almost perfectly still for long stretches — the
// idle clip is deliberately the subtlest in the game (a barely-perceptible tail sway), not a
// walking/breathing loop, so the sudden telegraph+lunge below reads as a real change in intent.
export const idleClip: Clip = {
  name: 'crocodile-idle',
  duration: 3,
  loop: true,
  ease: linear,
  keyframes: [
    { time: 0, joint: 'tail1', rotation: [0, 0, 0] },
    { time: 1.5, joint: 'tail1', rotation: [0, 0.08, 0] },
    { time: 3, joint: 'tail1', rotation: [0, 0, 0] },
  ],
};

const TELEGRAPH_PLUS_ATTACK = 0.9; // matches EnemyAI's default TELEGRAPH_SECONDS + ATTACK_SECONDS

// The real signature crocodile motion: a low, coiled wind-up with jaws opening wide (the
// telegraph — the player's real dodge window), then an explosive forward lunge that snaps the
// jaws shut, driven by the tail whipping the opposite direction for real counter-propulsion.
export const lungeClip: Clip = {
  name: 'crocodile-lunge',
  duration: TELEGRAPH_PLUS_ATTACK,
  loop: false,
  ease: linear,
  keyframes: [
    { time: 0, joint: 'spine', rotation: [0, 0, 0], position: [0, 0, 0] },
    { time: 0, joint: 'jaw', rotation: [0, 0, 0] },
    { time: 0, joint: 'tail1', rotation: [0, 0, 0] },
    { time: 0.5, joint: 'spine', rotation: [-0.14, 0, 0], position: [0, 0, -0.06] },
    { time: 0.5, joint: 'jaw', rotation: [-0.55, 0, 0] },
    { time: 0.5, joint: 'tail1', rotation: [0, 0.25, 0] },
    { time: 0.62, joint: 'spine', rotation: [0.1, 0, 0], position: [0, 0, 0.3] },
    { time: 0.62, joint: 'jaw', rotation: [0, 0, 0] },
    { time: 0.62, joint: 'tail1', rotation: [0, -0.2, 0] },
    { time: 0.9, joint: 'spine', rotation: [0, 0, 0], position: [0, 0, 0] },
    { time: 0.9, joint: 'tail1', rotation: [0, 0, 0] },
  ],
};
