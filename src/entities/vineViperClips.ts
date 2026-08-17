import type { Clip, Keyframe } from '../scene/rig/Clip';
import { linear, easeInOutQuad } from '../scene/rig/Clip';
import type { JointName } from '../scene/rig/Rig';

// EnemyAI's telegraph window for the viper (ai.telegraphSeconds = 0.32, createVineViper.ts) plus
// its fixed ATTACK_SECONDS (0.3). Keep in sync with createVineViper's telegraph assignment by
// hand — same convention as canopyOwlClips' TELEGRAPH_PLUS_DIVE and groveBearClips'
// TELEGRAPH_PLUS_SWIPE.
const VIPER_TELEGRAPH_SECONDS = 0.32;
const ATTACK_SECONDS = 0.3;
const TELEGRAPH_PLUS_STRIKE = VIPER_TELEGRAPH_SECONDS + ATTACK_SECONDS; // 0.62

// The body chain the slither/strike clips can drive — spine plus the full tail0..tail4 run (this
// species has no separate "tail", the whole body IS this chain, per the design doc's JointName
// note). TAIL_JOINTS excludes spine because spine's identity-pin needs a position field alongside
// rotation (see slitherKeyframesForJoint) while the tail joints only ever need rotation.
const TAIL_JOINTS: JointName[] = ['tail0', 'tail1', 'tail2', 'tail3', 'tail4'];

// A coiled viper is almost entirely still: an ambush predator waits, it doesn't patrol. So the
// loop is a slow head sway (locating prey by scent/heat, not sight alone) plus a faint breathing
// lift through the spine — not the slither clip below, which is real locomotion and would read as
// "already hunting" if it played while coiled.
//
// Real resemblance fix: this used to pin the whole tail chain to IDENTITY rotation while coiled —
// mechanically safe (see the bug this pin fixes, below) but visually wrong. A snake at rest is not
// a straight tube with a wedge head; it's coiled into a loop. TAIL_CURL_PER_JOINT applies the SAME
// local yaw to every joint in the tail0->tail4 chain — since each joint is a child of the previous
// one, that one repeated local rotation compounds down the chain into a real, smooth, uniform-
// curvature spiral (5 joints * 0.5 rad ≈ a 143° arc), the same way a constant-curvature arc is
// built from many small straight segments.
export const TAIL_CURL_PER_JOINT = 0.5;

// The tail0..tail4 entries below are NOT decorative — they are the fix for a real bug: slitherClip
// drives lateral yaw on this whole chain but loops, so it can be cut off mid-cycle at an arbitrary
// phase whenever the AI leaves 'telegraph'-out-of-range. Since applyClipToRig only ever sets the
// joints the *currently applied* clip actually names, coilClip has to explicitly pin every one of
// those joints back to a fixed value (now the real coil shape above, not identity) — otherwise a
// viper that fought once keeps a kinked lower body forever, because nothing else ever touches
// tail0..tail4 again after slither stops driving them.
export const coilClip: Clip = {
  name: 'viper-coil',
  duration: 4.4,
  loop: true,
  ease: easeInOutQuad,
  keyframes: [
    { time: 0, joint: 'head', rotation: [0, 0, 0] },
    { time: 1.1, joint: 'head', rotation: [0, 0.3, 0] },
    { time: 2.2, joint: 'head', rotation: [0, 0, 0] },
    { time: 3.3, joint: 'head', rotation: [0, -0.3, 0] },
    { time: 4.4, joint: 'head', rotation: [0, 0, 0] },

    { time: 0, joint: 'spine', position: [0, 0, 0] },
    { time: 2.2, joint: 'spine', position: [0, 0.012, 0] },
    { time: 4.4, joint: 'spine', position: [0, 0, 0] },

    // Real coiled-body pin — see file-level comment above.
    ...TAIL_JOINTS.map((joint): Keyframe => ({ time: 0, joint, rotation: [0, TAIL_CURL_PER_JOINT, 0] })),
  ],
};

// Amplitude grows toward the tail tip — a whip-crack that propagates down the body on the strike,
// not just the head snapping — and every joint returns to identity at the final keyframe, the same
// convention createCanopyOwl's diveClip uses for every joint IT touches (see coilClip's comment
// above for why that return-to-identity matters here specifically).
function tailStrikeKeyframes(joint: JointName, ampScale: number): Keyframe[] {
  return [
    { time: 0, joint, rotation: [0, 0, 0] },
    { time: VIPER_TELEGRAPH_SECONDS, joint, rotation: [0, -0.12 * ampScale, 0] },
    { time: VIPER_TELEGRAPH_SECONDS + 0.06, joint, rotation: [0, 0.5 * ampScale, 0] },
    { time: TELEGRAPH_PLUS_STRIKE, joint, rotation: [0, 0, 0] },
  ];
}

// The real strike shape (see design doc's viper research): rear back through the whole telegraph
// window, then the strike itself lands almost instantly — a real pit viper closes in well under
// 100ms, so nearly all of the remaining ATTACK_SECONDS window is the snap holding extended, not
// travelling. Position keyframes are OFFSETS from the bind pose (Clip.ts routes them through
// rig.applyPositionOffset), so t=0 must be exactly [0,0,0] or the first frame would teleport the
// head — same rule createCanopyOwl's diveClip follows. spine also carries an explicit identity
// position (it never actually moves here, only rotates) so a leftover coilClip breathing offset
// can't stay frozen through the whole strike — same stale-joint fix as the tail chain above.
export const strikeClip: Clip = {
  name: 'viper-strike',
  duration: TELEGRAPH_PLUS_STRIKE,
  loop: false,
  ease: linear,
  keyframes: [
    // Head: rears back and up through the telegraph, then snaps down-and-forward on the strike
    // frame, then relaxes back to neutral (held through the rest of 'attacking'/'recovering').
    { time: 0, joint: 'head', rotation: [0, 0, 0], position: [0, 0, 0] },
    { time: VIPER_TELEGRAPH_SECONDS, joint: 'head', rotation: [-0.55, 0, 0], position: [0, 0.025, -0.05] },
    { time: VIPER_TELEGRAPH_SECONDS + 0.06, joint: 'head', rotation: [0.7, 0, 0], position: [0, -0.03, 0.1] },
    { time: TELEGRAPH_PLUS_STRIKE, joint: 'head', rotation: [0, 0, 0], position: [0, 0, 0] },

    // Jaw: stays shut through the entire rear-back — a viper does not gape while winding up —
    // and gapes wide open only on the strike frame itself, baring the fangs.
    { time: 0, joint: 'jaw', rotation: [0, 0, 0] },
    { time: VIPER_TELEGRAPH_SECONDS, joint: 'jaw', rotation: [0, 0, 0] },
    { time: VIPER_TELEGRAPH_SECONDS + 0.06, joint: 'jaw', rotation: [0.95, 0, 0] },
    { time: TELEGRAPH_PLUS_STRIKE, joint: 'jaw', rotation: [0, 0, 0] },

    // Spine: the body coils tighter during the rear-back, then drives the whole body forward on
    // the strike frame — the "third of its body length" lunge the design doc describes. Position
    // stays pinned to [0,0,0] throughout (see file comment above).
    { time: 0, joint: 'spine', rotation: [0, 0, 0], position: [0, 0, 0] },
    { time: VIPER_TELEGRAPH_SECONDS, joint: 'spine', rotation: [-0.32, 0, 0], position: [0, 0, 0] },
    { time: VIPER_TELEGRAPH_SECONDS + 0.06, joint: 'spine', rotation: [0.4, 0, 0], position: [0, 0, 0] },
    { time: TELEGRAPH_PLUS_STRIKE, joint: 'spine', rotation: [0, 0, 0], position: [0, 0, 0] },

    // Tail: the strike is a whole-body lunge, not just a head snap — see tailStrikeKeyframes.
    ...TAIL_JOINTS.flatMap((joint, i) => tailStrikeKeyframes(joint, 0.4 + i * 0.15)),
  ],
};

const SLITHER_DURATION = 1.0;
const SLITHER_AMPLITUDE = 0.35; // yaw radians at wave peak
const SLITHER_SAMPLES = 8; // keyframes per joint per cycle — a smooth sampled sine, not a triangle
const SLITHER_CHAIN: JointName[] = ['spine', ...TAIL_JOINTS];

// Every joint in the chain gets the *same* sine waveform, sampled at the same times — only the
// phase differs, spaced evenly down the chain. That phase offset is the whole point: it is what
// turns a shared waveform into a travelling wave instead of the whole body yawing in unison.
// `pinPosition` additionally pins spine's position to identity on every frame of this clip — spine
// is the one joint coilClip actually moves (its breathing offset), so without this pin a cutover
// from coilClip mid-breath would leave that tiny offset frozen for the rest of the fight (same
// class of bug as the tail-chain fix above, just on the position channel instead of rotation).
function slitherKeyframesForJoint(joint: JointName, phase: number, pinPosition: boolean): Keyframe[] {
  const frames: Keyframe[] = [];
  for (let i = 0; i <= SLITHER_SAMPLES; i++) {
    const time = (i / SLITHER_SAMPLES) * SLITHER_DURATION;
    const angle = (i / SLITHER_SAMPLES) * Math.PI * 2 + phase;
    const frame: Keyframe = { time, joint, rotation: [0, Math.sin(angle) * SLITHER_AMPLITUDE, 0] };
    if (pinPosition) frame.position = [0, 0, 0];
    frames.push(frame);
  }
  return frames;
}

export const slitherClip: Clip = {
  name: 'viper-slither',
  duration: SLITHER_DURATION,
  loop: true,
  ease: linear,
  keyframes: SLITHER_CHAIN.flatMap((joint, i) =>
    slitherKeyframesForJoint(joint, (i / SLITHER_CHAIN.length) * Math.PI * 2, joint === 'spine'),
  ),
};
