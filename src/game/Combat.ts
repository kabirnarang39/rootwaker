import { capsuleVsCapsule, type Capsule } from './collision';

export interface Combatant {
  hp: number;
  maxHp: number;
  hitbox: Capsule;
}

export function applyDamage(target: Combatant, amount: number): void {
  target.hp = Math.max(0, target.hp - amount);
}

export function isDefeated(c: Combatant): boolean {
  return c.hp <= 0;
}

export function resolveMeleeHit(attackerHitbox: Capsule, target: Combatant): boolean {
  return capsuleVsCapsule(attackerHitbox, target.hitbox).hit;
}

export interface Move {
  name: string;
  damage: number;
  windupSeconds: number; // telegraph time before the hit registers
  recoverySeconds: number; // locked-out time after the hit before another move can start
}

export const CLAW_SWIPE: Move = { name: 'claw-swipe', damage: 8, windupSeconds: 0.15, recoverySeconds: 0.25 };
export const SPIRIT_BITE: Move = { name: 'spirit-bite', damage: 18, windupSeconds: 0.4, recoverySeconds: 0.5 };

// A real 3-hit combo chain, not one repeated move — each stage costs more recovery than the last
// (real risk: committing to the finisher leaves a longer opening), and damage/knockback escalate
// to make chaining through all 3 worth the exposure. COMBO_MOVES[0] === CLAW_SWIPE exactly (same
// object) so every existing single-player behavior that only ever knew about CLAW_SWIPE — its own
// recovery gate, its own damage — stays byte-identical for a player who only ever taps once.
export const COMBO_STRIKE_2: Move = { name: 'combo-strike-2', damage: 10, windupSeconds: 0.15, recoverySeconds: 0.3 };
export const COMBO_FINISHER: Move = { name: 'combo-finisher', damage: 20, windupSeconds: 0.2, recoverySeconds: 0.55 };
export const COMBO_MOVES: readonly Move[] = [CLAW_SWIPE, COMBO_STRIKE_2, COMBO_FINISHER];
// A press this long after the last combo hit resets the chain back to stage 0 — real combat
// rhythm, not an unlimited-window combo you can casually meander through.
export const COMBO_WINDOW_SECONDS = 0.9;
// Real knockback escalation matching COMBO_MOVES' own damage/recovery escalation — shared by
// every real combo consumer (the single-player player attack AND the P2P duel) so the two never
// silently drift apart into two different combat feels.
export const COMBO_KNOCKBACK: readonly number[] = [0.3, 0.45, 0.9];
