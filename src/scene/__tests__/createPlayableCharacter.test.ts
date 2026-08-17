import { describe, it, expect } from 'vitest';
import { createPlayableCharacter, SPECIES_SKINS, SPECIES_LABELS } from '../createPlayableCharacter';
import type { SpeciesId } from '../PlayableCharacter';

const SPECIES: SpeciesId[] = ['fox', 'bear', 'viper'];

describe('createPlayableCharacter', () => {
  it('dispatches to the right builder per species and satisfies the shared PlayableCharacter contract', () => {
    for (const species of SPECIES) {
      const skinId = SPECIES_SKINS[species][0].id;
      const character = createPlayableCharacter(species, skinId);
      expect(character.group).toBeDefined();
      expect(character.rig).toBeDefined();
      expect(character.crownGroup).toBeDefined();
      expect(() => character.update(0, 1 / 60, 0)).not.toThrow();
    }
  });

  it('falls back to the first skin in the species pool for an unknown skinId', () => {
    const character = createPlayableCharacter('bear', 'not-a-real-skin-id');
    expect(character.group).toBeDefined();
  });

  it('every species has at least 2 real skin variants with unique ids', () => {
    for (const species of SPECIES) {
      const skins = SPECIES_SKINS[species];
      expect(skins.length).toBeGreaterThanOrEqual(2);
      expect(new Set(skins.map((s) => s.id)).size).toBe(skins.length);
    }
  });

  it('every species has a non-empty select-screen label and blurb', () => {
    for (const species of SPECIES) {
      expect(SPECIES_LABELS[species].name.length).toBeGreaterThan(0);
      expect(SPECIES_LABELS[species].blurb.length).toBeGreaterThan(0);
    }
  });
});
