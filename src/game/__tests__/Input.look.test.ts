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
  defaultPrevented = false;
  constructor(type: string, init: { code: string }) {
    this.type = type;
    this.code = init.code;
  }
  preventDefault() {
    this.defaultPrevented = true;
  }
}

beforeEach(() => {
  vi.stubGlobal('window', fakeWindow());
  vi.stubGlobal('KeyboardEvent', FakeKeyboardEvent);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Input pointer-drag look (mouse AND touch — both dispatch PointerEvent)', () => {
  it('accumulates a look delta between pointerdown-drag-pointerup and reports it once via pollLook', () => {
    const el = fakeElement();
    const input = new Input(el as unknown as HTMLElement);
    let reportedYaw = 0;
    let reportedPitch = 0;
    input.onLook((dy, dp) => {
      reportedYaw += dy;
      reportedPitch += dp;
    });

    el.dispatch('pointerdown', { clientX: 100, clientY: 100, button: 0 });
    el.dispatch('pointermove', { clientX: 130, clientY: 100 }); // moved 30px right -> positive yaw delta
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

  it('pointerup stops further drag accumulation', () => {
    const el = fakeElement();
    const input = new Input(el as unknown as HTMLElement);
    let totalYaw = 0;
    input.onLook((dy) => {
      totalYaw += dy;
    });

    el.dispatch('pointerdown', { clientX: 100, clientY: 100, button: 0 });
    el.dispatch('pointermove', { clientX: 150, clientY: 100 });
    input.pollLook();
    const afterFirstDrag = totalYaw;
    el.dispatch('pointerup', {});
    el.dispatch('pointermove', { clientX: 200, clientY: 100 }); // should be ignored, no active drag
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

  it('Digit7 emits an ability7 action', () => {
    const el = fakeElement();
    const input = new Input(el as unknown as HTMLElement);
    let firedAction: string | null = null;
    input.onAction((action) => {
      firedAction = action;
    });
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit7' }));
    expect(firedAction).toBe('ability7');
  });

  it('Digit8 emits an ability8 action', () => {
    const el = fakeElement();
    const input = new Input(el as unknown as HTMLElement);
    let firedAction: string | null = null;
    input.onAction((action) => {
      firedAction = action;
    });
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit8' }));
    expect(firedAction).toBe('ability8');
  });

  it('Digit9 emits an ability9 action', () => {
    const el = fakeElement();
    const input = new Input(el as unknown as HTMLElement);
    let firedAction: string | null = null;
    input.onAction((action) => {
      firedAction = action;
    });
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit9' }));
    expect(firedAction).toBe('ability9');
  });

  it('Digit0 emits an ability10 action', () => {
    const el = fakeElement();
    const input = new Input(el as unknown as HTMLElement);
    let firedAction: string | null = null;
    input.onAction((action) => {
      firedAction = action;
    });
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit0' }));
    expect(firedAction).toBe('ability10');
  });

  it('KeyM emits a multiplayer action', () => {
    const el = fakeElement();
    const input = new Input(el as unknown as HTMLElement);
    let firedAction: string | null = null;
    input.onAction((action) => {
      firedAction = action;
    });
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM' }));
    expect(firedAction).toBe('multiplayer');
  });

  it('KeyO emits a leaderboard action', () => {
    const el = fakeElement();
    const input = new Input(el as unknown as HTMLElement);
    let firedAction: string | null = null;
    input.onAction((action) => {
      firedAction = action;
    });
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyO' }));
    expect(firedAction).toBe('leaderboard');
  });

  it('KeyT emits a chatFocus action', () => {
    const el = fakeElement();
    const input = new Input(el as unknown as HTMLElement);
    let firedAction: string | null = null;
    input.onAction((action) => {
      firedAction = action;
    });
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyT' }));
    expect(firedAction).toBe('chatFocus');
  });

  it('KeyT prevents the browser\'s own default text-insertion (regression: chatFocus moves focus onto the chat input synchronously, so the browser would otherwise insert a literal "t" into it right after)', () => {
    const el = fakeElement();
    new Input(el as unknown as HTMLElement);
    const event = new KeyboardEvent('keydown', { code: 'KeyT' });
    window.dispatchEvent(event);
    expect((event as unknown as InstanceType<typeof FakeKeyboardEvent>).defaultPrevented).toBe(true);
  });

  it('KeyY emits a voiceMute action', () => {
    const el = fakeElement();
    const input = new Input(el as unknown as HTMLElement);
    let firedAction: string | null = null;
    input.onAction((action) => {
      firedAction = action;
    });
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyY' }));
    expect(firedAction).toBe('voiceMute');
  });

  it('a keydown targeting a real INPUT/TEXTAREA element is ignored entirely — no action fires and no move key registers (typing in duel chat must not also drive the fox or attack)', () => {
    const el = fakeElement();
    const input = new Input(el as unknown as HTMLElement);
    let firedAction: string | null = null;
    input.onAction((action) => {
      firedAction = action;
    });
    const fakeInputField = { tagName: 'INPUT' };
    window.dispatchEvent(Object.assign(new KeyboardEvent('keydown', { code: 'KeyJ' }), { target: fakeInputField }));
    expect(firedAction).toBeNull();
    expect(input.isHeld('KeyJ')).toBe(false);
  });

  it('isHeld reflects real key-down/key-up state for Block (KeyH) — a HELD check, not a one-shot press event', () => {
    const el = fakeElement();
    const input = new Input(el as unknown as HTMLElement);
    expect(input.isHeld('KeyH')).toBe(false);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyH' }));
    expect(input.isHeld('KeyH')).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyH' }));
    expect(input.isHeld('KeyH')).toBe(false);
  });
});

describe('Input touch API (TouchControls.ts drives these directly, same effect as a keyboard)', () => {
  it('setHeld writes into the same isHeld state a real keydown/keyup would — a touch Block button behaves identically to holding KeyH', () => {
    const el = fakeElement();
    const input = new Input(el as unknown as HTMLElement);
    expect(input.isHeld('KeyH')).toBe(false);
    input.setHeld('KeyH', true);
    expect(input.isHeld('KeyH')).toBe(true);
    input.setHeld('KeyH', false);
    expect(input.isHeld('KeyH')).toBe(false);
  });

  it('pressAction fires the same onAction handlers a real keypress would', () => {
    const el = fakeElement();
    const input = new Input(el as unknown as HTMLElement);
    let fired: string | null = null;
    input.onAction((action) => {
      fired = action;
    });
    input.pressAction('dodge');
    expect(fired).toBe('dodge');
  });

  it('pollMove uses the touch joystick vector only when no keyboard movement key is held', () => {
    const el = fakeElement();
    const input = new Input(el as unknown as HTMLElement);
    let reportedX = 0;
    let reportedZ = 0;
    input.onMove((x, z) => {
      reportedX = x;
      reportedZ = z;
    });

    input.setTouchMove(0.5, -0.5);
    input.pollMove();
    expect(reportedX).toBe(0.5);
    expect(reportedZ).toBe(-0.5);

    // A real keyboard press must win outright over a stale touch vector, not blend with it.
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    input.pollMove();
    expect(reportedX).toBe(0);
    expect(reportedZ).toBe(1);
  });
});
