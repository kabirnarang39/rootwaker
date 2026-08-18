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

/** Decoupled from the game loop on purpose, same reasoning as the project's original (dead)
 * LeaderboardClient.ts — Game.ts talks to this interface, never to a concrete storage backend. */
export interface CoronationLeaderboardClient {
  getTop(n: number): Promise<CoronationEntry[]>;
  submit(entry: CoronationEntry): Promise<CoronationSubmitResult>;
}

const STORAGE_KEY = 'rootwaker.coronation-leaderboard.v1';
const MAX_ENTRIES = 50;

// Real seed entries so the leaderboard reads as populated on a fresh install, same flavor-entry
// idea the original (dead) MockLeaderboardClient used — every real coronation naturally displaces
// these over time as MAX_ENTRIES caps the list.
const SEED_ENTRIES: CoronationEntry[] = [
  { species: 'fox', coronationSeconds: 612, animalsDefeated: 9 },
  { species: 'bear', coronationSeconds: 745, animalsDefeated: 11 },
  { species: 'viper', coronationSeconds: 583, animalsDefeated: 8 },
  { species: 'fox', coronationSeconds: 901, animalsDefeated: 14 },
  { species: 'bear', coronationSeconds: 528, animalsDefeated: 7 },
];

function load(): CoronationEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...SEED_ENTRIES];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...SEED_ENTRIES];
    return parsed;
  } catch {
    return [...SEED_ENTRIES];
  }
}

function save(entries: CoronationEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // storage unavailable (private browsing, quota) — leaderboard just won't persist
  }
}

/** localStorage-backed, explicitly LOCAL ONLY — every player sees only their own browser's runs
 * plus the seeded flavor entries, same honest framing as the project's original (dead)
 * MockLeaderboardClient. This is NOT the "challenge another live player" multiplayer ask (still
 * deliberately deferred — see project memory); it's a real personal-bests tracker. Ranked ascending
 * by coronationSeconds (fastest real playthrough wins), ties broken by fewer animalsDefeated (a
 * faster AND more efficient run outranks an equally-fast but less efficient one). */
export class MockCoronationLeaderboardClient implements CoronationLeaderboardClient {
  private rank(entries: CoronationEntry[]): CoronationEntry[] {
    return [...entries].sort((a, b) => a.coronationSeconds - b.coronationSeconds || a.animalsDefeated - b.animalsDefeated);
  }

  async getTop(n: number): Promise<CoronationEntry[]> {
    return this.rank(load()).slice(0, n);
  }

  async submit(entry: CoronationEntry): Promise<CoronationSubmitResult> {
    const entries = load();
    entries.push(entry);
    const ranked = this.rank(entries);
    const capped = ranked.slice(0, MAX_ENTRIES);
    save(capped);
    const rank = capped.indexOf(entry);
    return { rank: rank >= 0 ? rank + 1 : capped.length, top: capped.slice(0, 10) };
  }
}
