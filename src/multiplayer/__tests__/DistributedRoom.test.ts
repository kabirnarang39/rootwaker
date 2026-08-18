import { describe, it, expect, vi, beforeEach } from 'vitest';

const fakeRoom = {
  makeAction: vi.fn(),
  ping: vi.fn(),
  leave: vi.fn(),
  isPassive: vi.fn(),
  getPeers: vi.fn(() => ({ 'peer-a': {}, 'peer-b': {} })),
  addStream: vi.fn(),
  removeStream: vi.fn(),
  addTrack: vi.fn(),
  removeTrack: vi.fn(),
  replaceTrack: vi.fn(),
  onPeerJoin: null as ((peerId: string) => void) | null,
  onPeerLeave: null as ((peerId: string) => void) | null,
  onPeerStream: null,
  onPeerTrack: null,
};

const joinRoom = vi.fn((_config: unknown, _roomId: unknown) => fakeRoom);

vi.mock('trystero', () => ({ joinRoom: (config: unknown, roomId: unknown) => joinRoom(config, roomId) }));

beforeEach(() => {
  vi.resetModules();
  joinRoom.mockClear();
});

describe('DistributedRoom', () => {
  it('joins the world mesh lazily — not until a consumer actually calls in', async () => {
    expect(joinRoom).not.toHaveBeenCalled();
    const { getWorldRoom } = await import('../DistributedRoom');
    getWorldRoom();
    expect(joinRoom).toHaveBeenCalledTimes(1);
    expect(joinRoom).toHaveBeenCalledWith({ appId: 'rootwaker-v1' }, 'world');
  });

  it('joins exactly once even across multiple calls (singleton, not a fresh mesh join per consumer)', async () => {
    const { getWorldRoom, onPeerJoin } = await import('../DistributedRoom');
    getWorldRoom();
    onPeerJoin(() => {});
    getWorldRoom();
    expect(joinRoom).toHaveBeenCalledTimes(1);
  });

  it('fans a single real onPeerJoin assignment out to every registered handler', async () => {
    const { onPeerJoin } = await import('../DistributedRoom');
    const seenA: string[] = [];
    const seenB: string[] = [];
    onPeerJoin((id) => seenA.push(id));
    onPeerJoin((id) => seenB.push(id));
    fakeRoom.onPeerJoin!('peer-x');
    expect(seenA).toEqual(['peer-x']);
    expect(seenB).toEqual(['peer-x']);
  });

  it('fans a single real onPeerLeave assignment out to every registered handler', async () => {
    const { onPeerLeave } = await import('../DistributedRoom');
    const seen: string[] = [];
    onPeerLeave((id) => seen.push(id));
    fakeRoom.onPeerLeave!('peer-y');
    expect(seen).toEqual(['peer-y']);
  });

  it('getConnectedPeerIds reflects the real room.getPeers() keys', async () => {
    const { getConnectedPeerIds } = await import('../DistributedRoom');
    expect(getConnectedPeerIds()).toEqual(['peer-a', 'peer-b']);
  });
});
