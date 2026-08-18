import { joinRoom, type Room } from 'trystero';

// One shared global mesh every tab joins — trystero's nostr strategy uses free public Nostr
// relays purely to exchange WebRTC SDP offers/answers (peer discovery + handshake only); once
// connected, every byte of game data (leaderboard rows, chat, voice) flows directly peer-to-peer,
// end-to-end encrypted by WebRTC's own DTLS layer. No backend of ours is in the data path — same
// "no backend" honesty as P2PChallengeLink's duel signaling, just automated instead of manual
// copy/paste, since a world-shared leaderboard has no single pair of players to hand codes to.
//
// Real, accepted ceiling: this is a full mesh (every peer connects to every other peer), which
// scales to roughly 20-50 concurrent peers before per-peer bandwidth degrades — fine for a niche
// game's realistic concurrent player count, not literally "every player on Earth in one mesh".
// Sharding into multiple rooms (e.g. by region) is the future upgrade if that ceiling is ever hit.
const APP_ID = 'rootwaker-v1';
const WORLD_ROOM_ID = 'world';

let room: Room | null = null;
const peerJoinHandlers: Array<(peerId: string) => void> = [];
const peerLeaveHandlers: Array<(peerId: string) => void> = [];

/** Lazily joins the world mesh on first real use (not on page load) — matches this project's
 * existing pattern of never opening network connections until a feature is actually touched.
 * Room only supports ONE handler per event (a plain property assignment), so this fans a single
 * assignment out to every consumer (leaderboard sync, chat, peer list) that registered interest. */
function ensureRoom(): Room {
  if (room) return room;
  room = joinRoom({ appId: APP_ID }, WORLD_ROOM_ID);
  room.onPeerJoin = (peerId) => peerJoinHandlers.forEach((h) => h(peerId));
  room.onPeerLeave = (peerId) => peerLeaveHandlers.forEach((h) => h(peerId));
  return room;
}

export function getWorldRoom(): Room {
  return ensureRoom();
}

export function onPeerJoin(handler: (peerId: string) => void): void {
  ensureRoom();
  peerJoinHandlers.push(handler);
}

export function onPeerLeave(handler: (peerId: string) => void): void {
  ensureRoom();
  peerLeaveHandlers.push(handler);
}

export function getConnectedPeerIds(): string[] {
  return Object.keys(ensureRoom().getPeers());
}
