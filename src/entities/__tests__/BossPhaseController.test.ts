import { describe, it, expect } from 'vitest';
import { computeBossPhase, BOSS_PHASE_PARAMS } from '../BossPhaseController';

describe('BossPhaseController', () => {
  it('is calm above 50% HP', () => {
    expect(computeBossPhase(220, 220)).toBe('calm');
    expect(computeBossPhase(111, 220)).toBe('calm'); // just above half
  });

  it('is enraged at or below 50% HP', () => {
    expect(computeBossPhase(110, 220)).toBe('enraged'); // exactly half
    expect(computeBossPhase(1, 220)).toBe('enraged');
    expect(computeBossPhase(0, 220)).toBe('enraged');
  });

  it('enraged phase has a shorter telegraph than calm (real difficulty escalation, not just a stat bump)', () => {
    expect(BOSS_PHASE_PARAMS.enraged.telegraphSeconds).toBeLessThan(BOSS_PHASE_PARAMS.calm.telegraphSeconds);
  });

  it('enraged phase deals more damage per hit than calm', () => {
    expect(BOSS_PHASE_PARAMS.enraged.damage).toBeGreaterThan(BOSS_PHASE_PARAMS.calm.damage);
  });

  it('only enraged phase arms the ground-slam hazard', () => {
    expect(BOSS_PHASE_PARAMS.calm.groundSlamArmed).toBe(false);
    expect(BOSS_PHASE_PARAMS.enraged.groundSlamArmed).toBe(true);
  });

  it('enraged phase recovers faster than calm (a real boss should feel more relentless once enraged, not just hit harder)', () => {
    expect(BOSS_PHASE_PARAMS.enraged.recoverSeconds).toBeLessThan(BOSS_PHASE_PARAMS.calm.recoverSeconds);
  });
});
