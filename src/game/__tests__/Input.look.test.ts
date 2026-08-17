import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Input } from '../Input';

// Fake element with addEventListener, since Input's constructor takes an HTMLElement
function fakeElement() {
  const listeners: Record<string, ((e: any) => void)[]> = {};
  return {
    addEventListener: (type: string, handler: (e: any) => void) => {
      (listeners[type] ??= []).push(handler);
    },
    dispatch: (type: string, event: any) => {
      (listeners[type] ?? []).forEach((h) => h(event));
    },
  };
}

// Input's constructor also attaches keydown/keyup listeners to the real global `window`.
// Stub a minimal window + KeyboardEvent here (node test environment has neither) rather
// than pulling in jsdom as a dependency just to run this one file.
function fakeWindow() {
  const listeners: Record<string, ((e: any) => void)[]> = {};
  return {
    addEventListener: (type: string, handler: (e: any) => void) => {
      (listeners[type] ??= []).push(handler);
    },
    removeEventListener: (type: string, handler: (e: any) => void) => {
      const arr = listeners[type];
      if (!arr) return;
      const i = arr.indexOf(handler);
      if (i >= 0) arr.splice(i, 1);
    },
    dispatchEvent: (event: { type: string }) => {
      (listeners[event.type] ?? []).forEach((h) => h(event));
    },
  };
}

class FakeKeyboardEvent {
  type: string;
  code: string;
  constructor(type: string, init: { code: string }) {
    this.type = type;
    this.code = init.code;
  }
}

beforeEach(() => {
  vi.stubGlobal('window', fakeWindow());
  vi.stubGlobal('KeyboardEvent', FakeKeyboardEvent);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Input mouse-drag look', () => {
  it('accumulates a look delta between mousedown-drag-mouseup and reports it once via pollLook', () => {
    const el = fakeElement();
    const input = new Input(el as unknown as HTMLElement);
    let reportedYaw = 0;
    let reportedPitch = 0;
    input.onLook((dy, dp) => {
      reportedYaw += dy;
      reportedPitch += dp;
    });

    el.dispatch('mousedown', { clientX: 100, clientY: 100, button: 0 });
    el.dispatch('mousemove', { clientX: 130, clientY: 100 }); // moved 30px right -> positive yaw delta
    input.pollLook();
    expect(reportedYaw).toBeGreaterThan(0);
  });

  it('reports zero look delta when no drag has occurred', () => {
    const el = fakeElement();
    const input = new Input(el as unknown as HTMLElement);
    let calls = 0;
    let lastYaw = -999;
    input.onLook((dy) => {
      calls++;
      lastYaw = dy;
    });
    input.pollLook();
    expect(calls).toBe(1);
    expect(lastYaw).toBe(0);
  });

  it('mouseup stops further drag accumulation', () => {
    const el = fakeElement();
    const input = new Input(el as unknown as HTMLElement);
    let totalYaw = 0;
    input.onLook((dy) => {
      totalYaw += dy;
    });

    el.dispatch('mousedown', { clientX: 100, clientY: 100, button: 0 });
    el.dispatch('mousemove', { clientX: 150, clientY: 100 });
    input.pollLook();
    const afterFirstDrag = totalYaw;
    el.dispatch('mouseup', {});
    el.dispatch('mousemove', { clientX: 200, clientY: 100 }); // should be ignored, no active drag
    input.pollLook();
    expect(totalYaw).toBe(afterFirstDrag);
  });

  it('KeyC emits a cycleView action', () => {
    const el = fakeElement();
    const input = new Input(el as unknown as HTMLElement);
    let firedAction: string | null = null;
    input.onAction((action) => {
      firedAction = action;
    });
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyC' }));
    expect(firedAction).toBe('cycleView');
  });

  it('Digit5 emits an ability5 action', () => {
    const el = fakeElement();
    const input = new Input(el as unknown as HTMLElement);
    let firedAction: string | null = null;
    input.onAction((action) => {
      firedAction = action;
    });
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit5' }));
    expect(firedAction).toBe('ability5');
  });

  it('Digit6 emits an ability6 action', () => {
    const el = fakeElement();
    const input = new Input(el as unknown as HTMLElement);
    let firedAction: string | null = null;
    input.onAction((action) => {
      firedAction = action;
    });
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit6' }));
    expect(firedAction).toBe('ability6');
  });
});
