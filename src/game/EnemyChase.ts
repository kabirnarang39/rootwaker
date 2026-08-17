import * as THREE from 'three';

// Mirrors Game.ts's playerCombatant.hitbox radius — keep in sync by hand (same convention as
// this file's other cross-file constants, e.g. Game.ts's own HUNT_PROMPT_RANGE comment).
const PLAYER_HITBOX_RADIUS = 0.4;
const STRIKE_RANGE_MARGIN = 0.05; // guarantees real capsule overlap, not just a boundary touch

/**
 * How close an enemy with combatant hitbox radius `enemyRadius` must be to the player before a
 * completed telegraph is allowed to launch its attack (EnemyAI.strikeRange) — the same distance
 * chaseTowardPlayer should close to beforehand, so the two never disagree about "in range."
 */
export function computeStrikeRange(enemyRadius: number): number {
  return enemyRadius + PLAYER_HITBOX_RADIUS - STRIKE_RANGE_MARGIN;
}

/** Horizontal-only distance between two world positions, ignoring Y — the distance every
 * ground-melee enemy's AI gate (aggro range, EnemyAI.strikeRange) must be measured against,
 * matching what chaseTowardPlayer itself already closes (this file is horizontal-only by
 * design, see above).
 *
 * Load-bearing, found live during Task 6's own driven-gameplay verification, not written into
 * the plan up front: a ground enemy is re-snapped to ITS OWN groundHeightAt(x,z) every frame,
 * and the player sits at roughly-but-not-exactly the same height at a different (x,z) — on
 * rolling terrain that residual vertical gap is easily several centimeters, comparable to or
 * larger than computeStrikeRange's whole margin. A viper (radius 0.22, the tightest margin in
 * the game) reproducibly closed to horizontal 0.57m — exactly its own strikeRange, i.e.
 * chaseTowardPlayer's stop condition was satisfied — while the 3D distance (`.distanceTo()`,
 * what every species used before this fix) sat at 0.572m: permanently ~0.002m outside its own
 * strikeRange gate. It telegraphed forever and never struck. Real melee-range hit detection is
 * unaffected (resolveMeleeHit's own capsule-vs-capsule check stays full 3D) — only the AI's
 * "close enough to swing" gate uses this, the same horizontal metric the chase itself targets. */
export function horizontalDistance(a: THREE.Vector3, b: THREE.Vector3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/**
 * Moves `position` a step toward `targetPos` (horizontal only — Y is the caller's job via
 * ground-height re-snapping) at `speed` m/s, without overshooting past `stopDistance` from the
 * target. This is what turns an aggroed enemy from a stationary turret (telegraph/attack only
 * triggers real damage if the player already happens to be standing on top of it) into a real
 * pursuer that closes real ground before it swings — the same pattern already used for
 * grove-hare fleeing (Game.ts moves hare.position directly based on hare.ai.state, outside the
 * entity's own update()).
 *
 * Always closes to `stopDistance`, never exactly to 0 — leaves the two bodies overlapping by the
 * combined-hitbox margin the caller chose `stopDistance` for, so a completed telegraph reliably
 * lands a hit via the existing body-capsule overlap check instead of swinging at empty air.
 */
export function chaseTowardPlayer(
  position: THREE.Vector3,
  targetPos: THREE.Vector3,
  speed: number,
  delta: number,
  stopDistance: number,
): void {
  const dx = targetPos.x - position.x;
  const dz = targetPos.z - position.z;
  const distance = Math.hypot(dx, dz);
  const gap = distance - stopDistance;
  if (gap <= 0) return;

  const step = Math.min(speed * delta, gap);
  const dirX = dx / distance;
  const dirZ = dz / distance;
  position.x += dirX * step;
  position.z += dirZ * step;
}
