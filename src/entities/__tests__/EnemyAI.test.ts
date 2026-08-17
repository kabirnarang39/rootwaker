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

  it('strikeRange gates the telegraph->attacking transition (a telegraph completing while the player is still far away used to guarantee a whiff — now it holds in telegraph, still closing distance via chase, until actually in range)', () => {
    const ai = new EnemyAI();
    ai.strikeRange = 1;
    ai.update(3, 0.001); // enters telegraph at distance 3, outside strikeRange
    ai.update(3, TELEGRAPH_SECONDS + 0.01); // timer elapses, but still far away
    expect(ai.state).toBe('telegraph');
    expect(ai.shouldDealDamageThisFrame()).toBe(false);
    ai.update(0.5, 0.001); // now within strikeRange, but the wind-up clock hasn't started counting yet
    expect(ai.state).toBe('telegraph');
    expect(ai.shouldDealDamageThisFrame()).toBe(false);
    ai.update(0.5, TELEGRAPH_SECONDS + 0.01); // a full fresh telegraphSeconds elapses while in range
    expect(ai.state).toBe('attacking');
    expect(ai.shouldDealDamageThisFrame()).toBe(true);
  });

  it("telegraph's wind-up clock does not advance while the enemy is still out of strikeRange (regression: it used to advance unconditionally, so an enemy that spent its whole telegraphSeconds closing distance would strike the INSTANT it arrived in range, with zero real warning — the entire point of a telegraph); once in range, a full fresh window is required no matter how long it spent approaching", () => {
    const ai = new EnemyAI();
    ai.strikeRange = 1;
    ai.update(3, 0.001); // enters telegraph, far outside strikeRange

    // Spend far longer than telegraphSeconds still approaching (never gets within strikeRange) —
    // the old bug would have this "banking" wind-up time that fires instantly on arrival.
    for (let i = 0; i < 50; i++) ai.update(3, TELEGRAPH_SECONDS / 10);
    expect(ai.state).toBe('telegraph');

    ai.update(0.5, 0.001); // arrives in range on this exact frame
    expect(ai.state).toBe('telegraph'); // must NOT fire instantly
    expect(ai.shouldDealDamageThisFrame()).toBe(false);

    // A fresh telegraphSeconds window, measured from the moment it actually came into range.
    ai.update(0.5, TELEGRAPH_SECONDS - 0.01);
    expect(ai.state).toBe('telegraph'); // not quite yet
    ai.update(0.5, 0.02);
    expect(ai.state).toBe('attacking'); // now it fires, with a real warning window having elapsed
  });

  it('an enemy that stays within strikeRange the whole time is unaffected (its telegraph clock always advanced, before and after this fix)', () => {
    const ai = new EnemyAI();
    ai.strikeRange = 10;
    ai.update(1, 0.001);
    ai.update(1, TELEGRAPH_SECONDS + 0.01);
    expect(ai.state).toBe('attacking');
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
