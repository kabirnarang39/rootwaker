export type PlayerAction =
  | 'attack'
  | 'dodge'
  | 'jump'
  | 'interact'
  | 'pounce'
  | 'cycleView'
  | 'ability1'
  | 'ability2'
  | 'ability3'
  | 'ability4'
  | 'ability5'
  | 'ability6';

const FORWARD_KEYS = ['KeyW', 'ArrowUp'];
const BACK_KEYS = ['KeyS', 'ArrowDown'];
const LEFT_KEYS = ['KeyA', 'ArrowLeft'];
const RIGHT_KEYS = ['KeyD', 'ArrowRight'];

const LOOK_SENSITIVITY = 0.005; // radians per pixel of drag — tuned for a readable, non-twitchy orbit

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

  constructor(target: HTMLElement) {
    this.target = target;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    target.addEventListener('mousedown', this.onMouseDown);
    target.addEventListener('mousemove', this.onMouseMove);
    target.addEventListener('mouseup', this.onMouseUp);
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

  /** Called once per frame by the game loop to push the current move intent. */
  pollMove() {
    const { x, z } = resolveMoveVector(this.keysDown);
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

  private onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    this.dragging = true;
    this.lastDragX = e.clientX;
    this.lastDragY = e.clientY;
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.dragging) return;
    const dx = e.clientX - this.lastDragX;
    const dy = e.clientY - this.lastDragY;
    this.lastDragX = e.clientX;
    this.lastDragY = e.clientY;
    this.pendingYaw += dx * LOOK_SENSITIVITY;
    this.pendingPitch += dy * LOOK_SENSITIVITY;
  };

  private onMouseUp = () => {
    this.dragging = false;
  };

  private onKeyDown = (e: KeyboardEvent) => {
    this.keysDown.add(e.code);
    if (e.code === 'Space') this.emitAction('jump');
    else if (e.code === 'KeyJ') this.emitAction('attack');
    else if (e.code === 'KeyK') this.emitAction('dodge');
    else if (e.code === 'KeyE') this.emitAction('interact');
    else if (e.code === 'KeyL') this.emitAction('pounce');
    else if (e.code === 'KeyC') this.emitAction('cycleView');
    else if (e.code === 'Digit1') this.emitAction('ability1');
    else if (e.code === 'Digit2') this.emitAction('ability2');
    else if (e.code === 'Digit3') this.emitAction('ability3');
    else if (e.code === 'Digit4') this.emitAction('ability4');
    else if (e.code === 'Digit5') this.emitAction('ability5');
    else if (e.code === 'Digit6') this.emitAction('ability6');
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keysDown.delete(e.code);
  };

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.target.removeEventListener('mousedown', this.onMouseDown);
    this.target.removeEventListener('mousemove', this.onMouseMove);
    this.target.removeEventListener('mouseup', this.onMouseUp);
  }
}
