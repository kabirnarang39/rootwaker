import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { encryptJSON, decryptJSON, safeGetItem, safeSetItem } from '../crypto';

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
  vi.stubGlobal('localStorage', fakeLocalStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('encryptJSON / decryptJSON', () => {
  it('round-trips an arbitrary JSON-safe value exactly', async () => {
    const value = { a: 1, b: 'two', c: [3, 4, 5], d: null };
    const payload = await encryptJSON(value);
    expect(await decryptJSON(payload)).toEqual(value);
  });

  it('the stored payload is real ciphertext, not plaintext JSON', async () => {
    const payload = await encryptJSON({ secret: 'do-not-leak-this-string' });
    expect(payload).not.toContain('do-not-leak-this-string');
    const parsed = JSON.parse(payload);
    expect(typeof parsed.iv).toBe('string');
    expect(typeof parsed.data).toBe('string');
  });

  it('decryptJSON returns null (not throws) for a tampered ciphertext', async () => {
    const payload = await encryptJSON({ x: 1 });
    const parsed = JSON.parse(payload);
    parsed.data = parsed.data.slice(0, -4) + (parsed.data.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA');
    expect(await decryptJSON(JSON.stringify(parsed))).toBeNull();
  });

  it('decryptJSON returns null (not throws) for garbage input', async () => {
    expect(await decryptJSON('not even json')).toBeNull();
  });

  it('a second encrypt/decrypt call reuses the same persisted key (real cross-call persistence)', async () => {
    const payloadA = await encryptJSON({ v: 'a' });
    const payloadB = await encryptJSON({ v: 'b' });
    expect(await decryptJSON(payloadA)).toEqual({ v: 'a' });
    expect(await decryptJSON(payloadB)).toEqual({ v: 'b' });
  });

  it('encryptJSON does not throw when localStorage.getItem itself throws (regression: getOrCreateKey used to read the key with an unguarded getItem, contradicting every caller\'s own "never throws" contract)', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('storage access blocked');
      },
      setItem: () => {},
    } as unknown as Storage);
    await expect(encryptJSON({ x: 1 })).resolves.not.toThrow();
  });
});

describe('safeGetItem / safeSetItem', () => {
  it('safeGetItem returns the real stored value on success', () => {
    safeSetItem('k', 'v');
    expect(safeGetItem('k')).toBe('v');
  });

  it('safeGetItem returns null (not throws) when localStorage.getItem itself throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('storage access blocked');
      },
    } as unknown as Storage);
    expect(() => safeGetItem('k')).not.toThrow();
    expect(safeGetItem('k')).toBeNull();
  });

  it('safeSetItem does not throw when localStorage.setItem itself throws', () => {
    vi.stubGlobal('localStorage', {
      setItem: () => {
        throw new Error('quota exceeded');
      },
    } as unknown as Storage);
    expect(() => safeSetItem('k', 'v')).not.toThrow();
  });
});
