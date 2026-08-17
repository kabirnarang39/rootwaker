export type StoryBeatId = 'wraith' | 'boar' | 'bear' | 'owl' | 'viper' | 'lion' | 'king' | 'coronation';

export interface StoryBeat {
  eyebrow: string;
  text: string;
}

// Real short lore lines, one per real combat encounter, matching the project's own established
// mythic premise ("fox-spirit courier, forest where an old myth/god is waking" — the pivot design
// doc's own words) rather than generic flavor text. Each is deliberately terse — a whispered beat,
// not a paragraph — and each names the specific animal by its own real identity, not a placeholder.
export const STORY_BEATS: Record<StoryBeatId, StoryBeat> = {
  wraith: {
    eyebrow: 'The Hollow Remembers',
    text: 'The roots remember every trespasser. Something ancient stirs beneath the hollow.',
  },
  boar: {
    eyebrow: 'A Test, Not a Welcome',
    text: 'A tusk-boar breaks from the thicket — the jungle tests you before it trusts you.',
  },
  bear: {
    eyebrow: 'Old Strength',
    text: 'The Grove Bear rises. Its strength was old before the mountain had a name.',
  },
  owl: {
    eyebrow: 'A Chosen Moment',
    text: 'Wings fold against starlight. The Canopy Owl has already chosen its moment.',
  },
  viper: {
    eyebrow: 'Patient and Certain',
    text: 'Coiled and patient, the Vine Viper strikes only once it is certain.',
  },
  lion: {
    eyebrow: 'The Jungle\'s Own Crown',
    text: 'A roar splits the dark — the lion does not stalk to test you. It stalks to end things quickly.',
  },
  king: {
    eyebrow: 'The Crown Itself',
    text: 'Every guardian you have bested was one claw of the same old crown. Now you face the crown itself.',
  },
  coronation: {
    eyebrow: 'A New King',
    text: 'The mountain does not crown the strongest paw. It crowns the one still standing.',
  },
};

/** Tracks which story beats have already fired — each one is a real first-encounter/milestone
 * moment and must fire exactly once per playthrough, never repeat on every subsequent fight
 * against the same species (that would read as spam, not story). A plain Set rather than a
 * per-instance WeakMap (unlike the sound-trigger trackers in Game.ts) because this tracks
 * "has this species ever been encountered", not "what state is THIS specific creature in" —
 * a second boar encountering the player after the first boar's beat already fired must NOT
 * re-trigger the beat. */
export class StoryBeatTracker {
  private shown = new Set<StoryBeatId>();

  /** Returns the beat to show if `id` has never fired before, and marks it shown; returns null
   * (no side effect) if it has already fired. */
  consume(id: StoryBeatId): StoryBeat | null {
    if (this.shown.has(id)) return null;
    this.shown.add(id);
    return STORY_BEATS[id];
  }
}
