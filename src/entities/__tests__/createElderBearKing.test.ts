import { describe, it, expect } from 'vitest';
import { createElderBearKing, getElderBearKingHitbox } from '../createElderBearKing';

describe('createElderBearKing', () => {
  it('starts at 220 HP (matching the old humanoid King exactly), idle, ground-slam idle', () => {
    const king = createElderBearKing();
    expect(king.combatant.hp).toBe(220);
    expect(king.combatant.maxHp).toBe(220);
    expect(king.ai.state).toBe('idle');
    expect(king.groundSlam.state).toBe('idle');
  });

  it('the enraged phase (<=50% HP) genuinely shortens the AI telegraph window (regression: this exact mechanic was dead once before in the humanoid King, fixed in the throne-room chapter\'s final review — must not regress in the redesign)', () => {
    const king = createElderBearKing();
    king.update(0, 1 / 60, 1);
    const calmTelegraph = king.ai.telegraphSeconds;

    king.combatant.hp = 50; // below the 50% enrage threshold of 220
    king.ai.state = 'idle';
    king.update(1, 1 / 60, 1);
    const enragedTelegraph = king.ai.telegraphSeconds;

    expect(enragedTelegraph).toBeLessThan(calmTelegraph);
  });

  it('arms the ground-slam only in the enraged phase', () => {
    const king = createElderBearKing();
    king.update(0, 1 / 60, 1); // calm phase
    expect(king.groundSlam.state).toBe('idle');

    king.combatant.hp = 50;
    king.ai.state = 'idle';
    king.update(1, 1 / 60, 1); // enraged phase, entering telegraph
    expect(king.groundSlam.state).toBe('telegraph');
  });

  it('sets ai.strikeRange from its own combatant hitbox radius, alongside telegraphSeconds, before ai.update() runs', () => {
    const king = createElderBearKing();
    king.update(0, 1 / 60, 1);
    expect(king.ai.strikeRange).toBeCloseTo(king.combatant.hitbox.radius + 0.4 - 0.05, 5);
  });

  it('a stunned King does not let an already-armed ground slam keep advancing (regression: King\'s Roar used to stagger the AI state machine but the ground-slam hazard kept ticking toward its damaging window regardless)', () => {
    const king = createElderBearKing();
    king.combatant.hp = 50; // enraged phase, ground-slam-armable
    king.ai.state = 'idle';
    king.update(1, 1 / 60, 1); // enters telegraph, arms the ground slam
    expect(king.groundSlam.state).toBe('telegraph');

    king.ai.stun(2.5); // King's Roar
    const stateAtStunStart = king.groundSlam.state;
    for (let i = 0; i < 60; i++) king.update(2 + i * 0.05, 0.05, 1); // 3s of real time, well past the slam's own telegraph window
    expect(king.groundSlam.state).toBe(stateAtStunStart); // frozen, not advanced to 'active' or 'idle'
  });

  it('getElderBearKingHitbox tracks the spine joint\'s world position after update()', () => {
    const king = createElderBearKing();
    king.group.position.set(5, 0, 5);
    king.update(0, 1 / 60, 10);
    const hitbox = getElderBearKingHitbox(king);
    expect(hitbox.start.x).toBeCloseTo(5, 1);
    expect(hitbox.start.z).toBeCloseTo(5, 1);
  });
});
