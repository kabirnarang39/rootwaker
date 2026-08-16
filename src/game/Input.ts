export type PlayerAction = 'attack' | 'dodge' | 'jump' | 'interact' | 'pounce';

const FORWARD_KEYS = ['KeyW', 'ArrowUp'];
const BACK_KEYS = ['KeyS', 'ArrowDown'];
const LEFT_KEYS = ['KeyA', 'ArrowLeft'];
const RIGHT_KEYS = ['KeyD', 'ArrowRight'];

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

  constructor(_target: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  onAction(handler: (action: PlayerAction) => void) {
    this.actionHandlers.push(handler);
  }

  onMove(handler: (x: number, z: number) => void) {
    this.moveHandlers.push(handler);
  }

  /** Called once per frame by the game loop to push the current move intent. */
  pollMove() {
    const { x, z } = resolveMoveVector(this.keysDown);
    this.moveHandlers.forEach((h) => h(x, z));
  }

  private emitAction(action: PlayerAction) {
    this.actionHandlers.forEach((h) => h(action));
  }

  private onKeyDown = (e: KeyboardEvent) => {
    this.keysDown.add(e.code);
    if (e.code === 'Space') this.emitAction('jump');
    else if (e.code === 'KeyJ') this.emitAction('attack');
    else if (e.code === 'KeyK') this.emitAction('dodge');
    else if (e.code === 'KeyE') this.emitAction('interact');
    else if (e.code === 'KeyL') this.emitAction('pounce');
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keysDown.delete(e.code);
  };

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }
}
