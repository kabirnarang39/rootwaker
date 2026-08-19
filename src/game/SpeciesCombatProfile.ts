import type { SpeciesId } from '../scene/PlayableCharacter';
import type { Move } from './Combat';

export interface SpeciesComboScale {
  damage: number;
  recovery: number;
}

// Real per-species combat identity for the player's OWN basic combo — previously every species
// shared byte-identical CLAW_SWIPE/COMBO_MOVES numbers (see createPlayableCharacter.ts's own
// comment on why player MOVE SPEED stays species-uniform: enemy AI chase speeds are hand-tuned
// against one fixed value, and touching that is real risk). Damage/recovery carry no such risk —
// nothing else in the game reads them — so they're free to reflect real identity. Ordered exactly
// like CharacterSelect.ts's own WILD_FIELD_NOTES real wild-form bite damage (lion 18 > bear 16 >
// crocodile 15 > boar 14 > viper 9), compressed into a playable range rather than applied as a
// literal ratio — a literal 2x on lion would trivialize early fights.
export const SPECIES_COMBO_SCALE: Record<SpeciesId, SpeciesComboScale> = {
  fox: { damage: 1, recovery: 1 }, // baseline courier, not a predator
  viper: { damage: 0.85, recovery: 0.8 }, // light and fast — real strike force is low, speed is the weapon
  boar: { damage: 1.15, recovery: 0.9 }, // aggressive tempo, matches its own fastest AI recovery in the game
  crocodile: { damage: 1.3, recovery: 1.3 }, // a real committed ambush bite, slow to reset — matches its own slowest AI recovery
  bear: { damage: 1.35, recovery: 1.2 }, // heavy blunt force, a real committed swipe
  // 1.5, not 1.4: at CLAW_SWIPE's base damage (8), 1.4 and bear's 1.35 both round to 11 — real
  // per-species distinction has to survive Math.round() at every tier, not just the biggest hit.
  lion: { damage: 1.5, recovery: 1.15 }, // apex predator, hits hardest, explosive follow-through
  // Real wild-form bite damage (10) sits almost exactly between viper's (9) and boar's (14) — an
  // honest reflection of that closeness, not a fabricated distinction: owl shares viper's own
  // light-hitter damage tier. What's genuinely distinct is tempo — a real owl strikes fast and
  // resets faster than anything else in the roster (silent, repeated hunting passes), the fastest
  // recovery multiplier in the game.
  owl: { damage: 0.85, recovery: 0.75 },
};

/** Applies `species`'s own real combat identity to a shared COMBO_MOVES entry. Windup stays
 * untouched — species-uniform, so the animation-driven telegraph read never desyncs from the
 * enemy AI balance already hand-tuned against a fixed player move speed elsewhere in this
 * project. Only damage and recovery scale. */
export function scaleMoveForSpecies(move: Move, species: SpeciesId): Move {
  const scale = SPECIES_COMBO_SCALE[species];
  return {
    ...move,
    damage: Math.round(move.damage * scale.damage),
    recoverySeconds: Number((move.recoverySeconds * scale.recovery).toFixed(3)),
  };
}

/** Real knockback scaling, reusing the same damage multiplier — a heavier hit should physically
 * push harder, no separate tunable needed. */
export function scaleKnockbackForSpecies(knockback: number, species: SpeciesId): number {
  return knockback * SPECIES_COMBO_SCALE[species].damage;
}
