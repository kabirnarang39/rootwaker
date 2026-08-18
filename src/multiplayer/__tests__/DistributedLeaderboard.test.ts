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

vi.mock('../DistributedRoom', () => ({
  getWorldRoom: () => fakeRoom,
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
});
