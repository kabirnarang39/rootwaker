import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// HUD.ts builds its markup via innerHTML + querySelector and has no test file yet (the node
// test environment here has no jsdom — see Input.look.test.ts for the same constraint on
// Input.ts). Rather than pulling in jsdom as a dependency just for this one file, this is a
// minimal hand-rolled DOM: enough to parse HUD's fixed innerHTML template into a tree, resolve
// class-selector querySelector lookups, and track classList state. State-based assertions only
// (does the legend panel carry the dismissed class after dismissLegend()?), not a snapshot of
// rendered markup.

class FakeClassList {
  private set = new Set<string>();
  constructor(initial: string) {
    initial.split(/\s+/).filter(Boolean).forEach((c) => this.set.add(c));
  }
  add(...names: string[]) {
    names.forEach((n) => this.set.add(n));
  }
  remove(...names: string[]) {
    names.forEach((n) => this.set.delete(n));
  }
  toggle(name: string, force?: boolean) {
    const on = force ?? !this.set.has(name);
    if (on) this.set.add(name);
    else this.set.delete(name);
  }
  contains(name: string) {
    return this.set.has(name);
  }
}

class FakeElement {
  tag: string;
  classList: FakeClassList;
  children: FakeElement[] = [];
  style: Record<string, unknown> = { setProperty: () => {} };
  textContent = '';
  value = '';
  onclick: (() => void) | null = null;
  onsubmit: ((e: unknown) => void) | null = null;
  private _innerHTML = '';

  constructor(tag: string, classAttr = '') {
    this.tag = tag;
    this.classList = new FakeClassList(classAttr);
  }

  appendChild(child: FakeElement) {
    this.children.push(child);
    return child;
  }

  addEventListener() {
    /* no-op: nothing in this test dispatches DOM events */
  }

  set innerHTML(html: string) {
    this._innerHTML = html;
    this.children = parseChildren(html);
  }
  get innerHTML() {
    return this._innerHTML;
  }

  querySelector(selector: string): FakeElement | null {
    const cls = selector.replace(/^\./, '');
    const stack = [...this.children];
    while (stack.length) {
      const node = stack.shift()!;
      if (node.classList.contains(cls)) return node;
      stack.push(...node.children);
    }
    return null;
  }
}

/** Tiny stack-based tag parser: only needs class attrs + nesting, text/other attrs are discarded. */
function parseChildren(html: string): FakeElement[] {
  const roots: FakeElement[] = [];
  const stack: FakeElement[] = [];
  const tagRe = /<\/?[a-zA-Z][a-zA-Z0-9]*(?:\s+[^<>]*)?\/?>/g;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(html))) {
    const tagStr = match[0];
    if (tagStr.startsWith('</')) {
      stack.pop();
      continue;
    }
    const nameMatch = /^<([a-zA-Z0-9]+)/.exec(tagStr)!;
    const tagName = nameMatch[1];
    const classMatch = /class="([^"]*)"/.exec(tagStr);
    const el = new FakeElement(tagName, classMatch ? classMatch[1] : '');
    const parent = stack[stack.length - 1];
    if (parent) parent.children.push(el);
    else roots.push(el);
    if (!tagStr.endsWith('/>')) stack.push(el);
  }
  return roots;
}

function fakeDocument() {
  const head = new FakeElement('head');
  return {
    createElement: (tag: string) => new FakeElement(tag),
    head,
  };
}

beforeEach(() => {
  vi.stubGlobal('document', fakeDocument());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('HUD controls legend', () => {
  it('is present and visible (no rw-legend-hidden class) right after construction', async () => {
    const { HUD } = await import('../HUD');
    const container = new FakeElement('div');
    const hud = new HUD(container as unknown as HTMLElement);
    const legend = (hud as unknown as { controlsLegendEl: FakeElement }).controlsLegendEl;
    expect(legend).toBeTruthy();
    expect(legend.classList.contains('rw-legend-hidden')).toBe(false);
  });

  it('dismissLegend() fades the panel out by toggling the hidden class', async () => {
    const { HUD } = await import('../HUD');
    const container = new FakeElement('div');
    const hud = new HUD(container as unknown as HTMLElement);
    hud.dismissLegend();
    const legend = (hud as unknown as { controlsLegendEl: FakeElement }).controlsLegendEl;
    expect(legend.classList.contains('rw-legend-hidden')).toBe(true);
  });

  it('lists only real, currently-bound controls (no dead dodge/interact keys)', async () => {
    const { HUD } = await import('../HUD');
    const container = new FakeElement('div');
    const hud = new HUD(container as unknown as HTMLElement);
    const legend = (hud as unknown as { controlsLegendEl: FakeElement }).controlsLegendEl;
    // this test's fake parser discards text nodes, so shape (row/key/label presence) is
    // asserted rather than the label text itself: exactly 6 control rows (move/jump/attack/
    // pounce/look/view) — dodge (K) and interact (E) are bound in Input.ts but Game.ts's
    // onAction ignores both, so they must not appear here.
    const rows = legend.children.filter((c) => c.classList.contains('rw-legend-row'));
    expect(rows.length).toBe(6);
    rows.forEach((row) => {
      expect(row.children.some((c) => c.classList.contains('rw-legend-key'))).toBe(true);
      expect(row.children.some((c) => c.classList.contains('rw-legend-label'))).toBe(true);
    });
  });
});
