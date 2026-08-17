import { createFox } from './createFox';
import { createPlayableBear } from './createPlayableBear';
import { createPlayableViper } from './createPlayableViper';
import { SKINS, BEAR_SKINS, VIPER_SKINS, skinById, type CharacterSkin } from './skins';
import type { PlayableCharacter, SpeciesId } from './PlayableCharacter';

function skinFor(species: SpeciesId, skinId: string): CharacterSkin {
  const pool = species === 'bear' ? BEAR_SKINS : species === 'viper' ? VIPER_SKINS : SKINS;
  return pool.find((s) => s.id === skinId) ?? pool[0];
}

/** Single dispatch point Game.ts and CharacterSelect.ts both use, so neither needs its own
 * species switch. skinById exists only for the fox's legacy default path — every other species
 * resolves through skinFor above. */
export function createPlayableCharacter(species: SpeciesId, skinId: string): PlayableCharacter {
  switch (species) {
    case 'bear':
      return createPlayableBear(skinFor('bear', skinId));
    case 'viper':
      return createPlayableViper(skinFor('viper', skinId));
    case 'fox':
    default:
      return createFox(skinById(skinId));
  }
}

export const SPECIES_SKINS: Record<SpeciesId, CharacterSkin[]> = {
  fox: SKINS,
  bear: BEAR_SKINS,
  viper: VIPER_SKINS,
};

export const SPECIES_LABELS: Record<SpeciesId, { name: string; blurb: string }> = {
  fox: { name: 'Fox', blurb: 'Quick and light-footed — the fastest sprint, the tightest turns.' },
  bear: { name: 'Bear', blurb: 'Slow, heavy, and hits hardest — a real pacing lumber, not a trot.' },
  viper: { name: 'Viper', blurb: 'Low and fast across open ground — a real travelling-wave slither.' },
};
