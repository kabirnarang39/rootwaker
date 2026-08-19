import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SaveGame, type GameSaveState } from '../SaveGame';

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

const sampleState: GameSaveState = {
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

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeLocalStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SaveGame', () => {
  it('load() returns null when there is no save yet', async () => {
    const save = new SaveGame();
    expect(await save.load()).toBeNull();
  });

  it('save() then load() round-trips the exact state', async () => {
    const save = new SaveGame();
    await save.save(sampleState);
    const loaded = await save.load();
    expect(loaded).toEqual(sampleState);
  });

  it('the stored blob is real ciphertext, not plaintext JSON (regression: an unencrypted save would let a player just edit HP/abilities in devtools)', async () => {
    const save = new SaveGame();
    await save.save(sampleState);
    const raw = localStorage.getItem('rootwaker.save.v1')!;
    // Checks the real JSON key:value structure, not a bare short word — a bare 3-4 char
    // substring like "bear" has a real, non-negligible chance of appearing by pure coincidence
    // in ~200 characters of random-looking base64 ciphertext (confirmed live: this exact class
    // of check flaked a real CI run with a different short substring in a sibling test file).
    // The full structural substring below is long enough that a chance collision is effectively
    // impossible, while still proving the real thing this test cares about: the stored blob
    // isn't naive plaintext JSON.
    expect(raw).not.toContain(`"species":"${sampleState.species}"`);
    expect(raw).not.toContain('"animalsDefeated"');
    // But it IS real structured payload (iv + ciphertext), not garbage.
    const payload = JSON.parse(raw);
    expect(typeof payload.iv).toBe('string');
    expect(typeof payload.data).toBe('string');
  });

  it('clear() removes the save; load() then returns null again', async () => {
    const save = new SaveGame();
    await save.save(sampleState);
    save.clear();
    expect(await save.load()).toBeNull();
  });

  it('a tampered ciphertext fails to decrypt and load() returns null rather than throwing or returning corrupt data (AES-GCM auth tag catches tampering)', async () => {
    const save = new SaveGame();
    await save.save(sampleState);
    const raw = JSON.parse(localStorage.getItem('rootwaker.save.v1')!);
    // Flip a character in the ciphertext — GCM's auth tag must reject this.
    raw.data = raw.data.slice(0, -4) + (raw.data.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA');
    localStorage.setItem('rootwaker.save.v1', JSON.stringify(raw));
    expect(await save.load()).toBeNull();
  });

  it('a second SaveGame instance reuses the same persisted key and can decrypt a save written by the first (real cross-session persistence, not per-instance memory)', async () => {
    const saveA = new SaveGame();
    await saveA.save(sampleState);
    const saveB = new SaveGame();
    const loaded = await saveB.load();
    expect(loaded).toEqual(sampleState);
  });

  it('save() does not throw when localStorage is unavailable (private browsing / quota)', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded');
      },
      removeItem: () => {},
    } as unknown as Storage);
    const save = new SaveGame();
    await expect(save.save(sampleState)).resolves.not.toThrow();
  });

  it('load() returns null (not throws) when localStorage.getItem itself throws — a real gap the setItem-only test above didn\'t cover', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('storage access blocked');
      },
      setItem: () => {},
      removeItem: () => {},
    } as unknown as Storage);
    const save = new SaveGame();
    await expect(save.load()).resolves.toBeNull();
  });

  it('a real save missing a newer field (an older schema version) is rejected — load() returns null rather than handing malformed state to the resume path (regression: Game.ts does `for (const id of resume.unlockedAbilities)`, which throws on undefined, and `body.position.set(resume.checkpointX, ...)`, which would silently poison physics with NaN)', async () => {
    const save = new SaveGame();
    // Simulate an older save missing unlockedAbilities entirely — a real, plausible scenario
    // given this project's own GameSaveState has grown fields over time.
    const { unlockedAbilities: _unused, ...withoutAbilities } = sampleState;
    await save.save(withoutAbilities as GameSaveState);
    expect(await save.load()).toBeNull();
  });

  it('a save with a NaN/non-finite checkpoint coordinate is rejected — never lets a corrupted position reach body.position.set()', async () => {
    const save = new SaveGame();
    await save.save({ ...sampleState, checkpointX: NaN });
    expect(await save.load()).toBeNull();
  });

  it('a save with a non-array unlockedAbilities is rejected', async () => {
    const save = new SaveGame();
    await save.save({ ...sampleState, unlockedAbilities: 'bear-swipe' } as unknown as GameSaveState);
    expect(await save.load()).toBeNull();
  });

  it('a save with maxHp <= 0 is rejected — a real save can never have zero max health', async () => {
    const save = new SaveGame();
    await save.save({ ...sampleState, maxHp: 0 });
    expect(await save.load()).toBeNull();
  });

  it('a real valid save with coronationSeconds actually set (not null) still round-trips correctly', async () => {
    const save = new SaveGame();
    const withCoronation: GameSaveState = { ...sampleState, kingDefeated: true, coronationSeconds: 342.5 };
    await save.save(withCoronation);
    expect(await save.load()).toEqual(withCoronation);
  });

  it('clear() does not throw when localStorage.removeItem throws', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {
        throw new Error('storage access blocked');
      },
    } as unknown as Storage);
    const save = new SaveGame();
    expect(() => save.clear()).not.toThrow();
  });
});
