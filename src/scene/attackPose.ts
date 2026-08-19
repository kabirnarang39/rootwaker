import type { Rig } from './rig/Rig';

// Real predator strikes drive the whole body's weight forward into the hit, not just a limb swing
// — the opposite direction from the hurt-recoil overlay every species already has (hurt pitches
// back/away; attacking commits forward/in). Bigger than the climbing reach (0.55) — a real
// committed strike is a more explosive, brief motion than a sustained scramble.
const ATTACK_SPINE_LUNGE = 0.34;
const ATTACK_HEAD_THRUST = 0.24;
const ATTACK_FOREPAW_STRIKE = 0.7;

/** Real attack-swing pose, shared across every playable species via Rig's project-wide joint
 * names (same approach as climbPose.ts). Previously, landing a hit — basic combo OR any special
 * ability — never touched the PLAYER's own rig at all: meleeSweep() only ever computed a hitbox
 * and applied damage to the TARGET, so the player's own body stayed on whatever idle/walk blend
 * it was already on. A real "fighting-game feel" needs the player's own strike to visibly read,
 * not just the target's flinch — this closes that gap. A single static overlay (not a
 * continuously-animated sweep, since the real attack window is brief — same fidelity level as the
 * existing hurt/block overlays, which are also static held poses, not authored clips). */
export function applyAttackPose(rig: Rig): void {
  if (rig.hasJoint('spine')) rig.setLocalRotation('spine', ATTACK_SPINE_LUNGE, 0, 0);
  if (rig.hasJoint('head')) rig.setLocalRotation('head', ATTACK_HEAD_THRUST, 0, 0);
  if (rig.hasJoint('forepawL') && rig.hasJoint('forepawR')) {
    rig.setLocalRotation('forepawL', -ATTACK_FOREPAW_STRIKE, 0, 0);
    rig.setLocalRotation('forepawR', -ATTACK_FOREPAW_STRIKE, 0, 0);
  }
}
