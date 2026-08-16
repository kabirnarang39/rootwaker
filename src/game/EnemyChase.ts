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
