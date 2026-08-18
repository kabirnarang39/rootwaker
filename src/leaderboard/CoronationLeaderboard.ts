import type { SpeciesId } from '../scene/PlayableCharacter';

export interface CoronationEntry {
  species: SpeciesId;
  coronationSeconds: number; // real "how fast did you become King" metric — lower is better
  animalsDefeated: number; // secondary stat, shown alongside but not ranked on
}

export interface CoronationSubmitResult {
  rank: number; // 1-indexed position in the full saved leaderboard
  top: CoronationEntry[];
}

/** Decoupled from the game loop on purpose — Game.ts talks to this interface, never to a
 * concrete storage backend. The real implementation is
 * multiplayer/DistributedLeaderboard.ts's DistributedCoronationLeaderboardClient (a gossip-synced
 * CRDT); this interface stays here since it's the shared contract, not tied to any one backend. */
export interface CoronationLeaderboardClient {
  getTop(n: number): Promise<CoronationEntry[]>;
  submit(entry: CoronationEntry): Promise<CoronationSubmitResult>;
}
