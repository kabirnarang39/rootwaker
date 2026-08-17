import type { Clip, Keyframe } from '../scene/rig/Clip';
import { easeInOutQuad } from '../scene/rig/Clip';
import type { JointName } from '../scene/rig/Rig';

const TAIL_JOINTS: JointName[] = ['tail0', 'tail1', 'tail2'];

// Nibbling head-bob: fast (0.5s) and continuous, unlike the hare's slow 2.4s grazing sway — a
// squirrel handling a nut bobs its head quickly and repeatedly. spine and tail0..tail2 (the joints
// alertClip actually animates) get an explicit identity pin here — this is the fix for the exact
// bug class Task 3 found in the viper's tail (commit 0ec0b0f): createGroveSquirrel blends this clip
// against alertClip every frame by weight, and blendClips falls straight through to whichever side
// has data when the other doesn't, ignoring weight entirely. Without these pins, spine/tail would
// snap to alertClip's upright/flick pose even while grazing at weight 0.
export const forageClip: Clip = {
  name: 'squirrel-forage',
  duration: 0.5,
  loop: true,
  ease: easeInOutQuad,
  keyframes: [
    { time: 0, joint: 'head', rotation: [0, 0, 0] },
    { time: 0.25, joint: 'head', rotation: [0.4, 0, 0] },
    { time: 0.5, joint: 'head', rotation: [0, 0, 0] },

    // Identity pins — see file comment above.
    { time: 0, joint: 'spine', rotation: [0, 0, 0] },
    ...TAIL_JOINTS.map((joint): Keyframe => ({ time: 0, joint, rotation: [0, 0, 0] })),
  ],
};

// Upright freeze: a squirrel that has spotted a threat sits bolt upright on its haunches and goes
// almost entirely still except for the tail, which flags/flicks — real alarm signalling aimed *at*
// the predator (see design doc). Amplitude grows toward the tail tip, the same "whip propagates
// outward" shape vineViperClips' strike uses down its body chain. head gets an explicit identity
// pin — see forageClip's comment above for why that pin matters (same bug class, opposite joint).
export const alertClip: Clip = {
  name: 'squirrel-alert',
  duration: 0.5,
  loop: true,
  ease: easeInOutQuad,
  keyframes: [
    // Identity pin — see file comment above.
    { time: 0, joint: 'head', rotation: [0, 0, 0] },

    { time: 0, joint: 'spine', rotation: [-0.5, 0, 0] },
    { time: 0.25, joint: 'spine', rotation: [-0.56, 0, 0] },
    { time: 0.5, joint: 'spine', rotation: [-0.5, 0, 0] },

    ...TAIL_JOINTS.flatMap((joint, i): Keyframe[] => {
      const amp = 0.5 + i * 0.35; // wider swing toward the bushy tip, same growth shape as the tail's own widening taper
      return [
        { time: 0, joint, rotation: [0, 0, 0] },
        { time: 0.125, joint, rotation: [0, amp, 0] },
        { time: 0.25, joint, rotation: [0, -0.15 * amp, 0] },
        { time: 0.375, joint, rotation: [0, amp * 0.75, 0] },
        { time: 0.5, joint, rotation: [0, 0, 0] },
      ];
    }),
  ],
};
