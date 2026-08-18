const KEY_STORAGE_KEY = 'rootwaker.savekey.v1';

/** Shared AES-GCM (Web Crypto, no external library) local-encryption core — originally lived
 * only inside SaveGame.ts, extracted so the distributed leaderboard/chat stores can encrypt
 * their own local mirrors the same honest way: this protects a save/mirror blob from casual
 * localStorage inspection, not from a determined attacker with full access to their own device
 * (no client-only scheme with no server and no passphrase can ever promise that). One key, one
 * storage slot, shared by every local encrypted store in this app. */

/** Real, previously-missing guard: `localStorage.getItem` — not just `setItem` — can throw in
 * some private-browsing/storage-restricted environments. Every `setItem` call in this project
 * already treats storage failure as "won't persist" rather than an error; `getItem` calls were
 * inconsistently guarded (some wrapped, some not). Shared here so every local-storage read across
 * SaveGame/DistributedLeaderboard/DeviceIdentity gets the same real safety, not just the write side. */
export function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable — caller's data just won't persist across reloads
  }
}

async function getOrCreateKey(): Promise<CryptoKey> {
  const existing = safeGetItem(KEY_STORAGE_KEY);
  if (existing) {
    const raw = base64ToBytes(existing);
    return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  }
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const raw = await crypto.subtle.exportKey('raw', key);
  safeSetItem(KEY_STORAGE_KEY, bytesToBase64(new Uint8Array(raw)));
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

export async function encryptJSON(value: unknown): Promise<string> {
  const key = await getOrCreateKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return JSON.stringify({ iv: bytesToBase64(iv), data: bytesToBase64(new Uint8Array(ciphertext)) });
}

/** Returns null on no/corrupt/tampered payload (GCM auth tag fails to verify) — caught, not
 * thrown, since a failed decrypt here means "no usable data", not a program error. Never throws. */
export async function decryptJSON<T>(payload: string): Promise<T | null> {
  try {
    const parsed = JSON.parse(payload) as { iv: string; data: string };
    const key = await getOrCreateKey();
    const iv = base64ToBytes(parsed.iv);
    const ciphertext = base64ToBytes(parsed.data);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return JSON.parse(new TextDecoder().decode(plaintext)) as T;
  } catch {
    return null;
  }
}
