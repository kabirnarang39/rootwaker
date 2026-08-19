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
// Real biomechanics (Drumheller et al. 2019, "Death roll" survey across Crocodylia; Fish et al.
// 2007, J. Exp. Biol.): after the bite locks on, a crocodilian tucks its legs and whips its tail
// to one side to shift its moment of inertia, then barrel-rolls its whole body along its own
// spine to dismember or drown prey — the signature crocodile finishing move, and one every
// crocodilian species but one (the Cuvier's dwarf caiman) performs. 0.6s covers one full spin.
const DEATH_ROLL_DURATION = 0.6;
const LUNGE_PLUS_DEATH_ROLL = TELEGRAPH_PLUS_ATTACK + DEATH_ROLL_DURATION;

// The real signature crocodile motion: a low, coiled wind-up with jaws opening wide (the
// telegraph — the player's real dodge window), then an explosive forward lunge that snaps the
// jaws shut, driven by the tail whipping the opposite direction for real counter-propulsion —
// then, jaws still locked, a real death roll: the tail kicks hard to one side to start the spin
// and the spine barrel-rolls a full turn before settling back level.
export const lungeClip: Clip = {
  name: 'crocodile-lunge',
  duration: LUNGE_PLUS_DEATH_ROLL,
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
    // Death roll: tail whips to the side first (real moment-of-inertia shift that starts the
    // spin), then the spine rolls a full 2π around its own long axis (z — the forward axis here).
    { time: 1.05, joint: 'tail1', rotation: [0, -0.4, 0] },
    { time: 1.2, joint: 'spine', rotation: [0.1, 0, Math.PI], position: [0, 0, 0] },
    { time: 1.4, joint: 'tail1', rotation: [0, 0.15, 0] },
    { time: 1.5, joint: 'spine', rotation: [0, 0, Math.PI * 2], position: [0, 0, 0] },
    { time: 1.5, joint: 'tail1', rotation: [0, 0, 0] },
  ],
};
