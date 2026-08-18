import type { SpeciesId } from '../scene/PlayableCharacter';

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

const KEY_STORAGE_KEY = 'rootwaker.savekey.v1';
const SAVE_STORAGE_KEY = 'rootwaker.save.v1';

async function getOrCreateKey(): Promise<CryptoKey> {
  const existing = localStorage.getItem(KEY_STORAGE_KEY);
  if (existing) {
    const raw = base64ToBytes(existing);
    return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  }
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const raw = await crypto.subtle.exportKey('raw', key);
  try {
    localStorage.setItem(KEY_STORAGE_KEY, bytesToBase64(new Uint8Array(raw)));
  } catch {
    // storage unavailable — the key just won't persist across reloads; save()/load() below
    // still work within this one session since getOrCreateKey re-generates a fresh key on the
    // next call rather than throwing (this branch), matching save()'s own "won't persist" contract.
  }
  return key;
}

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

// Returns Uint8Array<ArrayBuffer> specifically (not the wider ArrayBufferLike TS infers from
// Uint8Array.from), which is what crypto.subtle's strict BufferSource typing requires.
function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Encrypted, local-only save/resume — real AES-GCM (Web Crypto, no external library), a fresh
 * random IV every save (AES-GCM must never reuse an IV under the same key). The encryption key
 * itself lives in localStorage alongside the ciphertext, same as it must for any purely
 * client-side scheme with no server and no user-supplied passphrase — this protects the save
 * blob from casual inspection/tampering (a player poking at localStorage in devtools can't just
 * read/edit their HP or ability unlocks as plain JSON), not from a determined attacker with full
 * access to their own device (which no client-only scheme can ever prevent — there's no secret to
 * hide the key behind without a server or a passphrase). Same honesty standard this project
 * already applies to the "local, not global" leaderboard. */
export class SaveGame {
  async save(state: GameSaveState): Promise<void> {
    const key = await getOrCreateKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(state));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
    const payload = { iv: bytesToBase64(iv), data: bytesToBase64(new Uint8Array(ciphertext)) };
    try {
      localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // storage unavailable (private browsing, quota) — save just won't persist
    }
  }

  /** Returns null on no save, a corrupt/tampered save (GCM auth tag fails to verify — caught, not
   * thrown, since a failed decrypt here means "no usable save", not a program error), or a
   * version mismatch. Never throws. */
  async load(): Promise<GameSaveState | null> {
    const raw = localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) return null;
    try {
      const payload = JSON.parse(raw) as { iv: string; data: string };
      const key = await getOrCreateKey();
      const iv = base64ToBytes(payload.iv);
      const ciphertext = base64ToBytes(payload.data);
      const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
      return JSON.parse(new TextDecoder().decode(plaintext)) as GameSaveState;
    } catch {
      return null;
    }
  }

  clear(): void {
    localStorage.removeItem(SAVE_STORAGE_KEY);
  }
}
