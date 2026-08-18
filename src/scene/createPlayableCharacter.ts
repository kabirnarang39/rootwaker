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

// These describe real identity/temperament, not mechanical stats — every playable species
// currently shares the exact same move speed and attack damage (PlayerController.ts/Combat.ts
// never branch on species). A real per-species stat split (fox=fastest, bear=hardest-hitting,
// viper=fast-but-fragile) is a genuine future feature, but a risky one: this project's own enemy
// AI chase speeds are deliberately hand-tuned against a single fixed player speed of 4.5 m/s (see
// the WRAITH_CHASE_SPEED/BOAR_CHARGE_SPEED cluster in Game.ts) — making player speed
// species-dependent would need every one of those balance comments re-verified, not just this
// screen's copy. The blurbs below were previously making that exact false claim ("the fastest
// sprint", "hits hardest") with nothing behind it — fixed to describe real character instead.
export const SPECIES_LABELS: Record<SpeciesId, { name: string; blurb: string }> = {
  fox: { name: 'Fox', blurb: 'Quick, light-footed, and always alert — a real forest courier.' },
  bear: { name: 'Bear', blurb: 'Heavy and imposing — a real predator\'s presence in the jungle.' },
  viper: { name: 'Viper', blurb: 'Low, patient, and silent — built to vanish into the undergrowth.' },
};
