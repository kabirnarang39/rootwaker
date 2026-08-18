import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ResumeGate } from '../ResumeGate';
import type { GameSaveState } from '../SaveGame';

function fakeElement(): any {
  const listeners: Record<string, Array<() => void>> = {};
  const el: any = {
    className: '',
    innerHTML: '',
    children: [] as any[],
    appendChild: (child: any) => {
      el.children.push(child);
    },
    querySelector: () => fakeElement(),
    addEventListener: (type: string, cb: () => void) => {
      (listeners[type] ??= []).push(cb);
    },
    remove: vi.fn(),
    __fire: (type: string) => listeners[type]?.forEach((cb) => cb()),
  };
  return el;
}

const sampleSave: GameSaveState = {
  species: 'viper',
  skinId: 'vine',
  checkpointX: 0,
  checkpointY: 0,
  checkpointZ: 12,
  hp: 60,
  maxHp: 100,
  unlockedAbilities: ['keen-ear'],
  animalsDefeated: 3,
  kingDefeated: false,
  coronationSeconds: null,
  savedAt: Date.now(),
};

beforeEach(() => {
  vi.stubGlobal('document', { createElement: () => fakeElement() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ResumeGate', () => {
  it('appends its panel into the given container', () => {
    const container = fakeElement();
    new ResumeGate(container, sampleSave);
    expect(container.children.length).toBe(1);
  });

  it('clicking Continue resolves whenDecided() with {action: "resume"} and removes the panel', async () => {
    const gate = new ResumeGate(fakeElement(), sampleSave);
    const resumeBtn = (gate as unknown as { resumeBtn: ReturnType<typeof fakeElement> }).resumeBtn;
    const root = (gate as unknown as { root: ReturnType<typeof fakeElement> }).root;
    const promise = gate.whenDecided();
    resumeBtn.__fire('click');
    const decision = await promise;
    expect(decision).toEqual({ action: 'resume' });
    expect(root.remove).toHaveBeenCalled();
  });

  it('clicking Begin Anew resolves whenDecided() with {action: "new-game"}', async () => {
    const gate = new ResumeGate(fakeElement(), sampleSave);
    const newGameBtn = (gate as unknown as { newGameBtn: ReturnType<typeof fakeElement> }).newGameBtn;
    const promise = gate.whenDecided();
    newGameBtn.__fire('click');
    const decision = await promise;
    expect(decision).toEqual({ action: 'new-game' });
  });
});
