import { describe, it, expect } from 'vitest';
import { EnemyAI } from '../EnemyAI';

const AGGRO_RANGE = 4;
const TELEGRAPH_SECONDS = 0.6;
const ATTACK_SECONDS = 0.3;
const RECOVER_SECONDS = 0.8;

describe('EnemyAI', () => {
  it('starts idle and stays idle while the player is out of aggro range', () => {
    const ai = new EnemyAI();
    ai.update(AGGRO_RANGE + 1, 1);
    expect(ai.state).toBe('idle');
  });

  it('enters aggro then telegraph once the player is in range', () => {
    const ai = new EnemyAI();
    ai.update(AGGRO_RANGE - 1, 0.016);
    expect(['aggro', 'telegraph']).toContain(ai.state);
  });

  it('progresses telegraph -> attacking -> recovering -> idle on its own timers', () => {
    const ai = new EnemyAI();
    ai.update(1, 0.001); // enter aggro/telegraph
    ai.update(1, TELEGRAPH_SECONDS + 0.01);
    expect(ai.state).toBe('attacking');
    ai.update(1, ATTACK_SECONDS + 0.01);
    expect(ai.state).toBe('recovering');
    ai.update(AGGRO_RANGE + 1, RECOVER_SECONDS + 0.01);
    expect(ai.state).toBe('idle');
  });

  it('exposes whether an attack should register damage this frame', () => {
    const ai = new EnemyAI();
    ai.update(1, 0.001);
    ai.update(1, TELEGRAPH_SECONDS + 0.01);
    expect(ai.shouldDealDamageThisFrame()).toBe(true);
    ai.update(1, 0.001);
    expect(ai.shouldDealDamageThisFrame()).toBe(false);
  });
});
