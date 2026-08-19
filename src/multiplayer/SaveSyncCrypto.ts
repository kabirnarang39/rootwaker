// Passphrase-derived AES-GCM, distinct from crypto.ts's own per-device auto-generated key: that
// key lives only in this ONE browser's localStorage and is exactly the thing a cross-browser
// save-transfer can't rely on. Here the key is derived from a human-chosen passphrase instead —
// portable by design, since the whole point is a second browser deriving the SAME key from the
// SAME typed passphrase, no stored secret involved at all. Same real honesty level as crypto.ts's
// own doc comment: this protects the save payload from a relay/observer casually reading it in
// transit, not from a determined attacker who already knows or brute-forces the passphrase.
const PBKDF2_ITERATIONS = 210_000; // OWASP's 2023 minimum recommendation for PBKDF2-SHA256
// Fixed, not random: the room itself is already scoped to a hash of the passphrase (see
// SaveSyncSession.ts), so only someone who already knows the passphrase can even find this data
// to attack — a random per-encryption salt would need to travel WITH the ciphertext for the
// other browser to reproduce the same key, adding real complexity for no real security gain at
// this specific threat level. A fixed, app-specific salt still fully defeats rainbow-table attacks
// against the passphrase itself, which is the one real thing a salt buys here.
const SALT = new TextEncoder().encode('rootwaker-save-sync-v1');

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(passphrase: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: SALT, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptWithPassphrase(passphrase: string, value: unknown): Promise<string> {
  const key = await deriveKey(passphrase);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return JSON.stringify({ iv: bytesToBase64(iv), data: bytesToBase64(new Uint8Array(ciphertext)) });
}

/** Returns null on a wrong passphrase, a corrupt payload, or a tampered payload (GCM's own auth
 * tag fails to verify against the wrong key) — a wrong passphrase and a corrupted blob are
 * indistinguishable to the caller, which is correct: this must never confirm or deny whether a
 * given passphrase is "close" to right. Never throws. */
export async function decryptWithPassphrase<T>(passphrase: string, payload: string): Promise<T | null> {
  try {
    const parsed = JSON.parse(payload) as { iv: string; data: string };
    const key = await deriveKey(passphrase);
    const iv = base64ToBytes(parsed.iv);
    const ciphertext = base64ToBytes(parsed.data);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return JSON.parse(new TextDecoder().decode(plaintext)) as T;
  } catch {
    return null;
  }
}
