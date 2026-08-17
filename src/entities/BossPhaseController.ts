export type BossPhase = 'calm' | 'enraged';

const ENRAGE_THRESHOLD = 0.5; // HP fraction at/below which the King enters phase 2

export const BOSS_PHASE_PARAMS: Record<
  BossPhase,
  { telegraphSeconds: number; damage: number; groundSlamArmed: boolean; recoverSeconds: number }
> = {
  calm: { telegraphSeconds: 0.6, damage: 12, groundSlamArmed: false, recoverSeconds: 0.8 }, // matches mountainGuard's existing telegraph/GUARD_HIT_DAMAGE — familiar to players who've beaten guards; recoverSeconds matches EnemyAI's own old module-constant default
  enraged: { telegraphSeconds: 0.35, damage: 18, groundSlamArmed: true, recoverSeconds: 0.45 }, // shorter window = real escalation; damage reuses Combat.ts's existing SPIRIT_BITE.damage value; recovery also shortens — a real boss should feel MORE relentless once enraged, not just hit harder
};

/** Pure function of current HP fraction — no internal state, so the king can call this fresh every frame. */
export function computeBossPhase(hp: number, maxHp: number): BossPhase {
  return hp / maxHp <= ENRAGE_THRESHOLD ? 'enraged' : 'calm';
}
