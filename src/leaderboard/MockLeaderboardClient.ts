import type { LeaderboardClient, LeaderboardEntry, SubmitResult } from './LeaderboardClient';

const STORAGE_KEY = 'rootwaker.leaderboard.v2';
const MAX_ENTRIES = 50;

const SEED_ENTRIES: LeaderboardEntry[] = [
  { name: 'Ashfall Warden', distance: 812, motes: 96, score: 2252 },
  { name: 'Mossbound Wanderer', distance: 640, motes: 71, score: 1705 },
  { name: 'Elder Root', distance: 588, motes: 64, score: 1548 },
  { name: 'Cinder Vixen', distance: 511, motes: 58, score: 1381 },
  { name: 'Hollow Bloom', distance: 447, motes: 49, score: 1182 },
  { name: 'Nine-Tail Drift', distance: 392, motes: 44, score: 1052 },
  { name: 'Waking Bark', distance: 305, motes: 33, score: 800 },
  { name: 'Glowspore', distance: 244, motes: 27, score: 649 },
  { name: 'Duskrunner', distance: 178, motes: 19, score: 463 },
  { name: 'First Light', distance: 96, motes: 9, score: 231 },
];

function load(): LeaderboardEntry[] {
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

function save(entries: LeaderboardEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // storage unavailable (private browsing, quota) — leaderboard just won't persist
  }
}

/**
 * localStorage-backed prototype so the leaderboard UX ships and can be
 * played with before a real backend account exists. NOT a real global
 * leaderboard — every player sees only their own browser's data plus the
 * seeded flavor entries. Ranked by score (distance + combo-weighted motes),
 * not raw distance — matches the genre's actual high-score framing. A real
 * backend would also validate submissions (score can't exceed max possible
 * for the elapsed run time); this mock trusts the caller since it's local-only.
 */
export class MockLeaderboardClient implements LeaderboardClient {
  async getTop(n: number): Promise<LeaderboardEntry[]> {
    const entries = load().sort((a, b) => b.score - a.score);
    return entries.slice(0, n);
  }

  async submit(entry: LeaderboardEntry): Promise<SubmitResult> {
    const entries = load();
    entries.push(entry);
    entries.sort((a, b) => b.score - a.score);
    const capped = entries.slice(0, MAX_ENTRIES);
    save(capped);
    const rank = capped.findIndex((e) => e === entry) + 1;
    return { rank: rank > 0 ? rank : capped.length, top: capped.slice(0, 10) };
  }
}
