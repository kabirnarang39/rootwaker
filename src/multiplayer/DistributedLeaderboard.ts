import type { JsonValue } from 'trystero';
import type { CoronationEntry, CoronationLeaderboardClient, CoronationSubmitResult } from '../leaderboard/CoronationLeaderboard';
import { getDeviceId, getDisplayName } from './DeviceIdentity';
import { getWorldRoom, onPeerJoin } from './DistributedRoom';
import { encryptJSON, decryptJSON, safeGetItem, safeSetItem } from './crypto';

// A plain intersection (not `interface extends`) so this structurally satisfies trystero's
// DataPayload/JsonValue generic constraint — an interface with named-only members has no index
// signature, which TS's generic constraint check requires even though every member here really
// is JSON-safe (string/number only).
export type WorldCoronationEntry = CoronationEntry & {
  playerId: string;
  playerName: string;
  seq: number; // this device's own monotonic counter — bumped only when ITS OWN best improves
} & Record<string, JsonValue>;

const STORAGE_KEY = 'rootwaker.world-leaderboard.v1';
const SEQ_KEY = 'rootwaker.world-leaderboard-seq.v1';

function nextLocalSeq(): number {
  const raw = safeGetItem(SEQ_KEY);
  const next = (raw ? parseInt(raw, 10) : 0) + 1;
  // storage unavailable — seq resets each session, which only risks a stale-looking merge
  // conflict with this device's own prior entries, never data loss for anyone else's.
  safeSetItem(SEQ_KEY, String(next));
  return next;
}

/** Real gossip-style anti-entropy CRDT — the same algorithm class distributed databases like
 * Cassandra/DynamoDB use for eventually-consistent replication: no coordinator, no "server owns
 * the truth". State is a Map keyed by playerId, one LWW-register per key. A device only ever
 * writes its OWN key (bumping its own seq when ITS best coronation improves), so there is never a
 * concurrent-writer conflict on a single key to resolve — merging is just "keep whichever copy of
 * playerId=X has the higher seq", which is deterministic and order-independent: any two peers
 * merging in any order, at any time, converge to the same table. Sync is periodic/opportunistic
 * (on room join + on demand), not a held-open live broadcast — exactly the "sync when you happen
 * to cross paths" shape gossip protocols use, so it never needs every device online at once. */
export class DistributedCoronationLeaderboardClient implements CoronationLeaderboardClient {
  private state = new Map<string, WorldCoronationEntry>();
  private loaded = false;
  private wired = false;

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    const raw = safeGetItem(STORAGE_KEY);
    if (raw) {
      const entries = await decryptJSON<WorldCoronationEntry[]>(raw);
      if (entries) for (const e of entries) this.state.set(e.playerId, e);
    }
  }

  private async persist(): Promise<void> {
    const payload = await encryptJSON([...this.state.values()]);
    safeSetItem(STORAGE_KEY, payload);
  }

  /** Accepts an incoming entry only if it's newer than what's already known for that playerId —
   * the actual merge rule. Returns whether anything changed (worth re-persisting/re-rendering). */
  private mergeOne(entry: WorldCoronationEntry): boolean {
    const known = this.state.get(entry.playerId);
    if (known && known.seq >= entry.seq) return false;
    this.state.set(entry.playerId, entry);
    return true;
  }

  private async mergeMany(entries: WorldCoronationEntry[]): Promise<void> {
    let changed = false;
    for (const e of entries) if (this.mergeOne(e)) changed = true;
    if (changed) await this.persist();
  }

  /** Joins the world mesh and wires gossip exchange — lazy, only happens the first time this
   * client is actually used (getTop/submit), matching the project's "no network until touched"
   * pattern. Real sync shape: broadcast a single updated entry whenever this device's own best
   * improves; on any peer join, hand the newcomer this device's full known state once (a fresh
   * peer has seen nothing yet, so a single-entry broadcast alone would leave it missing history). */
  /** Real degrade path: if joining the mesh fails for any reason (WebRTC unavailable, the
   * environment blocks it, a future trystero bug), this catches it rather than letting getTop()/
   * submit() reject — every consumer in Game.ts calls these with a bare .then(), no .catch(), so
   * an unguarded throw here would silently break the O-key panel and the coronation-result toast
   * with zero feedback to the player. Degrades to fully local-only (still ranks/persists real
   * entries, just without gossip) — `wired` stays true either way so a persistently-unreachable
   * mesh doesn't retry the same failure on every single getTop()/submit() call. */
  private ensureWired(): void {
    if (this.wired) return;
    this.wired = true;
    try {
      const room = getWorldRoom();
      const entryAction = room.makeAction<WorldCoronationEntry>('lb-entry');
      const fullAction = room.makeAction<WorldCoronationEntry[]>('lb-full');
      entryAction.onMessage = (entry) => {
        if (this.mergeOne(entry)) void this.persist();
      };
      fullAction.onMessage = (entries) => {
        void this.mergeMany(entries);
      };
      onPeerJoin((peerId) => {
        fullAction.send([...this.state.values()], { target: peerId });
      });
      this.broadcastEntry = (entry) => entryAction.send(entry);
    } catch {
      // networking unavailable — this.broadcastEntry stays the no-op default; getTop()/submit()
      // still work against local state.
    }
  }

  private broadcastEntry: (entry: WorldCoronationEntry) => void = () => {};

  private rank(entries: WorldCoronationEntry[]): WorldCoronationEntry[] {
    return [...entries].sort((a, b) => a.coronationSeconds - b.coronationSeconds || a.animalsDefeated - b.animalsDefeated);
  }

  async getTop(n: number): Promise<WorldCoronationEntry[]> {
    this.ensureWired();
    await this.ensureLoaded();
    return this.rank([...this.state.values()]).slice(0, n);
  }

  async submit(entry: CoronationEntry): Promise<CoronationSubmitResult> {
    this.ensureWired();
    await this.ensureLoaded();
    const playerId = getDeviceId();
    const existing = this.state.get(playerId);
    // Only replace THIS device's own entry when the new run is actually better — a leaderboard
    // tracks personal bests, not most-recent attempts.
    const isBetter =
      !existing ||
      entry.coronationSeconds < existing.coronationSeconds ||
      (entry.coronationSeconds === existing.coronationSeconds && entry.animalsDefeated < existing.animalsDefeated);
    const worldEntry: WorldCoronationEntry = isBetter
      ? { ...entry, playerId, playerName: getDisplayName(), seq: nextLocalSeq() }
      : { ...existing! };
    if (isBetter) {
      this.state.set(playerId, worldEntry);
      await this.persist();
      this.broadcastEntry(worldEntry);
    }
    const ranked = this.rank([...this.state.values()]);
    const rank = ranked.findIndex((e) => e.playerId === playerId);
    return { rank: rank >= 0 ? rank + 1 : ranked.length, top: ranked.slice(0, 10) };
  }
}
