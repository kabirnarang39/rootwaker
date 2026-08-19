import { describe, it, expect } from 'vitest';
import { SPECIES_COMBO_SCALE, scaleMoveForSpecies, scaleKnockbackForSpecies } from '../SpeciesCombatProfile';
import { CLAW_SWIPE } from '../Combat';
import type { SpeciesId } from '../../scene/PlayableCharacter';

const SPECIES: SpeciesId[] = ['fox', 'bear', 'viper', 'boar', 'lion', 'crocodile'];

describe('SpeciesCombatProfile', () => {
  it('every playable species has a real, defined scale', () => {
    for (const species of SPECIES) {
      expect(SPECIES_COMBO_SCALE[species]).toBeDefined();
    }
  });

  it('fox is the unscaled baseline — every existing single-hit-damage expectation stays byte-identical', () => {
    const move = scaleMoveForSpecies(CLAW_SWIPE, 'fox');
    expect(move.damage).toBe(CLAW_SWIPE.damage);
    expect(move.recoverySeconds).toBe(CLAW_SWIPE.recoverySeconds);
  });

  it('real ordering matches each species\' own wild-form bite force (lion > bear > crocodile > boar > viper)', () => {
    const damageOf = (species: SpeciesId) => scaleMoveForSpecies(CLAW_SWIPE, species).damage;
    expect(damageOf('lion')).toBeGreaterThan(damageOf('bear'));
    expect(damageOf('bear')).toBeGreaterThan(damageOf('crocodile'));
    expect(damageOf('crocodile')).toBeGreaterThan(damageOf('boar'));
    expect(damageOf('boar')).toBeGreaterThan(damageOf('viper'));
    expect(damageOf('viper')).toBeLessThan(damageOf('fox'));
  });

  it('windup stays untouched by species scaling — the telegraph read must never desync from AI balance', () => {
    for (const species of SPECIES) {
      expect(scaleMoveForSpecies(CLAW_SWIPE, species).windupSeconds).toBe(CLAW_SWIPE.windupSeconds);
    }
  });

  it('a heavier hitter also opens itself up longer — recovery scales independently of damage, real risk/reward', () => {
    expect(scaleMoveForSpecies(CLAW_SWIPE, 'crocodile').recoverySeconds).toBeGreaterThan(CLAW_SWIPE.recoverySeconds);
    expect(scaleMoveForSpecies(CLAW_SWIPE, 'viper').recoverySeconds).toBeLessThan(CLAW_SWIPE.recoverySeconds);
  });

  it('knockback scales with the same real per-species multiplier as damage — a heavier hit pushes harder', () => {
    expect(scaleKnockbackForSpecies(1, 'lion')).toBeCloseTo(SPECIES_COMBO_SCALE.lion.damage, 5);
    expect(scaleKnockbackForSpecies(1, 'fox')).toBe(1);
  });
});
