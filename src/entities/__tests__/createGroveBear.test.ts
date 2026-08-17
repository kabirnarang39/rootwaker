import { describe, it, expect } from 'vitest';
import { createGroveBear, getGroveBearHitbox } from '../createGroveBear';

describe('createGroveBear', () => {
  it('starts at 65 HP (matching the old mountainGuard exactly — visual redesign, not a difficulty change)', () => {
    const bear = createGroveBear();
    expect(bear.combatant.hp).toBe(65);
    expect(bear.combatant.maxHp).toBe(65);
    expect(bear.ai.state).toBe('idle');
  });

  it('getGroveBearHitbox tracks the spine joint\'s world position after update()', () => {
    const bear = createGroveBear();
    bear.group.position.set(3, 0, 3);
    bear.update(0, 1 / 60, 10);
    const hitbox = getGroveBearHitbox(bear);
    expect(hitbox.start.x).toBeCloseTo(3, 1);
    expect(hitbox.start.z).toBeCloseTo(3, 1);
  });

  it('enters telegraph state when the player is within aggro range and applies the claw-swipe clip', () => {
    const bear = createGroveBear();
    bear.update(0, 1 / 60, 1); // within EnemyAI's default aggro range
    expect(bear.ai.state).toBe('telegraph');
  });

  it('sets ai.strikeRange from its own combatant hitbox radius (real pursuit: a telegraph completing while still far away must not guarantee a hit)', () => {
    const bear = createGroveBear();
    bear.update(0, 1 / 60, 1);
    expect(bear.ai.strikeRange).toBeCloseTo(bear.combatant.hitbox.radius + 0.4 - 0.05, 5);
  });

  it('has a real, heavy recovery window after attacking (a bear cannot spam swipes the way a boar charges again)', () => {
    const bear = createGroveBear();
    bear.update(0, 1 / 60, 1);
    expect(bear.ai.recoverSeconds).toBe(1.3);
  });
});
