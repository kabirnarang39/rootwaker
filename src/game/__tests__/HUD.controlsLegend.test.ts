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

function fakeElement(): any {
  const classSet = new Set<string>();
  const el: any = {
    classList: {
      add: (...names: string[]) => names.forEach((n) => classSet.add(n)),
      remove: (...names: string[]) => names.forEach((n) => classSet.delete(n)),
      contains: (n: string) => classSet.has(n),
    },
    style: { setProperty: () => {} },
    textContent: '',
    value: '',
    appendChild: () => {},
    addEventListener: () => {},
    querySelector: () => fakeElement(),
  };
  return el;
}

beforeEach(() => {
  vi.stubGlobal('document', {
    createElement: () => fakeElement(),
    head: fakeElement(),
  });
});

afterEach(() => {
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

  it('has exactly 6 control rows', () => {
    const rowCount = (legendMarkup.match(/rw-legend-row/g) ?? []).length;
    expect(rowCount).toBe(6);
  });

  it('lists only real, currently-bound controls', () => {
    for (const label of ['Move', 'Jump', 'Attack', 'Pounce', 'Look', 'View']) {
      expect(legendMarkup).toContain(`>${label}<`);
    }
  });

  it('does NOT list Dodge or Interact — both keys are bound in Input.ts but Game.ts\'s onAction ignores both, so listing them would be a control that does nothing', () => {
    expect(legendMarkup).not.toMatch(/>Dodge</i);
    expect(legendMarkup).not.toMatch(/>Interact</i);
  });
});
