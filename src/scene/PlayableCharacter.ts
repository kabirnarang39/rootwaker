import * as THREE from 'three';
import type { Rig } from './rig/Rig';

/** The contract Game.ts drives its player model through, regardless of which species the player
 * chose at character select — createFox/createPlayableBear/createPlayableViper all satisfy this
 * identically, so Game.ts's per-frame `this.fox.*` calls never need to know which one is live. */
export interface PlayableCharacter {
  group: THREE.Group;
  rig: Rig;
  crownGroup: THREE.Group;
  // `blocking` defaults to false for every existing caller — a real braced/lowered pose overlaid
  // on top of the normal idle/walk blend (see Game.ts's real Block mechanic), not a separate clip.
  update(time: number, delta: number, moveSpeed: number, blocking?: boolean): void;
  revealCrown(): void;
}

export type SpeciesId = 'fox' | 'bear' | 'viper' | 'boar' | 'lion' | 'crocodile';
