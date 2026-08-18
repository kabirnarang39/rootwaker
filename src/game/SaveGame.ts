import type { SpeciesId } from '../scene/PlayableCharacter';
import { encryptJSON, decryptJSON, safeGetItem, safeSetItem } from '../multiplayer/crypto';

export interface GameSaveState {
  species: SpeciesId;
  skinId: string;
  checkpointX: number;
  checkpointY: number;
  checkpointZ: number;
  hp: number;
  maxHp: number;
  unlockedAbilities: string[];
  animalsDefeated: number;
  kingDefeated: boolean;
  // Set only once, the moment the King falls — real elapsed clock.elapsedTime, the same value
  // fed to CoronationLeaderboard. Kept here too so a resumed session can still submit/redisplay
  // the coronation result even if the tab closed before the leaderboard toast was seen.
  coronationSeconds: number | null;
  savedAt: number; // Date.now(), shown to the player as "last played"
}

const SAVE_STORAGE_KEY = 'rootwaker.save.v1';

/** Encrypted, local-only save/resume — real AES-GCM via the shared multiplayer/crypto.ts core
 * (a fresh random IV every save, AES-GCM must never reuse an IV under the same key). Same honesty
 * standard this project already applies to the "local, not global" leaderboard: this protects the
 * save blob from casual inspection/tampering, not from a determined attacker with full access to
 * their own device. */
export class SaveGame {
  async save(state: GameSaveState): Promise<void> {
    const payload = await encryptJSON(state);
    safeSetItem(SAVE_STORAGE_KEY, payload);
  }

  /** Returns null on no save, a corrupt/tampered save, or storage being unavailable — never
   * throws, matching every other local store in this project. */
  async load(): Promise<GameSaveState | null> {
    const raw = safeGetItem(SAVE_STORAGE_KEY);
    if (!raw) return null;
    return decryptJSON<GameSaveState>(raw);
  }

  clear(): void {
    try {
      localStorage.removeItem(SAVE_STORAGE_KEY);
    } catch {
      // storage unavailable — nothing to clear anyway
    }
  }
}
