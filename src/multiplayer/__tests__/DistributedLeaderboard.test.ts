import { describe, it, expect, vi, beforeEach } from 'vitest';

type Handler = (data: unknown) => void;

function fakeAction() {
  return { onMessage: null as Handler | null, send: vi.fn() };
}

let entryAction: ReturnType<typeof fakeAction>;
let fullAction: ReturnType<typeof fakeAction>;
let joinHandlers: Array<(peerId: string) => void>;

const fakeRoom = {
  makeAction: vi.fn((namespace: string) => (namespace === 'lb-entry' ? entryAction : fullAction)),
  getPeers: vi.fn(() => ({})),
};

const { getWorldRoomImpl } = vi.hoisted(() => ({ getWorldRoomImpl: vi.fn() }));

vi.mock('../DistributedRoom', () => ({
  getWorldRoom: () => getWorldRoomImpl(),
  onPeerJoin: (h: (peerId: string) => void) => joinHandlers.push(h),
}));

function fakeLocalStorage(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => data.delete(key),
    clear: () => data.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('localStorage', fakeLocalStorage());
  entryAction = fakeAction();
  fullAction = fakeAction();
  joinHandlers = [];
  fakeRoom.makeAction.mockClear();
  getWorldRoomImpl.mockReset();
  getWorldRoomImpl.mockReturnValue(fakeRoom);
});

describe('DistributedCoronationLeaderboardClient', () => {
  it('submit() ranks entries fastest-first, same rule as the original local leaderboard', async () => {
    const { DistributedCoronationLeaderboardClient } = await import('../DistributedLeaderboard');
    const client = new DistributedCoronationLeaderboardClient();
    await client.submit({ species: 'fox', coronationSeconds: 500, animalsDefeated: 5 });
    const top = await client.getTop(10);
    expect(top[0].coronationSeconds).toBe(500);
  });

  it('submit() only replaces this device\'s own entry when the new run is actually BETTER (personal-best tracking, not most-recent)', async () => {
    const { DistributedCoronationLeaderboardClient } = await import('../DistributedLeaderboard');
    const client = new DistributedCoronationLeaderboardClient();
    const first = await client.submit({ species: 'fox', coronationSeconds: 400, animalsDefeated: 3 });
    // A slower second run should NOT overwrite the faster first one.
    const second = await client.submit({ species: 'bear', coronationSeconds: 900, animalsDefeated: 8 });
    const top = await client.getTop(10);
    expect(top).toHaveLength(1);
    expect(top[0].coronationSeconds).toBe(400);
    expect(first.rank).toBe(1);
    expect(second.rank).toBe(1);
  });

  it('a real network entry with a HIGHER seq for a known playerId overwrites the local copy (last-writer-wins by seq)', async () => {
    const { DistributedCoronationLeaderboardClient } = await import('../DistributedLeaderboard');
    const client = new DistributedCoronationLeaderboardClient();
    await client.getTop(1); // wires the room + registers actions

    entryAction.onMessage!({ species: 'viper', coronationSeconds: 700, animalsDefeated: 6, playerId: 'peer-a', playerName: 'Swift Toucan #1', seq: 1 });
    entryAction.onMessage!({ species: 'viper', coronationSeconds: 600, animalsDefeated: 6, playerId: 'peer-a', playerName: 'Swift Toucan #1', seq: 2 });

    const top = await client.getTop(10);
    expect(top).toHaveLength(1);
    expect(top[0].coronationSeconds).toBe(600);
    expect(top[0].seq).toBe(2);
  });

  it('a real network entry with a seq NOT greater than the known one is dropped — the CRDT merge rule, order-independent convergence', async () => {
    const { DistributedCoronationLeaderboardClient } = await import('../DistributedLeaderboard');
    const client = new DistributedCoronationLeaderboardClient();
    await client.getTop(1);

    entryAction.onMessage!({ species: 'viper', coronationSeconds: 600, animalsDefeated: 6, playerId: 'peer-a', playerName: 'Swift Toucan #1', seq: 5 });
    // Stale/out-of-order gossip replay of an older seq for the same player — must NOT regress the table.
    entryAction.onMessage!({ species: 'viper', coronationSeconds: 999, animalsDefeated: 1, playerId: 'peer-a', playerName: 'Swift Toucan #1', seq: 3 });

    const top = await client.getTop(10);
    expect(top[0].coronationSeconds).toBe(600);
  });

  it('a full-state sync (newly joined peer) merges every entry with the same seq rule', async () => {
    const { DistributedCoronationLeaderboardClient } = await import('../DistributedLeaderboard');
    const client = new DistributedCoronationLeaderboardClient();
    await client.getTop(1);

    fullAction.onMessage!([
      { species: 'fox', coronationSeconds: 300, animalsDefeated: 2, playerId: 'peer-a', playerName: 'Hidden Cicada #2', seq: 1 },
      { species: 'bear', coronationSeconds: 800, animalsDefeated: 9, playerId: 'peer-b', playerName: 'Ancient Hornbill #3', seq: 1 },
    ]);

    const top = await client.getTop(10);
    expect(top.map((e) => e.playerId)).toEqual(['peer-a', 'peer-b']);
  });

  it('on a real peer join, hands the newcomer this device\'s full known state (so a fresh peer catches up, not just future updates)', async () => {
    const { DistributedCoronationLeaderboardClient } = await import('../DistributedLeaderboard');
    const client = new DistributedCoronationLeaderboardClient();
    await client.submit({ species: 'fox', coronationSeconds: 450, animalsDefeated: 4 });

    joinHandlers[0]('new-peer-id');

    expect(fullAction.send).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ coronationSeconds: 450 })]),
      { target: 'new-peer-id' },
    );
  });

  it('broadcasts this device\'s own entry over the mesh when it improves', async () => {
    const { DistributedCoronationLeaderboardClient } = await import('../DistributedLeaderboard');
    const client = new DistributedCoronationLeaderboardClient();
    await client.submit({ species: 'fox', coronationSeconds: 450, animalsDefeated: 4 });
    expect(entryAction.send).toHaveBeenCalledWith(expect.objectContaining({ coronationSeconds: 450 }));
  });

  it('persists the merged state locally as real ciphertext, not plaintext (same honesty standard as SaveGame)', async () => {
    const { DistributedCoronationLeaderboardClient } = await import('../DistributedLeaderboard');
    const client = new DistributedCoronationLeaderboardClient();
    await client.submit({ species: 'fox', coronationSeconds: 450, animalsDefeated: 4 });
    const raw = localStorage.getItem('rootwaker.world-leaderboard.v1')!;
    expect(raw).not.toContain('fox');
    expect(raw).not.toContain('450');
  });

  it('a second client instance loads the persisted encrypted state back (cross-session, not per-instance memory)', async () => {
    const mod = await import('../DistributedLeaderboard');
    const clientA = new mod.DistributedCoronationLeaderboardClient();
    await clientA.submit({ species: 'fox', coronationSeconds: 450, animalsDefeated: 4 });

    const clientB = new mod.DistributedCoronationLeaderboardClient();
    const top = await clientB.getTop(10);
    expect(top[0].coronationSeconds).toBe(450);
  });

  it('getTop() resolves (does not reject) when joining the mesh fails — Game.ts calls this with a bare .then(), no .catch(), so a reject here would silently break the real leaderboard panel', async () => {
    getWorldRoomImpl.mockImplementation(() => {
      throw new Error('WebRTC unavailable in this environment');
    });
    const { DistributedCoronationLeaderboardClient } = await import('../DistributedLeaderboard');
    const client = new DistributedCoronationLeaderboardClient();
    await expect(client.getTop(10)).resolves.toEqual([]);
  });

  it('submit() still ranks/persists locally (does not reject) when joining the mesh fails — degrades to local-only rather than breaking the coronation-result toast', async () => {
    getWorldRoomImpl.mockImplementation(() => {
      throw new Error('WebRTC unavailable in this environment');
    });
    const { DistributedCoronationLeaderboardClient } = await import('../DistributedLeaderboard');
    const client = new DistributedCoronationLeaderboardClient();
    const result = await client.submit({ species: 'fox', coronationSeconds: 300, animalsDefeated: 2 });
    expect(result.rank).toBe(1);
    expect(result.top[0].coronationSeconds).toBe(300);
  });

  describe('real input validation on remote data (the world mesh is public/permissionless — any peer can send anything)', () => {
    it('rejects an entry with a huge playerName instead of merging/re-broadcasting it (real DoS/storage-bloat guard)', async () => {
      const { DistributedCoronationLeaderboardClient } = await import('../DistributedLeaderboard');
      const client = new DistributedCoronationLeaderboardClient();
      await client.getTop(1);
      entryAction.onMessage!({
        species: 'fox', coronationSeconds: 100, animalsDefeated: 1,
        playerId: 'attacker', playerName: 'x'.repeat(10_000_000), seq: 1,
      });
      expect(await client.getTop(10)).toHaveLength(0);
    });

    it('rejects an entry with a non-finite coronationSeconds (NaN/Infinity would corrupt the sort)', async () => {
      const { DistributedCoronationLeaderboardClient } = await import('../DistributedLeaderboard');
      const client = new DistributedCoronationLeaderboardClient();
      await client.getTop(1);
      entryAction.onMessage!({
        species: 'fox', coronationSeconds: Infinity, animalsDefeated: 1,
        playerId: 'attacker', playerName: 'Attacker', seq: 1,
      });
      expect(await client.getTop(10)).toHaveLength(0);
    });

    it('rejects an entry with an invalid species (not one of the 3 real playable species)', async () => {
      const { DistributedCoronationLeaderboardClient } = await import('../DistributedLeaderboard');
      const client = new DistributedCoronationLeaderboardClient();
      await client.getTop(1);
      entryAction.onMessage!({
        species: 'dragon', coronationSeconds: 100, animalsDefeated: 1,
        playerId: 'attacker', playerName: 'Attacker', seq: 1,
      });
      expect(await client.getTop(10)).toHaveLength(0);
    });

    it('rejects a malformed/non-object entry entirely (null, a string, a number)', async () => {
      const { DistributedCoronationLeaderboardClient } = await import('../DistributedLeaderboard');
      const client = new DistributedCoronationLeaderboardClient();
      await client.getTop(1);
      entryAction.onMessage!(null);
      entryAction.onMessage!('not an object');
      entryAction.onMessage!(42);
      expect(await client.getTop(10)).toHaveLength(0);
    });

    it('a real full-state sync that is not an array (malformed peer) is dropped without throwing', async () => {
      const { DistributedCoronationLeaderboardClient } = await import('../DistributedLeaderboard');
      const client = new DistributedCoronationLeaderboardClient();
      await client.getTop(1);
      expect(() => fullAction.onMessage!({ not: 'an array' })).not.toThrow();
      expect(await client.getTop(10)).toHaveLength(0);
    });

    it('a full-state sync containing a mix of valid and garbage entries keeps only the valid one', async () => {
      const { DistributedCoronationLeaderboardClient } = await import('../DistributedLeaderboard');
      const client = new DistributedCoronationLeaderboardClient();
      await client.getTop(1);
      fullAction.onMessage!([
        { species: 'fox', coronationSeconds: 400, animalsDefeated: 3, playerId: 'real-peer', playerName: 'Real Peer', seq: 1 },
        { species: 'dragon', coronationSeconds: -1, animalsDefeated: NaN, playerId: 'attacker', playerName: 'x'.repeat(1000), seq: Infinity },
      ]);
      const top = await client.getTop(10);
      expect(top).toHaveLength(1);
      expect(top[0].playerId).toBe('real-peer');
    });

    it('still accepts and ranks a real, well-formed entry normally (validation does not reject legitimate data)', async () => {
      const { DistributedCoronationLeaderboardClient } = await import('../DistributedLeaderboard');
      const client = new DistributedCoronationLeaderboardClient();
      await client.getTop(1);
      entryAction.onMessage!({
        species: 'viper', coronationSeconds: 250, animalsDefeated: 6,
        playerId: 'real-peer', playerName: 'Hidden Cicada #2', seq: 1,
      });
      const top = await client.getTop(10);
      expect(top).toHaveLength(1);
      expect(top[0].coronationSeconds).toBe(250);
    });
  });
});
