import * as THREE from 'three';
import type { Rig } from './rig/Rig';

/** The contract Game.ts drives its player model through, regardless of which species the player
 * chose at character select — createFox/createPlayableBear/createPlayableViper all satisfy this
 * identically, so Game.ts's per-frame `this.fox.*` calls never need to know which one is live. */
export interface PlayableCharacter {
  group: THREE.Group;
  rig: Rig;
  crownGroup: THREE.Group;
  // `blocking`/`hurt`/`climbing`/`attacking`/`flying` all default to false for every existing
  // caller — real pose overlays on top of the normal idle/walk blend (see Game.ts's Block
  // mechanic, HIT_STAGGER_SECONDS, climbPose.ts, and attackPose.ts), none a separate authored
  // clip. Applied in this fixed order — blocking, then hurt (wins over a held brace), then
  // climbing, then attacking (a real swing still reads even mid-flinch), then flying last —
  // every species follows it. `flying` is only ever true for the owl (the only species with real
  // flight locomotion — see PlayerController's beginFly/updateFly); every other species simply
  // never receives it as true, so this stays byte-identical for them.
  update(
    time: number,
    delta: number,
    moveSpeed: number,
    blocking?: boolean,
    hurt?: boolean,
    climbing?: boolean,
    attacking?: boolean,
    flying?: boolean,
  ): void;
  revealCrown(): void;
}

export type SpeciesId = 'fox' | 'bear' | 'viper' | 'boar' | 'lion' | 'crocodile' | 'owl';
