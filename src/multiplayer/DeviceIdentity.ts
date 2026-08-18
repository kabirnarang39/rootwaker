const DEVICE_ID_KEY = 'rootwaker.deviceId.v1';
const DISPLAY_NAME_KEY = 'rootwaker.displayName.v1';

// Jungle-flavored, distinct from the five playable species names so a display name never reads
// as a claim about which animal someone is playing.
const NAME_ADJECTIVES = ['Swift', 'Hidden', 'Silent', 'Restless', 'Ancient', 'Wandering', 'Keen', 'Stormlit', 'Mossbound', 'Fleet'];
const NAME_NOUNS = ['Mongoose', 'Toucan', 'Cicada', 'Orchid', 'Monsoon', 'Canopy', 'Termite', 'Hornbill', 'Liana', 'Firefly'];

let cachedDeviceId: string | null = null;
let cachedDisplayName: string | null = null;

function randomDisplayName(): string {
  const adj = NAME_ADJECTIVES[Math.floor(Math.random() * NAME_ADJECTIVES.length)];
  const noun = NAME_NOUNS[Math.floor(Math.random() * NAME_NOUNS.length)];
  const tag = 100 + Math.floor(Math.random() * 900);
  return `${adj} ${noun} #${tag}`;
}

/** A stable per-browser identity for the distributed mesh — the authorship key every CRDT entry
 * (leaderboard rows, chat messages) is keyed by. Cached in memory even when localStorage is
 * unavailable, so identity stays stable for the lifetime of one tab even without persistence;
 * only cross-session stability is lost in that case, same "won't persist" contract every other
 * local-storage-backed piece of this project already accepts. */
export function getDeviceId(): string {
  if (cachedDeviceId) return cachedDeviceId;
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) {
    cachedDeviceId = existing;
    return existing;
  }
  const id = crypto.randomUUID();
  cachedDeviceId = id;
  try {
    localStorage.setItem(DEVICE_ID_KEY, id);
  } catch {
    // storage unavailable — id just won't survive a reload, matches every other local store here
  }
  return id;
}

/** A real, editable player-facing name (never the raw deviceId — that's an internal routing key,
 * not something to put in a chat panel or leaderboard row). Auto-generated once, persisted, and
 * user-renamable via setDisplayName. */
export function getDisplayName(): string {
  if (cachedDisplayName) return cachedDisplayName;
  const existing = localStorage.getItem(DISPLAY_NAME_KEY);
  if (existing) {
    cachedDisplayName = existing;
    return existing;
  }
  const name = randomDisplayName();
  cachedDisplayName = name;
  try {
    localStorage.setItem(DISPLAY_NAME_KEY, name);
  } catch {
    // storage unavailable — name just won't survive a reload
  }
  return name;
}

export function setDisplayName(name: string): void {
  const trimmed = name.trim().slice(0, 24);
  if (!trimmed) return;
  cachedDisplayName = trimmed;
  try {
    localStorage.setItem(DISPLAY_NAME_KEY, trimmed);
  } catch {
    // storage unavailable — name just won't survive a reload
  }
}
