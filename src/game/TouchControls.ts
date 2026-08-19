import type { Input } from './Input';

// How far the knob can travel from the stick's center before clamping, in real screen pixels —
// matches the stick base's own CSS radius below so the knob visually reaches the base's edge
// exactly as its output vector reaches magnitude 1.
const JOYSTICK_RADIUS = 52;

/** Real on-screen joystick + action buttons for touch-primary devices — Input.ts already claims
 * "on-screen stick/buttons (touch)" in its own doc comment, but until this file existed nothing
 * backed that claim: a phone had no way to move, attack, dodge, or block at all. Feeds the SAME
 * Input.ts entry points (setTouchMove/pressAction/setHeld) a keyboard already drives, so Game.ts
 * needs zero device-specific branching downstream. */
export class TouchControls {
  private root: HTMLDivElement;
  private stickBase: HTMLDivElement;
  private stickKnob: HTMLDivElement;
  private stickPointerId: number | null = null;
  private stickCenterX = 0;
  private stickCenterY = 0;
  private input: Input;

  constructor(container: HTMLElement, input: Input) {
    this.input = input;
    this.root = document.createElement('div');
    this.root.innerHTML = `
      <style>
        .rw-touch-controls { position: fixed; inset: 0; z-index: 12; pointer-events: none; }
        .rw-stick-base {
          position: fixed; bottom: 26px; left: 20px; width: 110px; height: 110px;
          border-radius: 50%; pointer-events: auto; touch-action: none;
          background: radial-gradient(circle, rgba(20,13,9,0.5), rgba(7,10,8,0.65));
          border: 1px solid rgba(238,242,230,0.18);
        }
        .rw-stick-knob {
          position: absolute; top: 50%; left: 50%; width: 46px; height: 46px; margin: -23px 0 0 -23px;
          border-radius: 50%; background: rgba(255,177,94,0.32); border: 1px solid rgba(255,177,94,0.55);
          transition: transform 40ms linear;
        }
        .rw-touch-buttons {
          position: fixed; bottom: 22px; right: 20px; z-index: 12;
          display: grid; grid-template-columns: repeat(2, 62px); grid-template-rows: repeat(2, 62px);
          gap: 10px; pointer-events: none;
        }
        .rw-touch-btn {
          pointer-events: auto; touch-action: none; border-radius: 50%; border: 1px solid rgba(238,242,230,0.22);
          background: linear-gradient(180deg, rgba(20,13,9,0.62), rgba(7,10,8,0.78));
          color: var(--parchment); font-family: var(--body-face); font-size: 12px;
          text-transform: uppercase; letter-spacing: 0.04em;
          user-select: none; -webkit-user-select: none;
        }
        .rw-touch-btn:active, .rw-touch-btn.rw-touch-held {
          background: linear-gradient(180deg, rgba(255,177,94,0.28), rgba(20,13,9,0.7));
          border-color: rgba(255,177,94,0.55);
        }
        /* Secondary menu row (view cycle / duel / leaderboard) — real actions a touch player
           otherwise has no way to reach at all (KeyC/KeyM/KeyO only), but low-frequency enough
           to earn a small top-right row rather than the core cluster's large thumb-reach buttons.
           Sits below the desktop CONTROLS legend, out of its way — the legend dismisses itself
           on first real move input either way (see Game.ts's dismissLegendOnce). */
        .rw-touch-menu {
          position: fixed; top: 130px; right: 16px; z-index: 12;
          display: flex; flex-direction: column; gap: 6px; pointer-events: none;
        }
        .rw-touch-menu-btn {
          pointer-events: auto; touch-action: none; border-radius: 4px; border: 1px solid rgba(238,242,230,0.2);
          background: linear-gradient(180deg, rgba(20,13,9,0.55), rgba(7,10,8,0.7));
          color: var(--parchment); font-family: var(--body-face); font-size: 10px;
          text-transform: uppercase; letter-spacing: 0.06em; padding: 6px 10px;
          user-select: none; -webkit-user-select: none;
        }
        .rw-touch-menu-btn:active { border-color: rgba(255,177,94,0.5); }
      </style>
      <div class="rw-stick-base"><div class="rw-stick-knob"></div></div>
      <div class="rw-touch-menu">
        <button type="button" class="rw-touch-menu-btn rw-touch-view">View</button>
        <button type="button" class="rw-touch-menu-btn rw-touch-duel">Duel</button>
        <button type="button" class="rw-touch-menu-btn rw-touch-ranks">Ranks</button>
      </div>
      <div class="rw-touch-buttons">
        <button type="button" class="rw-touch-btn rw-touch-dodge">Dodge</button>
        <button type="button" class="rw-touch-btn rw-touch-jump">Jump</button>
        <button type="button" class="rw-touch-btn rw-touch-block">Block</button>
        <button type="button" class="rw-touch-btn rw-touch-attack">Attack</button>
      </div>
    `;
    this.root.className = 'rw-touch-controls';
    container.appendChild(this.root);
    this.stickBase = this.root.querySelector('.rw-stick-base')!;
    this.stickKnob = this.root.querySelector('.rw-stick-knob')!;
    this.wireStick();
    this.wireButtons();
    this.wireMenu();
  }

  private wireStick(): void {
    this.stickBase.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      this.stickPointerId = e.pointerId;
      this.stickBase.setPointerCapture(e.pointerId);
      const rect = this.stickBase.getBoundingClientRect();
      this.stickCenterX = rect.left + rect.width / 2;
      this.stickCenterY = rect.top + rect.height / 2;
      this.updateStick(e.clientX, e.clientY);
    });
    this.stickBase.addEventListener('pointermove', (e: PointerEvent) => {
      if (e.pointerId !== this.stickPointerId) return;
      this.updateStick(e.clientX, e.clientY);
    });
    const release = (e: PointerEvent) => {
      if (e.pointerId !== this.stickPointerId) return;
      this.stickPointerId = null;
      this.stickKnob.style.transform = 'translate(0px, 0px)';
      this.input.setTouchMove(0, 0);
    };
    this.stickBase.addEventListener('pointerup', release);
    this.stickBase.addEventListener('pointercancel', release);
  }

  private updateStick(clientX: number, clientY: number): void {
    let dx = clientX - this.stickCenterX;
    let dy = clientY - this.stickCenterY;
    const dist = Math.hypot(dx, dy);
    if (dist > JOYSTICK_RADIUS) {
      dx = (dx / dist) * JOYSTICK_RADIUS;
      dy = (dy / dist) * JOYSTICK_RADIUS;
    }
    this.stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    // Screen Y grows downward, but resolveMoveVector's own WASD convention treats "forward"
    // (W/ArrowUp) as z=+1 — so an upward drag (negative dy) must map to a positive z.
    this.input.setTouchMove(dx / JOYSTICK_RADIUS, -dy / JOYSTICK_RADIUS);
  }

  private wireButtons(): void {
    const jump = this.root.querySelector('.rw-touch-jump')!;
    const attack = this.root.querySelector('.rw-touch-attack')!;
    const dodge = this.root.querySelector('.rw-touch-dodge')!;
    const block = this.root.querySelector('.rw-touch-block')!;

    jump.addEventListener('pointerdown', (e: Event) => {
      e.preventDefault();
      this.input.pressAction('jump');
    });
    attack.addEventListener('pointerdown', (e: Event) => {
      e.preventDefault();
      this.input.pressAction('attack');
    });
    dodge.addEventListener('pointerdown', (e: Event) => {
      e.preventDefault();
      this.input.pressAction('dodge');
    });

    // Block is a real held state (matches KeyH's own isHeld() contract), not a discrete press —
    // setHeld() writes into the exact same keysDown set a keyboard press populates.
    block.addEventListener('pointerdown', (e: Event) => {
      e.preventDefault();
      block.classList.add('rw-touch-held');
      this.input.setHeld('KeyH', true);
    });
    const releaseBlock = () => {
      block.classList.remove('rw-touch-held');
      this.input.setHeld('KeyH', false);
    };
    block.addEventListener('pointerup', releaseBlock);
    block.addEventListener('pointercancel', releaseBlock);
    block.addEventListener('pointerleave', releaseBlock);
  }

  private wireMenu(): void {
    const view = this.root.querySelector('.rw-touch-view')!;
    const duel = this.root.querySelector('.rw-touch-duel')!;
    const ranks = this.root.querySelector('.rw-touch-ranks')!;
    view.addEventListener('pointerdown', (e: Event) => {
      e.preventDefault();
      this.input.pressAction('cycleView');
    });
    duel.addEventListener('pointerdown', (e: Event) => {
      e.preventDefault();
      this.input.pressAction('multiplayer');
    });
    ranks.addEventListener('pointerdown', (e: Event) => {
      e.preventDefault();
      this.input.pressAction('leaderboard');
    });
  }

  dispose(): void {
    this.root.remove();
  }
}
