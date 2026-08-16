import { describe, it, expect } from 'vitest';
import { createMountainKing, getKingHitbox } from '../createMountainKing';

describe('createMountainKing', () => {
  it('starts at 220 HP, idle AI state, ground-slam idle', () => {
    const king = createMountainKing();
    expect(king.combatant.hp).toBe(220);
    expect(king.combatant.maxHp).toBe(220);
    expect(king.ai.state).toBe('idle');
    expect(king.groundSlam.state).toBe('idle');
  });

  it('arms the ground-slam only once HP drops to the enraged threshold and AI enters telegraph', () => {
    const king = createMountainKing();
    // still calm (full HP) but close enough to aggro
    king.update(0, 1 / 60, 1);
    expect(king.groundSlam.state).toBe('idle'); // calm phase never arms it, even mid-telegraph

    king.combatant.hp = 50; // drop below the 50% enrage threshold (50/220 ≈ 0.227)
    // re-enter telegraph fresh so the ai.state transition triggers arm()
    king.ai.state = 'idle';
    king.update(1, 1 / 60, 1); // idle -> telegraph this frame (aggro range default covers distance=1)
    expect(king.ai.state).toBe('telegraph');
    expect(king.groundSlam.state).toBe('telegraph'); // armed because phase is enraged
  });

  it('getKingHitbox tracks the spine joint\'s world position after update()', () => {
    const king = createMountainKing();
    king.group.position.set(5, 0, 5);
    king.update(0, 1 / 60, 10);
    const hitbox = getKingHitbox(king);
    expect(hitbox.start.x).toBeCloseTo(5, 1);
    expect(hitbox.start.z).toBeCloseTo(5, 1);
  });
});
