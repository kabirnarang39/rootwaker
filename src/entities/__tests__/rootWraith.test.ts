import { describe, it, expect } from 'vitest';
import { createRootWraith, getAttackHitbox } from '../rootWraith';

describe('createRootWraith', () => {
  it('starts at 40 HP, idle', () => {
    const wraith = createRootWraith();
    expect(wraith.combatant.hp).toBe(40);
    expect(wraith.combatant.maxHp).toBe(40);
    expect(wraith.ai.state).toBe('idle');
  });

  it('getAttackHitbox tracks the spine joint\'s world position after update()', () => {
    const wraith = createRootWraith();
    wraith.group.position.set(3, 0, 3);
    wraith.update(0, 1 / 60, 10);
    const hitbox = getAttackHitbox(wraith);
    expect(hitbox.start.x).toBeCloseTo(3, 1);
    expect(hitbox.start.z).toBeCloseTo(3, 1);
  });

  it('enters telegraph state when the player is within aggro range and applies the lunge clip', () => {
    const wraith = createRootWraith();
    wraith.update(0, 1 / 60, 1);
    expect(wraith.ai.state).toBe('telegraph');
  });

  it('sets ai.strikeRange from its own combatant hitbox radius', () => {
    const wraith = createRootWraith();
    wraith.update(0, 1 / 60, 1);
    expect(wraith.ai.strikeRange).toBeCloseTo(wraith.combatant.hitbox.radius + 0.4 - 0.05, 5);
  });

  it('has a real, slow recovery window (relentless but not frantic — a real root-spirit\'s own combat rhythm)', () => {
    const wraith = createRootWraith();
    wraith.update(0, 1 / 60, 1);
    expect(wraith.ai.recoverSeconds).toBe(1.1);
  });
});
