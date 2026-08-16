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

  it('strikeRange gates the telegraph->attacking transition (regression: a telegraph completing while the player is still far away used to guarantee a whiff — now it holds in telegraph, still closing distance via chase, until actually in range)', () => {
    const ai = new EnemyAI();
    ai.strikeRange = 1;
    ai.update(3, 0.001); // enters telegraph at distance 3, outside strikeRange
    ai.update(3, TELEGRAPH_SECONDS + 0.01); // timer elapses, but still far away
    expect(ai.state).toBe('telegraph');
    expect(ai.shouldDealDamageThisFrame()).toBe(false);
    ai.update(0.5, 0.001); // now within strikeRange
    expect(ai.state).toBe('attacking');
    expect(ai.shouldDealDamageThisFrame()).toBe(true);
  });

  it('defaults strikeRange to Infinity so every enemy built before real chase movement existed is unaffected (byte-identical: a telegraph that finishes always fires regardless of distance)', () => {
    const ai = new EnemyAI();
    expect(ai.strikeRange).toBe(Infinity);
  });

  it('stun() freezes progression (a mid-telegraph enemy never reaches attacking while stunned)', () => {
    const ai = new EnemyAI();
    ai.update(1, 0.001); // enter telegraph
    ai.stun(1);
    expect(ai.isStunned()).toBe(true);
    ai.update(1, TELEGRAPH_SECONDS + 0.01); // would normally cross into 'attacking'
    expect(ai.state).toBe('idle');
    expect(ai.shouldDealDamageThisFrame()).toBe(false);
    ai.update(1, 1.01); // stun timer elapses
    expect(ai.isStunned()).toBe(false);
  });
});
