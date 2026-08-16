export interface LeaderboardEntry {
  name: string;
  distance: number;
  motes: number;
  score: number;
}

export interface SubmitResult {
  rank: number; // 1-indexed position in the full leaderboard
  top: LeaderboardEntry[];
}

/**
 * Decoupled from the game loop on purpose — the death screen talks to this
 * interface, never to a concrete backend. Swapping MockLeaderboardClient for
 * a real one (Cloudflare Workers KV, Supabase, etc.) is an isolated change.
 */
export interface LeaderboardClient {
  getTop(n: number): Promise<LeaderboardEntry[]>;
  submit(entry: LeaderboardEntry): Promise<SubmitResult>;
}
