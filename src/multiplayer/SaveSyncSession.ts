import { joinRoom, type Room } from 'trystero';
import { isValidSaveState, type GameSaveState } from '../game/SaveGame';
import { encryptWithPassphrase, decryptWithPassphrase } from './SaveSyncCrypto';

// A real save/identity carrier over the SAME distributed mesh the world leaderboard already
// uses (DistributedRoom.ts) — but a private, passphrase-scoped room, never the shared 'world'
// room a save has no business broadcasting into. Best-effort by construction: there is no
// persistent storage layer anywhere in this mesh (trystero is pure peer discovery + WebRTC
// relay, nothing durable), so this only ever works if the OLD browser is actively sharing at the
// same moment the NEW browser asks — the same honest "no backend" trade-off this whole project
// already accepts for the world leaderboard's own gossip-only durability (replicated across many
// peers there; here there is exactly one real copy, so there's no redundancy to fall back on).
const APP_ID = 'rootwaker-v1';
const DEFAULT_SHARE_DURATION_MS = 90_000;
const DEFAULT_RESTORE_TIMEOUT_MS = 30_000;

/** Room id is a real SHA-256 of the passphrase, not the passphrase itself — so the passphrase
 * never travels as a literal, guessable room identifier (trystero's own `password` room-config
 * option additionally encrypts the SDP signaling exchange on top of this). Two browsers with the
 * SAME passphrase independently derive the SAME room id and find each other automatically; two
 * browsers with different passphrases end up in different rooms and simply never meet — the
 * correct, honest failure mode (see restoreSaveViaSync's own doc comment on why a wrong
 * passphrase must look identical to "nobody's sharing"). */
async function roomIdFor(passphrase: string): Promise<string> {
  const bytes = new TextEncoder().encode(`rootwaker-save-sync:${passphrase}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

function waitForPeer(room: Room, timeoutMs: number): Promise<string | null> {
  return new Promise((resolve) => {
    const existing = Object.keys(room.getPeers());
    if (existing.length > 0) {
      resolve(existing[0]);
      return;
    }
    const timer = setTimeout(() => {
      room.onPeerJoin = null;
      resolve(null);
    }, timeoutMs);
    room.onPeerJoin = (peerId) => {
      clearTimeout(timer);
      room.onPeerJoin = null;
      resolve(peerId);
    };
  });
}

export interface ShareHandle {
  /** Stops sharing and leaves the room immediately, before the real duration window elapses —
   * called if the player navigates away or explicitly cancels. */
  stop(): void;
}

/** Runs on the browser that already has real progress. Joins the passphrase-scoped room and
 * answers exactly one kind of request — "send me the save" — with the CURRENT save, encrypted
 * with the same passphrase-derived key restoreSaveViaSync() independently derives. A real,
 * bounded window (default 90s), not a persistent background daemon — this project has no
 * always-on networking anywhere else either (the world leaderboard/duel mesh only connect once a
 * player actually opens that feature). `save` is a snapshot at call time, not live-updating; a
 * player who wants a more current snapshot shared just re-opens this with a fresh save. */
export async function shareSaveForSync(passphrase: string, save: GameSaveState, durationMs = DEFAULT_SHARE_DURATION_MS): Promise<ShareHandle> {
  const roomId = await roomIdFor(passphrase);
  const room = joinRoom({ appId: APP_ID, password: passphrase }, roomId);
  room.makeAction<{ ping: true }, string>('restore', {
    kind: 'request',
    onRequest: async () => encryptWithPassphrase(passphrase, save),
  });
  const timer = setTimeout(() => void room.leave(), durationMs);
  return {
    stop: () => {
      clearTimeout(timer);
      void room.leave();
    },
  };
}

/** Runs on the browser trying to recover progress. Joins the same passphrase-scoped room, waits
 * for a real peer (the sharing browser, if one is currently open to the same passphrase) to
 * appear, requests the save, and decrypts it locally. Returns null if no peer connects within
 * `timeoutMs` OR if decryption fails for any reason — including a wrong passphrase, which joins
 * a completely different room and so looks identical to "nobody's sharing right now". This is
 * deliberate: the function must never be able to confirm or deny that a given passphrase is
 * close to correct, the same honest failure-mode discipline SaveGame.ts's own load() already
 * applies to a corrupt/tampered local save. */
export async function restoreSaveViaSync(passphrase: string, timeoutMs = DEFAULT_RESTORE_TIMEOUT_MS): Promise<GameSaveState | null> {
  const roomId = await roomIdFor(passphrase);
  const room = joinRoom({ appId: APP_ID, password: passphrase }, roomId);
  const restoreAction = room.makeAction<{ ping: true }, string>('restore', { kind: 'request' });
  try {
    const peerId = await waitForPeer(room, timeoutMs);
    if (!peerId) return null;
    const encrypted = await restoreAction.request({ ping: true }, { target: peerId, timeoutMs });
    const decrypted = await decryptWithPassphrase<unknown>(passphrase, encrypted);
    // Real network-sourced data — even an honest peer could send a stale/mid-migration shape,
    // and a dishonest one (anyone who's learned the passphrase) could send anything at all. Same
    // shape/bounds gate a locally-decrypted save already gets in SaveGame.ts's own load().
    return isValidSaveState(decrypted) ? decrypted : null;
  } catch {
    return null;
  } finally {
    void room.leave();
  }
}
