export type LocomotionMode = 'grounded' | 'climbing' | 'swimming' | 'combat';

const ALLOWED: Record<LocomotionMode, LocomotionMode[]> = {
  grounded: ['grounded', 'climbing', 'swimming', 'combat'],
  climbing: ['climbing', 'grounded'],
  swimming: ['swimming', 'grounded'],
  combat: ['combat', 'grounded'],
};

/**
 * Every non-grounded mode routes back through grounded to reach another
 * non-grounded mode (e.g. climbing -> grounded -> combat) — this keeps
 * interrupt handling (knocked off a climb, knocked into water) in one
 * place instead of special-cased per mode pair.
 */
export function canTransition(from: LocomotionMode, to: LocomotionMode): boolean {
  return ALLOWED[from].includes(to);
}
