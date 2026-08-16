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
