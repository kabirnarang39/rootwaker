import { describe, it, expect } from 'vitest';
import { createTuskBoar, getBoarHitbox } from '../tuskBoar';

describe('createTuskBoar', () => {
  it('starts at 55 HP, idle', () => {
    const boar = createTuskBoar();
    expect(boar.combatant.hp).toBe(55);
    expect(boar.combatant.maxHp).toBe(55);
    expect(boar.ai.state).toBe('idle');
  });

  it('getBoarHitbox tracks the spine joint\'s world position after update()', () => {
    const boar = createTuskBoar();
    boar.group.position.set(3, 0, 3);
    boar.update(0, 1 / 60, 10);
    const hitbox = getBoarHitbox(boar);
    expect(hitbox.start.x).toBeCloseTo(3, 1);
    expect(hitbox.start.z).toBeCloseTo(3, 1);
  });

  it('enters telegraph state when the player is within aggro range and applies the charge clip', () => {
    const boar = createTuskBoar();
    boar.update(0, 1 / 60, 1);
    expect(boar.ai.state).toBe('telegraph');
  });

  it('sets ai.strikeRange from its own combatant hitbox radius', () => {
    const boar = createTuskBoar();
    boar.update(0, 1 / 60, 1);
    expect(boar.ai.strikeRange).toBeCloseTo(boar.combatant.hitbox.radius + 0.4 - 0.05, 5);
  });

  it('has a real, fast recovery window after charging (a boar can commit to another charge quickly — aggressive, not deliberate)', () => {
    const boar = createTuskBoar();
    boar.update(0, 1 / 60, 1);
    expect(boar.ai.recoverSeconds).toBe(0.5);
  });
});
