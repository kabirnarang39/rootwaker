import * as THREE from 'three';
import type { Rig } from './rig/Rig';

/** The contract Game.ts drives its player model through, regardless of which species the player
 * chose at character select — createFox/createPlayableBear/createPlayableViper all satisfy this
 * identically, so Game.ts's per-frame `this.fox.*` calls never need to know which one is live. */
export interface PlayableCharacter {
  group: THREE.Group;
  rig: Rig;
  crownGroup: THREE.Group;
  // `blocking`/`hurt` both default to false for every existing caller — real pose overlays on
  // top of the normal idle/walk blend (see Game.ts's Block mechanic and HIT_STAGGER_SECONDS),
  // neither a separate authored clip. `hurt` wins over `blocking` when both are true (a real
  // flinch always overrides a held brace visually) — every species applies hurt AFTER blocking
  // for exactly this reason.
  update(time: number, delta: number, moveSpeed: number, blocking?: boolean, hurt?: boolean): void;
  revealCrown(): void;
}

export type SpeciesId = 'fox' | 'bear' | 'viper' | 'boar' | 'lion' | 'crocodile';
