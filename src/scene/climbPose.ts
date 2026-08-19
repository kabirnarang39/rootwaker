import type { Rig } from './rig/Rig';

const CLIMB_REACH_SPEED = 2.4; // rad/s driving the alternating reach cycle — a real deliberate scramble, not a jitter
const CLIMB_LIMB_REACH = 0.55; // bigger than a walk's own leg swing (0.4) — climbing reads as more effortful
const CLIMB_SNAKE_RIPPLE = 0.3;
const CLIMB_SPINE_LEAN = -0.22; // pitched forward into the rock face, the way a real climber presses their torso to the surface

/** Real climbing pose, shared across every playable species — they all share the same joint names
 * via Rig's project-wide JointName union, so one function covers fox/bear/boar/lion/crocodile's
 * real quadruped reach and the legless viper's real concertina ripple. Applied as an overlay on
 * top of whatever idle/walk blend the caller already ran (same convention as the existing
 * hurt/blocking overlays every species already has) — without this, moveSpeed reads 0 the whole
 * climb (climbing moves position directly, never touches body.velocity), so a climbing character
 * would otherwise show a frozen idle pose while visibly ascending a cliff face. */
export function applyClimbPose(rig: Rig, time: number): void {
  if (rig.hasJoint('forepawL') && rig.hasJoint('hindpawR') && rig.hasJoint('forepawR') && rig.hasJoint('hindpawL')) {
    // Real diagonal quadruped climbing gait: front-left+hind-right reach together while
    // front-right+hind-left pull, then swap — the same diagonal pairing the walk clips use, just
    // a bigger, slower reach.
    const phase = Math.sin(time * CLIMB_REACH_SPEED) * CLIMB_LIMB_REACH;
    rig.setLocalRotation('forepawL', phase, 0, 0);
    rig.setLocalRotation('hindpawR', phase, 0, 0);
    rig.setLocalRotation('forepawR', -phase, 0, 0);
    rig.setLocalRotation('hindpawL', -phase, 0, 0);
  } else if (rig.hasJoint('tail0') && rig.hasJoint('tail1')) {
    // Legless (viper): a real snake climbs textured/vertical surfaces via concertina motion — an
    // S-curve ripple through the body, alternating segment to segment.
    const ripple = Math.sin(time * CLIMB_REACH_SPEED) * CLIMB_SNAKE_RIPPLE;
    rig.setLocalRotation('tail0', 0, ripple, 0);
    rig.setLocalRotation('tail1', 0, -ripple, 0);
    if (rig.hasJoint('tail2')) rig.setLocalRotation('tail2', 0, ripple, 0);
  }
  if (rig.hasJoint('spine')) rig.setLocalRotation('spine', CLIMB_SPINE_LEAN, 0, 0);
}
