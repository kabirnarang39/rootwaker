import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockCoronationLeaderboardClient, type CoronationEntry } from '../CoronationLeaderboard';

// This project has no jsdom (see HUD.controlsLegend.test.ts's own comment for why) and the vitest
// environment is 'node', so there's no real localStorage global — a minimal in-memory stand-in,
// same "just enough surface" philosophy as this project's other fake-DOM harnesses.
function fakeLocalStorage(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => data.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeLocalStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MockCoronationLeaderboardClient', () => {
  it('getTop(n) returns the seed entries on a fresh install, ranked fastest-first', async () => {
    const client = new MockCoronationLeaderboardClient();
    const top = await client.getTop(5);
    expect(top.length).toBe(5);
    for (let i = 1; i < top.length; i++) {
      expect(top[i].coronationSeconds).toBeGreaterThanOrEqual(top[i - 1].coronationSeconds);
    }
  });

  it('submit() ranks a new fast run above every seed entry and reports rank 1', async () => {
    const client = new MockCoronationLeaderboardClient();
    const entry: CoronationEntry = { species: 'viper', coronationSeconds: 1, animalsDefeated: 6 };
    const result = await client.submit(entry);
    expect(result.rank).toBe(1);
    expect(result.top[0]).toEqual(entry);
  });

  it('submit() ranks a slow run below every seed entry', async () => {
    const client = new MockCoronationLeaderboardClient();
    const entry: CoronationEntry = { species: 'bear', coronationSeconds: 99999, animalsDefeated: 20 };
    const result = await client.submit(entry);
    expect(result.rank).toBe(6); // 5 seed entries + this one, all faster
  });

  it('ties on coronationSeconds break on fewer animalsDefeated (a more efficient run outranks an equally-fast one)', async () => {
    const client = new MockCoronationLeaderboardClient();
    await client.submit({ species: 'fox', coronationSeconds: 500, animalsDefeated: 10 });
    const efficientResult = await client.submit({ species: 'fox', coronationSeconds: 500, animalsDefeated: 3 });
    const top = await client.getTop(10);
    const efficientIndex = top.findIndex((e) => e.animalsDefeated === 3 && e.coronationSeconds === 500);
    const inefficientIndex = top.findIndex((e) => e.animalsDefeated === 10 && e.coronationSeconds === 500);
    expect(efficientIndex).toBeLessThan(inefficientIndex);
    expect(efficientResult.rank).toBeLessThan(6); // beats at least one seed entry given its fast time
  });

  it('persists across separate client instances (real localStorage-backed persistence, not per-instance memory)', async () => {
    const clientA = new MockCoronationLeaderboardClient();
    await clientA.submit({ species: 'bear', coronationSeconds: 42, animalsDefeated: 2 });
    const clientB = new MockCoronationLeaderboardClient();
    const top = await clientB.getTop(10);
    expect(top.some((e) => e.coronationSeconds === 42)).toBe(true);
  });

  it('caps at 50 entries, dropping the slowest (5 seed entries all faster than 1000s + 55 new runs at 1000..1054s -> the 10 slowest new runs, 1045..1054, must be dropped)', async () => {
    const client = new MockCoronationLeaderboardClient();
    for (let i = 0; i < 55; i++) {
      await client.submit({ species: 'fox', coronationSeconds: 1000 + i, animalsDefeated: 1 });
    }
    const raw = localStorage.getItem('rootwaker.coronation-leaderboard.v1')!;
    const stored = JSON.parse(raw) as CoronationEntry[];
    expect(stored.length).toBe(50);
    expect(stored.every((e) => e.coronationSeconds < 1045)).toBe(true);
  });
});
