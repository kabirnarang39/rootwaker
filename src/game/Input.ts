export type PlayerAction =
  | 'attack'
  | 'dodge'
  | 'jump'
  | 'pounce'
  | 'cycleView'
  | 'ability1'
  | 'ability2'
  | 'ability3'
  | 'ability4'
  | 'ability5'
  | 'ability6'
  | 'ability7'
  | 'ability8'
  | 'ability9'
  | 'ability10'
  | 'multiplayer'
  | 'leaderboard'
  | 'chatFocus'
  | 'voiceMute';

const FORWARD_KEYS = ['KeyW', 'ArrowUp'];
const BACK_KEYS = ['KeyS', 'ArrowDown'];
const LEFT_KEYS = ['KeyA', 'ArrowLeft'];
const RIGHT_KEYS = ['KeyD', 'ArrowRight'];

const LOOK_SENSITIVITY = 0.005; // radians per pixel of drag — tuned for a readable, non-twitchy orbit

// Duck-typed on tagName rather than `instanceof HTMLInputElement` so this stays safe to call in
// the vitest node environment this file's own test suite runs in, which has no DOM globals at all.
function isTypingIntoField(target: EventTarget | null): boolean {
  const tag = (target as HTMLElement | null)?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA';
}

/** Pure: raw ±1 per axis from held keys. Diagonal normalization is the movement consumer's job. */
export function resolveMoveVector(keysDown: Set<string>): { x: number; z: number } {
  let z = 0;
  let x = 0;
  if (FORWARD_KEYS.some((k) => keysDown.has(k))) z += 1;
  if (BACK_KEYS.some((k) => keysDown.has(k))) z -= 1;
  if (RIGHT_KEYS.some((k) => keysDown.has(k))) x += 1;
  if (LEFT_KEYS.some((k) => keysDown.has(k))) x -= 1;
  return { x, z };
}

/** Keyboard (desktop) + on-screen stick/buttons (touch) → normalized move vector + discrete actions. */
export class Input {
  private keysDown = new Set<string>();
  private actionHandlers: Array<(action: PlayerAction) => void> = [];
  private moveHandlers: Array<(x: number, z: number) => void> = [];
  private lookHandlers: Array<(deltaYaw: number, deltaPitch: number) => void> = [];
  private target: HTMLElement;
  private dragging = false;
  private lastDragX = 0;
  private lastDragY = 0;
  private pendingYaw = 0;
  private pendingPitch = 0;
  // Real analog joystick vector from TouchControls.ts, [-1, 1] per axis — only consulted by
  // pollMove when no keyboard movement key is held, so a touch device and a keyboard never fight
  // over which vector wins (see pollMove's own comment).
  private touchMoveX = 0;
  private touchMoveZ = 0;

  constructor(target: HTMLElement) {
    this.target = target;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    // Pointer events (not mouse-only) so a single-finger drag on the canvas orbits the camera
    // exactly like a mouse drag does — real touch look support, not just touch-tolerant clicks.
    target.addEventListener('pointerdown', this.onPointerDown);
    target.addEventListener('pointermove', this.onPointerMove);
    target.addEventListener('pointerup', this.onPointerUp);
    target.addEventListener('pointercancel', this.onPointerUp);
  }

  onAction(handler: (action: PlayerAction) => void) {
    this.actionHandlers.push(handler);
  }

  onMove(handler: (x: number, z: number) => void) {
    this.moveHandlers.push(handler);
  }

  onLook(handler: (deltaYaw: number, deltaPitch: number) => void) {
    this.lookHandlers.push(handler);
  }

  /** Real held-key check — for a state you hold rather than press once (Block). Distinct from
   * the discrete onAction press events every other control uses. */
  isHeld(code: string): boolean {
    return this.keysDown.has(code);
  }

  /** TouchControls.ts's own hold-button (Block) reuses this SAME set a keyboard press populates,
   * so isHeld/the rest of Game.ts never needs to know which input device is actually driving it. */
  setHeld(code: string, held: boolean): void {
    if (held) this.keysDown.add(code);
    else this.keysDown.delete(code);
  }

  /** TouchControls.ts's own discrete buttons (Jump/Attack/Dodge/ability taps/hunt-prompt tap) fire
   * through this SAME emitAction path a keyboard press uses, so Game.ts's one onAction switchboard
   * covers both input devices with zero new dispatch logic. */
  pressAction(action: PlayerAction): void {
    this.emitAction(action);
  }

  /** Real analog joystick vector from TouchControls.ts, each axis already clamped to [-1, 1]. */
  setTouchMove(x: number, z: number): void {
    this.touchMoveX = x;
    this.touchMoveZ = z;
  }

  /** Called once per frame by the game loop to push the current move intent. Keyboard wins
   * outright whenever any movement key is actually held — a touch device never also has a
   * keyboard in hand, so there's no real scenario where the two need to blend, only one where
   * a stale non-zero touch vector must not silently override real keyboard input (or vice
   * versa). */
  pollMove() {
    const keyboard = resolveMoveVector(this.keysDown);
    const usingKeyboard = keyboard.x !== 0 || keyboard.z !== 0;
    const x = usingKeyboard ? keyboard.x : this.touchMoveX;
    const z = usingKeyboard ? keyboard.z : this.touchMoveZ;
    this.moveHandlers.forEach((h) => h(x, z));
  }

  /** Called once per frame by the game loop to push the current look intent. */
  pollLook() {
    const yaw = this.pendingYaw;
    const pitch = this.pendingPitch;
    this.pendingYaw = 0;
    this.pendingPitch = 0;
    this.lookHandlers.forEach((h) => h(yaw, pitch));
  }

  private emitAction(action: PlayerAction) {
    this.actionHandlers.forEach((h) => h(action));
  }

  private onPointerDown = (e: PointerEvent) => {
    // button 0 covers both a real left mouse click AND a real primary-touch pointer (a touch
    // contact reports button 0 too) — no separate touch branch needed.
    if (e.button !== 0) return;
    this.dragging = true;
    this.lastDragX = e.clientX;
    this.lastDragY = e.clientY;
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    const dx = e.clientX - this.lastDragX;
    const dy = e.clientY - this.lastDragY;
    this.lastDragX = e.clientX;
    this.lastDragY = e.clientY;
    this.pendingYaw += dx * LOOK_SENSITIVITY;
    this.pendingPitch += dy * LOOK_SENSITIVITY;
  };

  private onPointerUp = () => {
    this.dragging = false;
  };

  private onKeyDown = (e: KeyboardEvent) => {
    // A player typing into a real text field (duel chat, a challenge code textarea) must not
    // also drive WASD movement or fire J/K/etc combat actions — this listener is on `window`,
    // so without this guard every keystroke while chatting would double as a game input.
    if (isTypingIntoField(e.target)) return;
    this.keysDown.add(e.code);
    if (e.code === 'Space') this.emitAction('jump');
    else if (e.code === 'KeyJ') this.emitAction('attack');
    else if (e.code === 'KeyK') this.emitAction('dodge');
    else if (e.code === 'KeyL') this.emitAction('pounce');
    else if (e.code === 'KeyC') this.emitAction('cycleView');
    else if (e.code === 'Digit1') this.emitAction('ability1');
    else if (e.code === 'Digit2') this.emitAction('ability2');
    else if (e.code === 'Digit3') this.emitAction('ability3');
    else if (e.code === 'Digit4') this.emitAction('ability4');
    else if (e.code === 'Digit5') this.emitAction('ability5');
    else if (e.code === 'Digit6') this.emitAction('ability6');
    else if (e.code === 'Digit7') this.emitAction('ability7');
    else if (e.code === 'Digit8') this.emitAction('ability8');
    else if (e.code === 'Digit9') this.emitAction('ability9');
    else if (e.code === 'Digit0') this.emitAction('ability10');
    else if (e.code === 'KeyM') this.emitAction('multiplayer');
    else if (e.code === 'KeyO') this.emitAction('leaderboard');
    else if (e.code === 'KeyT') {
      // This keystroke's own handler (chatFocus) moves focus onto the duel-chat text input, so
      // the browser's default action for a printable key — inserting "t" into whatever now has
      // focus — must be suppressed here at the source. Without this, the character insertion
      // (which happens right after this handler returns) would land in the box that focus() just
      // moved onto, leaking a literal "t" in front of everything the player actually types.
      e.preventDefault();
      this.emitAction('chatFocus');
    }
    else if (e.code === 'KeyY') this.emitAction('voiceMute');
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (isTypingIntoField(e.target)) return;
    this.keysDown.delete(e.code);
  };

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.target.removeEventListener('pointerdown', this.onPointerDown);
    this.target.removeEventListener('pointermove', this.onPointerMove);
    this.target.removeEventListener('pointerup', this.onPointerUp);
    this.target.removeEventListener('pointercancel', this.onPointerUp);
  }
}
