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

// Same real known-species set DistributedLeaderboard.ts's own VALID_SPECIES already uses for the
// identical purpose — kept as a local literal rather than importing CharacterSelect.ts's
// SPECIES_ORDER, since that file pulls in the whole THREE.js-backed selection UI just for a
// 6-item list SaveGame.ts (deliberately dependency-light) doesn't otherwise need.
const VALID_SPECIES = new Set(['fox', 'bear', 'viper', 'boar', 'lion', 'crocodile', 'owl']);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Real combination-testing find: decryptJSON's AES-GCM auth tag catches TAMPERED ciphertext, but
 * a successfully-decrypted payload with the wrong SHAPE sailed straight through with zero
 * validation — this project's own GameSaveState has changed shape multiple times already this
 * session (coronationSeconds was added after unlockedAbilities existed), so an older save missing
 * a now-required field is a completely real scenario, not a hypothetical. Two concrete crashes
 * this closes: `for (const id of resume.unlockedAbilities)` in Game.ts throws immediately on a
 * save where that field is missing/undefined ("undefined is not iterable"); and
 * `body.position.set(resume.checkpointX, ...)` with a NaN/undefined coordinate would silently
 * corrupt the player's position for the rest of the session with no error at all, poisoning every
 * downstream physics/collision/groundHeightAt call. Rejecting the whole save (not trying to patch
 * individual fields) is deliberate — this project's `load()` already treats "no usable save" as a
 * safe, well-tested fallback (main.ts falls through to character-select), so folding "malformed"
 * into that exact same path is the smallest real fix, not a new code path to get wrong.
 *
 * species is checked against VALID_SPECIES, not just typeof === 'string' — a real follow-up find
 * on this exact function: ResumeGate.ts interpolates SPECIES_LABELS[save.species]?.name ??
 * save.species directly into an innerHTML template with zero escaping. Under normal program flow
 * `species` only ever comes from a fixed CharacterSelect literal, never free text, so this is
 * self-XSS-only (a save is local-only, never transmitted) — but rejecting anything outside the
 * real known species set here closes it at the actual choke point anyway, consistent with this
 * project's own established pattern (DistributedLeaderboard.ts's identical VALID_SPECIES check on
 * every remote entry) rather than leaving it to render-time escaping. */
/** Exported for SaveSyncSession.ts's own restore path — a save recovered from a peer over the
 * distributed mesh is network-sourced data (even if that peer is honestly just your own other
 * browser) and needs the exact same shape/bounds check a locally-decrypted save already gets
 * here, not a weaker one. See this function's own doc comment above for why species specifically
 * matters: ResumeGate.ts interpolates it into innerHTML with zero escaping. */
export function isValidSaveState(value: unknown): value is GameSaveState {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.species === 'string' && VALID_SPECIES.has(v.species) &&
    typeof v.skinId === 'string' &&
    isFiniteNumber(v.checkpointX) &&
    isFiniteNumber(v.checkpointY) &&
    isFiniteNumber(v.checkpointZ) &&
    isFiniteNumber(v.hp) &&
    isFiniteNumber(v.maxHp) &&
    v.maxHp > 0 &&
    Array.isArray(v.unlockedAbilities) &&
    v.unlockedAbilities.every((id) => typeof id === 'string') &&
    isFiniteNumber(v.animalsDefeated) &&
    typeof v.kingDefeated === 'boolean' &&
    (v.coronationSeconds === null || isFiniteNumber(v.coronationSeconds)) &&
    isFiniteNumber(v.savedAt)
  );
}

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

  /** Returns null on no save, a corrupt/tampered save, a save with the wrong shape (an older or
   * hand-edited save), or storage being unavailable — never throws, matching every other local
   * store in this project. */
  async load(): Promise<GameSaveState | null> {
    const raw = safeGetItem(SAVE_STORAGE_KEY);
    if (!raw) return null;
    const state = await decryptJSON<GameSaveState>(raw);
    return isValidSaveState(state) ? state : null;
  }

  clear(): void {
    try {
      localStorage.removeItem(SAVE_STORAGE_KEY);
    } catch {
      // storage unavailable — nothing to clear anyway
    }
  }
}
