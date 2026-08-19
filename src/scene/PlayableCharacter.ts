import * as THREE from 'three';
import type { Rig } from './rig/Rig';

/** The contract Game.ts drives its player model through, regardless of which species the player
 * chose at character select — createFox/createPlayableBear/createPlayableViper all satisfy this
 * identically, so Game.ts's per-frame `this.fox.*` calls never need to know which one is live. */
export interface PlayableCharacter {
  group: THREE.Group;
  rig: Rig;
  crownGroup: THREE.Group;
  // `blocking`/`hurt`/`climbing`/`attacking` all default to false for every existing caller —
  // real pose overlays on top of the normal idle/walk blend (see Game.ts's Block mechanic,
  // HIT_STAGGER_SECONDS, climbPose.ts, and attackPose.ts), none a separate authored clip. Applied
  // in this fixed order — blocking, then hurt (wins over a held brace), then climbing, then
  // attacking last (a real swing still reads even mid-flinch) — every species follows it.
  update(
    time: number,
    delta: number,
    moveSpeed: number,
    blocking?: boolean,
    hurt?: boolean,
    climbing?: boolean,
    attacking?: boolean,
  ): void;
  revealCrown(): void;
}

export type SpeciesId = 'fox' | 'bear' | 'viper' | 'boar' | 'lion' | 'crocodile';
