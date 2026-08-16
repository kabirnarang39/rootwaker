const VELOCITY_THRESHOLD = 0.05; // m/s below this, treat as stationary, no facing update (avoids jitter)
const DEFAULT_TURN_SPEED = 10; // radians/sec-equivalent lerp rate — fast enough to feel responsive, not instant

function shortestAngleDelta(from: number, to: number): number {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

/**
 * Smoothly turns a facing angle toward the direction of horizontal velocity,
 * always taking the shortest rotational path (never spinning the long way
 * around through a 359-degree turn for a small direction change).
 */
export function computeFacingAngle(
  velocityX: number,
  velocityZ: number,
  currentAngle: number,
  delta: number,
  turnSpeed: number = DEFAULT_TURN_SPEED,
): number {
  const speed = Math.hypot(velocityX, velocityZ);
  if (speed < VELOCITY_THRESHOLD) return currentAngle;

  const targetAngle = Math.atan2(velocityX, velocityZ);
  const angleDelta = shortestAngleDelta(currentAngle, targetAngle);
  const t = Math.min(1, turnSpeed * delta);
  return currentAngle + angleDelta * t;
}
