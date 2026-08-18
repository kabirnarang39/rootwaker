import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DeviceIdentity', () => {
  it('getDeviceId generates a real UUID and returns the same value on every subsequent call', async () => {
    const { getDeviceId } = await import('../DeviceIdentity');
    const first = getDeviceId();
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(getDeviceId()).toBe(first);
  });

  it('getDeviceId persists across a fresh module instance (real cross-session stability)', async () => {
    const { getDeviceId: getA } = await import('../DeviceIdentity');
    const id = getA();
    vi.resetModules();
    const { getDeviceId: getB } = await import('../DeviceIdentity');
    expect(getB()).toBe(id);
  });

  it('getDeviceId stays stable within one session even when localStorage is unavailable (in-memory cache fallback)', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    } as unknown as Storage);
    const { getDeviceId } = await import('../DeviceIdentity');
    const first = getDeviceId();
    expect(getDeviceId()).toBe(first);
  });

  it('getDisplayName auto-generates a real "Adjective Noun #NNN" name and persists it', async () => {
    const { getDisplayName } = await import('../DeviceIdentity');
    const name = getDisplayName();
    expect(name).toMatch(/^\w+ \w+ #\d{3}$/);
    expect(getDisplayName()).toBe(name);
  });

  it('setDisplayName trims whitespace and caps length at 24 characters', async () => {
    const { setDisplayName, getDisplayName } = await import('../DeviceIdentity');
    setDisplayName('  ' + 'x'.repeat(40) + '  ');
    expect(getDisplayName()).toBe('x'.repeat(24));
  });

  it('setDisplayName ignores an empty/whitespace-only name — the previous name stays', async () => {
    const { setDisplayName, getDisplayName } = await import('../DeviceIdentity');
    const original = getDisplayName();
    setDisplayName('   ');
    expect(getDisplayName()).toBe(original);
  });

  it('setDisplayName persists across a fresh module instance', async () => {
    const { setDisplayName } = await import('../DeviceIdentity');
    setDisplayName('Real Chosen Name');
    vi.resetModules();
    const { getDisplayName } = await import('../DeviceIdentity');
    expect(getDisplayName()).toBe('Real Chosen Name');
  });
});
