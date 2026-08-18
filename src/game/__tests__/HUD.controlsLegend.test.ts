import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
// Vite's built-in `?raw` suffix imports a file's contents as a plain string — no fs/path
// module or @types/node needed, and works identically under Vitest (same transform pipeline).
import hudSource from '../HUD.ts?raw';

// HUD.ts builds its markup via real `document.createElement`/innerHTML, and this project
// deliberately has no jsdom dependency (see Input.look.test.ts / the camera-relative-movement
// plan's Task 2 fix, which removed jsdom after it broke a fresh clone). A minimal fake
// `document` — just enough surface for HUD's constructor to run without throwing — lets us
// instantiate the REAL HUD class and call its REAL dismissLegend(), rather than parsing markup
// through a hand-rolled HTML tree (a much larger, more fragile stand-in for the same purpose).

// The minimap's real 2D drawing calls (clearRect/fillRect/beginPath/arc/etc.) need a real-shaped
// context object to call methods on, not just a fake canvas element — this stand-in accepts and
// no-ops every draw call HUD.ts's updateMinimap/updateMinimap use, matching this file's existing
// "minimal fake surface, not a full DOM" philosophy.
function fakeContext2D(): any {
  const noop = () => {};
  return {
    clearRect: noop, fillRect: noop, beginPath: noop, moveTo: noop, lineTo: noop,
    stroke: noop, fill: noop, arc: noop, closePath: noop, save: noop, restore: noop,
    translate: noop, rotate: noop, drawImage: noop, strokeRect: noop, fillText: noop,
    fillStyle: '', strokeStyle: '', lineWidth: 0, shadowColor: '', shadowBlur: 0,
    font: '', textAlign: '',
  };
}

function fakeElement(): any {
  const classSet = new Set<string>();
  const setPropertyCalls: [string, string][] = [];
  const el: any = {
    classList: {
      add: (...names: string[]) => names.forEach((n) => classSet.add(n)),
      remove: (...names: string[]) => names.forEach((n) => classSet.delete(n)),
      contains: (n: string) => classSet.has(n),
    },
    style: {
      setProperty: (name: string, value: string) => setPropertyCalls.push([name, value]),
      setPropertyCalls,
    },
    textContent: '',
    value: '',
    width: 150,
    height: 150,
    appendChild: () => {},
    addEventListener: () => {},
    querySelector: () => fakeElement(),
    getContext: () => fakeContext2D(),
  };
  return el;
}

beforeEach(() => {
  vi.stubGlobal('document', {
    createElement: () => fakeElement(),
    head: fakeElement(),
  });
  // showArcComplete/showAbilityUnlocked/showViewMode all use the real global `window` for
  // their auto-dismiss timer (node test environment has no window — see Input.look.test.ts's
  // fakeWindow() for the same reasoning). Fake timers keep the 4s auto-dismiss from actually
  // blocking the test run.
  vi.useFakeTimers();
  vi.stubGlobal('window', {
    setTimeout: (...args: Parameters<typeof setTimeout>) => setTimeout(...args),
    clearTimeout: (...args: Parameters<typeof clearTimeout>) => clearTimeout(...args),
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('HUD controls legend — behavior (real HUD instance, fake DOM)', () => {
  it('is present and visible (no rw-legend-hidden class) right after construction', async () => {
    const { HUD } = await import('../HUD');
    const hud = new HUD(fakeElement() as unknown as HTMLElement);
    const legend = (hud as unknown as { controlsLegendEl: ReturnType<typeof fakeElement> }).controlsLegendEl;
    expect(legend.classList.contains('rw-legend-hidden')).toBe(false);
  });

  it('dismissLegend() fades the panel out by toggling the hidden class', async () => {
    const { HUD } = await import('../HUD');
    const hud = new HUD(fakeElement() as unknown as HTMLElement);
    hud.dismissLegend();
    const legend = (hud as unknown as { controlsLegendEl: ReturnType<typeof fakeElement> }).controlsLegendEl;
    expect(legend.classList.contains('rw-legend-hidden')).toBe(true);
  });
});

describe('HUD controls legend — content (source-text check, no DOM needed)', () => {
  // Checks HUD.ts's own markup template directly rather than parsing it through any DOM
  // stand-in — the most direct, least fragile way to verify the legend's real shipped content.
  const legendMatch = hudSource.match(/<div class="rw-controls-legend">([\s\S]*?)<\/div>\s*<\/div>/);
  if (!legendMatch) throw new Error('rw-controls-legend markup block not found in HUD.ts — has it moved or been renamed?');
  const legendMarkup = legendMatch[1];

  it('has exactly 7 control rows', () => {
    const rowCount = (legendMarkup.match(/rw-legend-row/g) ?? []).length;
    expect(rowCount).toBe(7);
  });

  it('lists only real, currently-bound controls', () => {
    for (const label of ['Move', 'Jump', 'Attack', 'Pounce', 'Look', 'View', 'Powers']) {
      expect(legendMarkup).toContain(`>${label}<`);
    }
  });

  it('does NOT list Dodge or Interact — both keys are bound in Input.ts but Game.ts\'s onAction ignores both, so listing them would be a control that does nothing', () => {
    expect(legendMarkup).not.toMatch(/>Dodge</i);
    expect(legendMarkup).not.toMatch(/>Interact</i);
  });
});

describe('HUD boss bar + arc-complete toast — behavior (real HUD instance, fake DOM)', () => {
  it('showBossBar sets the name label and reveals the panel', async () => {
    const { HUD } = await import('../HUD');
    const hud = new HUD(fakeElement() as unknown as HTMLElement);
    hud.showBossBar('Mountain King');
    const h = hud as unknown as {
      bossNameEl: ReturnType<typeof fakeElement>;
      bossBarEl: ReturnType<typeof fakeElement>;
    };
    expect(h.bossNameEl.textContent).toBe('Mountain King');
    expect(h.bossBarEl.classList.contains('rw-visible')).toBe(true);
  });

  it('updateBossHealth sets the fill custom property proportional to hp/maxHp', async () => {
    const { HUD } = await import('../HUD');
    const hud = new HUD(fakeElement() as unknown as HTMLElement);
    hud.updateBossHealth(110, 220);
    const fillEl = (hud as unknown as { bossHealthFillEl: ReturnType<typeof fakeElement> }).bossHealthFillEl;
    expect(fillEl.style.setPropertyCalls).toContainEqual(['--fill', '50%']);
  });

  it('updateBossHealth clamps out-of-range hp to the 0–100% range', async () => {
    const { HUD } = await import('../HUD');
    const hud = new HUD(fakeElement() as unknown as HTMLElement);
    const fillEl = (hud as unknown as { bossHealthFillEl: ReturnType<typeof fakeElement> }).bossHealthFillEl;

    hud.updateBossHealth(-40, 220);
    expect(fillEl.style.setPropertyCalls).toContainEqual(['--fill', '0%']);

    hud.updateBossHealth(999, 220);
    expect(fillEl.style.setPropertyCalls).toContainEqual(['--fill', '100%']);
  });

  it('updateBossHealth rounds to a clean integer percentage, mirroring updateHealth exactly (regression: a fraction-space clamp with no rounding previously produced long decimals like 33.33333333333333%)', async () => {
    const { HUD } = await import('../HUD');
    const hud = new HUD(fakeElement() as unknown as HTMLElement);
    const fillEl = (hud as unknown as { bossHealthFillEl: ReturnType<typeof fakeElement> }).bossHealthFillEl;

    hud.updateBossHealth(100, 300); // 33.33...% — a ratio that doesn't divide cleanly
    expect(fillEl.style.setPropertyCalls).toContainEqual(['--fill', '33%']);
  });

  it('hideBossBar removes the visible class', async () => {
    const { HUD } = await import('../HUD');
    const hud = new HUD(fakeElement() as unknown as HTMLElement);
    hud.showBossBar('Mountain King');
    hud.hideBossBar();
    const bossBarEl = (hud as unknown as { bossBarEl: ReturnType<typeof fakeElement> }).bossBarEl;
    expect(bossBarEl.classList.contains('rw-visible')).toBe(false);
  });

  it('showArcComplete adds the visible class to the arc-complete toast', async () => {
    const { HUD } = await import('../HUD');
    const hud = new HUD(fakeElement() as unknown as HTMLElement);
    hud.showArcComplete();
    const arcCompleteEl = (hud as unknown as { arcCompleteEl: ReturnType<typeof fakeElement> }).arcCompleteEl;
    expect(arcCompleteEl.classList.contains('rw-visible')).toBe(true);
  });

  it('showCoronationResult renders rank/stats and reveals the panel without throwing', async () => {
    const { HUD } = await import('../HUD');
    const hud = new HUD(fakeElement() as unknown as HTMLElement);
    const myEntry = { species: 'bear' as const, coronationSeconds: 125, animalsDefeated: 7 };
    const top = [myEntry, { species: 'fox' as const, coronationSeconds: 400, animalsDefeated: 12 }];
    expect(() => hud.showCoronationResult(1, top, myEntry)).not.toThrow();
    const h = hud as unknown as {
      coronationResultEl: ReturnType<typeof fakeElement>;
      coronationRankEl: ReturnType<typeof fakeElement>;
      coronationStatsEl: ReturnType<typeof fakeElement>;
    };
    expect(h.coronationResultEl.classList.contains('rw-visible')).toBe(true);
    expect(h.coronationRankEl.textContent).toBe('Rank #1');
    expect(h.coronationStatsEl.textContent).toBe('2:05 · 7 defeated');
  });
});

describe('HUD story beat — behavior (real HUD instance, fake DOM)', () => {
  it('showStoryBeat sets the eyebrow/text content and reveals the panel', async () => {
    const { HUD } = await import('../HUD');
    const hud = new HUD(fakeElement() as unknown as HTMLElement);
    hud.showStoryBeat('Old Strength', 'The Grove Bear rises.');
    const h = hud as unknown as {
      storyEyebrowEl: ReturnType<typeof fakeElement>;
      storyTextEl: ReturnType<typeof fakeElement>;
      storyBeatEl: ReturnType<typeof fakeElement>;
    };
    expect(h.storyEyebrowEl.textContent).toBe('Old Strength');
    expect(h.storyTextEl.textContent).toBe('The Grove Bear rises.');
    expect(h.storyBeatEl.classList.contains('rw-visible')).toBe(true);
  });
});

describe('HUD minimap — behavior (real HUD instance, fake DOM + fake 2D context)', () => {
  const world = {
    bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    mountainBase: { x: -12, z: 8 },
    mountainSummit: { x: -12, z: 8.4 },
    water: { minX: 2, maxX: 10, minZ: -7, maxZ: -1 },
    groundHeightAt: (x: number, z: number) => Math.sin(x * 0.15) + Math.cos(z * 0.12),
  };

  it('updateMinimap is a real no-op before initMinimap() has ever been called (must not throw)', async () => {
    const { HUD } = await import('../HUD');
    const hud = new HUD(fakeElement() as unknown as HTMLElement);
    expect(() => hud.updateMinimap(0, 0, 0)).not.toThrow();
  });

  it('initMinimap + updateMinimap draws without throwing for a real set of world coordinates', async () => {
    const { HUD } = await import('../HUD');
    const hud = new HUD(fakeElement() as unknown as HTMLElement);
    hud.initMinimap(world);
    expect(() => hud.updateMinimap(0, 12, Math.PI / 3)).not.toThrow();
  });

  it('the world-to-canvas projection places a point at the bounds center at the canvas center', async () => {
    const { HUD } = await import('../HUD');
    const hud = new HUD(fakeElement() as unknown as HTMLElement);
    hud.initMinimap(world);
    const project = (hud as unknown as { minimapProject: (x: number, z: number) => { x: number; y: number } }).minimapProject.bind(hud);
    const center = project(0, 0); // exact center of bounds { minX:-20,maxX:20,minZ:-20,maxZ:20 }
    expect(center.x).toBeCloseTo(75, 5); // canvas width 150 / 2
    expect(center.y).toBeCloseTo(75, 5); // canvas height 150 / 2
  });

  it('the world-to-canvas projection places a point at the bounds min corner at the canvas origin', async () => {
    const { HUD } = await import('../HUD');
    const hud = new HUD(fakeElement() as unknown as HTMLElement);
    hud.initMinimap(world);
    const project = (hud as unknown as { minimapProject: (x: number, z: number) => { x: number; y: number } }).minimapProject.bind(hud);
    const origin = project(world.bounds.minX, world.bounds.minZ);
    expect(origin.x).toBeCloseTo(0, 5);
    expect(origin.y).toBeCloseTo(0, 5);
  });

  it('initMinimap bakes a real terrain backdrop by actually sampling groundHeightAt across a grid (regression: a flat color wash needs zero real terrain samples — this proves the contour is real, not decorative)', async () => {
    const { HUD } = await import('../HUD');
    const hud = new HUD(fakeElement() as unknown as HTMLElement);
    const heightSpy = vi.fn((x: number, z: number) => Math.sin(x) + Math.cos(z));
    hud.initMinimap({ ...world, groundHeightAt: heightSpy });
    expect(heightSpy).toHaveBeenCalled();
    expect(heightSpy.mock.calls.length).toBeGreaterThanOrEqual(32 * 32); // GRID x GRID in buildMinimapTerrainBackdrop
  });

  it('updateMinimap draws the coastline ring and compass ticks without throwing (real full-island sea + compass, not just the old flat wash)', async () => {
    const { HUD } = await import('../HUD');
    const hud = new HUD(fakeElement() as unknown as HTMLElement);
    hud.initMinimap(world);
    expect(() => hud.updateMinimap(5, -3, 1.2)).not.toThrow();
  });
});
