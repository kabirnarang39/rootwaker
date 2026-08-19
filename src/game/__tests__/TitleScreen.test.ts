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

function fakeElement(): any {
  const classSet = new Set<string>();
  const listeners: Record<string, Array<(e: any) => void>> = {};
  const el: any = {
    className: '',
    innerHTML: '',
    textContent: '',
    value: '',
    classList: {
      add: (...names: string[]) => names.forEach((n) => classSet.add(n)),
      remove: (...names: string[]) => names.forEach((n) => classSet.delete(n)),
      contains: (n: string) => classSet.has(n),
    },
    children: [] as any[],
    appendChild: (child: any) => {
      el.children.push(child);
    },
    querySelector: () => fakeElement(),
    addEventListener: (type: string, cb: (e: any) => void) => {
      (listeners[type] ??= []).push(cb);
    },
    remove: vi.fn(),
    focus: () => {},
    select: () => {},
    __fire: (type: string, event: any = {}) => listeners[type]?.forEach((cb) => cb(event)),
  };
  return el;
}

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('localStorage', fakeLocalStorage());
  vi.stubGlobal('document', { createElement: () => fakeElement() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TitleScreen', () => {
  it('appends its panel into the given container and shows the real auto-generated display name', async () => {
    const { TitleScreen } = await import('../TitleScreen');
    const container = fakeElement();
    const screen = new TitleScreen(container);
    expect(container.children.length).toBe(1);
    const nameValueEl = (screen as unknown as { nameValueEl: ReturnType<typeof fakeElement> }).nameValueEl;
    expect(nameValueEl.textContent).toMatch(/^\w+ \w+ #\d{3}$/);
  });

  it('clicking Enter the Jungle resolves whenContinue() and removes the panel', async () => {
    const { TitleScreen } = await import('../TitleScreen');
    const screen = new TitleScreen(fakeElement());
    const beginBtn = (screen as unknown as { beginBtn: ReturnType<typeof fakeElement> }).beginBtn;
    const root = (screen as unknown as { root: ReturnType<typeof fakeElement> }).root;
    const promise = screen.whenContinue();
    beginBtn.__fire('click');
    await promise;
    expect(root.remove).toHaveBeenCalled();
  });

  it('editing the name and clicking Save persists a real chosen name (regression: getDisplayName only ever returned an auto-generated placeholder with no UI to change it)', async () => {
    const { TitleScreen } = await import('../TitleScreen');
    const { getDisplayName } = await import('../../multiplayer/DeviceIdentity');
    const screen = new TitleScreen(fakeElement());
    const h = screen as unknown as {
      nameEditBtn: ReturnType<typeof fakeElement>;
      nameInputEl: ReturnType<typeof fakeElement>;
      nameSaveBtn: ReturnType<typeof fakeElement>;
      nameValueEl: ReturnType<typeof fakeElement>;
    };
    h.nameEditBtn.__fire('click');
    h.nameInputEl.value = 'Real Chosen Name';
    h.nameSaveBtn.__fire('click');
    expect(h.nameValueEl.textContent).toBe('Real Chosen Name');
    expect(getDisplayName()).toBe('Real Chosen Name');
  });

  it('pressing Enter in the name field also saves (not just the Save button)', async () => {
    const { TitleScreen } = await import('../TitleScreen');
    const { getDisplayName } = await import('../../multiplayer/DeviceIdentity');
    const screen = new TitleScreen(fakeElement());
    const h = screen as unknown as {
      nameEditBtn: ReturnType<typeof fakeElement>;
      nameInputEl: ReturnType<typeof fakeElement>;
    };
    h.nameEditBtn.__fire('click');
    h.nameInputEl.value = 'Enter Committed Name';
    h.nameInputEl.__fire('keydown', { key: 'Enter' });
    expect(getDisplayName()).toBe('Enter Committed Name');
  });

  it('an in-progress name edit is committed automatically if the player clicks Enter the Jungle without saving first', async () => {
    const { TitleScreen } = await import('../TitleScreen');
    const { getDisplayName } = await import('../../multiplayer/DeviceIdentity');
    const screen = new TitleScreen(fakeElement());
    const h = screen as unknown as {
      nameEditBtn: ReturnType<typeof fakeElement>;
      nameInputEl: ReturnType<typeof fakeElement>;
      beginBtn: ReturnType<typeof fakeElement>;
    };
    h.nameEditBtn.__fire('click');
    h.nameInputEl.value = 'Committed On Begin';
    const promise = screen.whenContinue();
    h.beginBtn.__fire('click');
    await promise;
    expect(getDisplayName()).toBe('Committed On Begin');
  });
});
