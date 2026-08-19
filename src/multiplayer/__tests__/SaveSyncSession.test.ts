import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GameSaveState } from '../../game/SaveGame';

// A real (if simplified) fake trystero mesh: joinRoom(config, roomId) returns a fake Room, and
// two calls with the SAME roomId share the same underlying fake room object — matching real
// trystero's own guarantee that peers who join the same room id find each other. This is the
// real thing SaveSyncSession.ts's own passphrase->roomId derivation depends on: two browsers
// with the same passphrase must land in the same room, two with different passphrases must not.
type RequestConfig = { kind: 'request'; onRequest?: (data: unknown) => unknown | Promise<unknown> };
type FakeAction = { onRequest?: (data: unknown) => unknown | Promise<unknown> };

function makeFakeRoom() {
  const actions = new Map<string, FakeAction>();
  const room = {
    onPeerJoin: null as ((peerId: string) => void) | null,
    onPeerLeave: null as ((peerId: string) => void) | null,
    peers: {} as Record<string, unknown>,
    leave: vi.fn(async () => {}),
    getPeers: () => room.peers,
    makeAction: vi.fn((namespace: string, config?: RequestConfig) => {
      let action = actions.get(namespace);
      if (!action) {
        action = {};
        actions.set(namespace, action);
      }
      if (config?.onRequest) action.onRequest = config.onRequest;
      return {
        onRequest: action.onRequest ?? null,
        request: vi.fn(async (data: unknown) => {
          const responder = actions.get(namespace)?.onRequest;
          if (!responder) throw new Error('no peer is answering this request (timeout)');
          return responder(data);
        }),
      };
    }),
  };
  return room;
}

const roomsByKey = new Map<string, ReturnType<typeof makeFakeRoom>>();
const joinRoomMock = vi.fn((config: { appId: string; password?: string }, roomId: string) => {
  const key = `${config.appId}:${roomId}`;
  let room = roomsByKey.get(key);
  if (!room) {
    room = makeFakeRoom();
    roomsByKey.set(key, room);
  } else {
    // A second real joinRoom() call against the same room id simulates a real peer showing up —
    // both this new caller AND the first caller's own onPeerJoin should see each other, matching
    // real trystero's own mutual peer-discovery.
    room.peers = { 'fake-peer': {} };
    room.onPeerJoin?.('fake-peer');
  }
  return room;
});

vi.mock('trystero', () => ({
  joinRoom: (config: { appId: string; password?: string }, roomId: string) => joinRoomMock(config, roomId),
}));

beforeEach(() => {
  roomsByKey.clear();
  joinRoomMock.mockClear();
});

const sampleSave: GameSaveState = {
  species: 'bear',
  skinId: 'loam',
  checkpointX: 3,
  checkpointY: 0,
  checkpointZ: -12,
  hp: 72,
  maxHp: 100,
  unlockedAbilities: ['keen-ear', 'bear-swipe'],
  animalsDefeated: 4,
  kingDefeated: false,
  coronationSeconds: null,
  savedAt: 1723939200000,
};

describe('shareSaveForSync / restoreSaveViaSync', () => {
  it('a real round trip: sharing with a passphrase, then restoring with the SAME passphrase, recovers the exact save', async () => {
    const { shareSaveForSync, restoreSaveViaSync } = await import('../SaveSyncSession');
    const handle = await shareSaveForSync('correct horse battery staple', sampleSave);
    const restored = await restoreSaveViaSync('correct horse battery staple', 1000);
    expect(restored).toEqual(sampleSave);
    handle.stop();
  });

  it('restoring with the WRONG passphrase never finds the sharing peer at all — a different passphrase derives a different room id, so they never even meet (regression risk: falling back to some shared/default room would leak whose save is whose)', async () => {
    const { shareSaveForSync, restoreSaveViaSync } = await import('../SaveSyncSession');
    const handle = await shareSaveForSync('correct horse battery staple', sampleSave);
    const restored = await restoreSaveViaSync('a-totally-different-passphrase', 200);
    expect(restored).toBeNull();
    handle.stop();
  });

  it('restoring times out and returns null (not throws) when nobody is sharing at all', async () => {
    const { restoreSaveViaSync } = await import('../SaveSyncSession');
    const restored = await restoreSaveViaSync('nobody-is-sharing-this-one', 50);
    expect(restored).toBeNull();
  });

  it('a decrypted response with an invalid/malformed shape is rejected, not trusted as a real save (regression: a save recovered over the network needs the SAME isValidSaveState gate a locally-decrypted save already gets — a buggy or dishonest peer could otherwise inject anything)', async () => {
    const { restoreSaveViaSync } = await import('../SaveSyncSession');
    const { encryptWithPassphrase } = await import('../SaveSyncCrypto');

    // Manually stand up a "sharer" that responds with a garbage shape instead of using
    // shareSaveForSync (which always encrypts a real, valid GameSaveState) — this simulates a
    // buggy/dishonest peer on the other end of the request.
    const passphrase = 'shape-check-passphrase';
    const roomId = await sha256Hex(`rootwaker-save-sync:${passphrase}`);
    const room = makeFakeRoom();
    roomsByKey.set(`rootwaker-v1:${roomId.slice(0, 32)}`, room);
    room.makeAction('restore', {
      kind: 'request',
      onRequest: async () => encryptWithPassphrase(passphrase, { not: 'a real save' }),
    });

    const restored = await restoreSaveViaSync(passphrase, 1000);
    expect(restored).toBeNull();
  });

  it('stop() leaves the room immediately rather than waiting for the real duration window', async () => {
    const { shareSaveForSync } = await import('../SaveSyncSession');
    const handle = await shareSaveForSync('stop-test-passphrase', sampleSave, 90_000);
    const room = [...roomsByKey.values()][0];
    handle.stop();
    expect(room.leave).toHaveBeenCalled();
  });
});

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
