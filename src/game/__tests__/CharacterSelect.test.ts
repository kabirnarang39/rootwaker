import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Same minimal fake-DOM philosophy as HUD.controlsLegend.test.ts (this project deliberately has
// no jsdom dependency — see that file's own comment for why). addEventListener here actually
// stores callbacks (HUD's fake no-ops it) because CharacterSelect's whole interaction model is
// click handlers; a test that can't fire them can't exercise anything.
function fakeElement(): any {
  const classSet = new Set<string>();
  const listeners: Record<string, Array<() => void>> = {};
  const el: any = {
    classList: {
      add: (...names: string[]) => names.forEach((n) => classSet.add(n)),
      remove: (...names: string[]) => names.forEach((n) => classSet.delete(n)),
      toggle: (name: string, force?: boolean) => {
        const on = force ?? !classSet.has(name);
        if (on) classSet.add(name); else classSet.delete(name);
      },
      contains: (n: string) => classSet.has(n),
    },
    style: { setProperty: (name: string, value: string) => { el.style[`--${name.replace(/^--/, '')}`] = value; } },
    className: '',
    innerHTML: '',
    textContent: '',
    children: [] as any[],
    appendChild: (child: any) => { el.children.push(child); },
    querySelector: () => fakeElement(),
    addEventListener: (type: string, cb: () => void) => { (listeners[type] ??= []).push(cb); },
    remove: vi.fn(),
    __fire: (type: string) => listeners[type]?.forEach((cb) => cb()),
  };
  return el;
}

beforeEach(() => {
  vi.stubGlobal('document', { createElement: () => fakeElement() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CharacterSelect — behavior (real instance, fake DOM)', () => {
  it('defaults to fox, first skin, and the panel is appended into the given container', async () => {
    const { CharacterSelect } = await import('../CharacterSelect');
    const container = fakeElement();
    const cs = new CharacterSelect(container);
    expect(container.children.length).toBe(1);
    expect(cs.current()).toEqual({ species: 'fox', skinId: 'ember' });
  });

  it('clicking a species card switches the current species to its own first skin', async () => {
    const { CharacterSelect } = await import('../CharacterSelect');
    const cs = new CharacterSelect(fakeElement());
    const cardEls = (cs as unknown as { cardEls: ReturnType<typeof fakeElement>[] }).cardEls;
    cardEls[1].__fire('click'); // bear card, per SPECIES_ORDER = ['fox','bear','viper']
    expect(cs.current()).toEqual({ species: 'bear', skinId: 'loam' });
  });

  it('clicking next/prev cycles skins within the current species and wraps around', async () => {
    const { CharacterSelect } = await import('../CharacterSelect');
    const cs = new CharacterSelect(fakeElement());
    const nextBtn = (cs as unknown as { nextBtn: ReturnType<typeof fakeElement> }).nextBtn;
    const prevBtn = (cs as unknown as { prevBtn: ReturnType<typeof fakeElement> }).prevBtn;

    nextBtn.__fire('click');
    expect(cs.current()).toEqual({ species: 'fox', skinId: 'moonlit' });
    nextBtn.__fire('click');
    nextBtn.__fire('click'); // wraps past bloodmoon back to ember (3 fox skins)
    expect(cs.current()).toEqual({ species: 'fox', skinId: 'ember' });

    prevBtn.__fire('click'); // wraps backward from ember to bloodmoon
    expect(cs.current()).toEqual({ species: 'fox', skinId: 'bloodmoon' });
  });

  it('skin selection is remembered independently per species when switching back and forth', async () => {
    const { CharacterSelect } = await import('../CharacterSelect');
    const cs = new CharacterSelect(fakeElement());
    const cardEls = (cs as unknown as { cardEls: ReturnType<typeof fakeElement>[] }).cardEls;
    const nextBtn = (cs as unknown as { nextBtn: ReturnType<typeof fakeElement> }).nextBtn;

    nextBtn.__fire('click'); // fox -> moonlit
    cardEls[1].__fire('click'); // switch to bear (starts at its own first skin)
    expect(cs.current()).toEqual({ species: 'bear', skinId: 'loam' });
    cardEls[0].__fire('click'); // switch back to fox
    expect(cs.current()).toEqual({ species: 'fox', skinId: 'moonlit' }); // remembered, not reset
  });

  it('all 6 species are selectable, each with its own real first skin', async () => {
    const { CharacterSelect, SPECIES_ORDER } = await import('../CharacterSelect');
    const cs = new CharacterSelect(fakeElement());
    const cardEls = (cs as unknown as { cardEls: ReturnType<typeof fakeElement>[] }).cardEls;
    expect(SPECIES_ORDER).toEqual(['fox', 'bear', 'viper', 'boar', 'lion', 'crocodile']);
    expect(cardEls.length).toBe(6);
    cardEls[3].__fire('click'); // boar
    expect(cs.current()).toEqual({ species: 'boar', skinId: 'russet' });
    cardEls[4].__fire('click'); // lion
    expect(cs.current()).toEqual({ species: 'lion', skinId: 'gold' });
    cardEls[5].__fire('click'); // crocodile
    expect(cs.current()).toEqual({ species: 'crocodile', skinId: 'river' });
  });

  it('field notes show real wild HP/damage and the ability learned by eating that species, sourced from the same numbers that drive combat', async () => {
    const { CharacterSelect } = await import('../CharacterSelect');
    const cs = new CharacterSelect(fakeElement());
    const cardEls = (cs as unknown as { cardEls: ReturnType<typeof fakeElement>[] }).cardEls;
    const fieldNotesEl = (cs as unknown as { fieldNotesEl: ReturnType<typeof fakeElement> }).fieldNotesEl;

    cardEls[1].__fire('click'); // bear
    expect(fieldNotesEl.innerHTML).toContain('HP 90');
    expect(fieldNotesEl.innerHTML).toContain('Bear Swipe');
  });

  it('the fox card shows real "never hunted in the wild" framing instead of fabricated wild stats', async () => {
    const { CharacterSelect } = await import('../CharacterSelect');
    const cs = new CharacterSelect(fakeElement());
    const fieldNotesEl = (cs as unknown as { fieldNotesEl: ReturnType<typeof fakeElement> }).fieldNotesEl;
    expect(fieldNotesEl.innerHTML).toContain('Never hunted in the wild');
    expect(fieldNotesEl.innerHTML).toContain('Keen Ear');
  });

  it('the live 3D preview stays inert in this fake-DOM/no-WebGL test environment — no renderer is constructed', async () => {
    const { CharacterSelect } = await import('../CharacterSelect');
    const cs = new CharacterSelect(fakeElement());
    expect((cs as unknown as { previewRenderer: unknown }).previewRenderer).toBeNull();
    expect((cs as unknown as { previewCharacter: unknown }).previewCharacter).toBeNull();
  });

  it('whenConfirmed() resolves with the current selection and removes the panel from the document', async () => {
    const { CharacterSelect } = await import('../CharacterSelect');
    const cs = new CharacterSelect(fakeElement());
    const beginBtn = (cs as unknown as { beginBtn: ReturnType<typeof fakeElement> }).beginBtn;
    const root = (cs as unknown as { root: ReturnType<typeof fakeElement> }).root;

    const promise = cs.whenConfirmed();
    beginBtn.__fire('click');
    const result = await promise;

    expect(result).toEqual({ species: 'fox', skinId: 'ember' });
    expect(root.remove).toHaveBeenCalled();
  });
});
