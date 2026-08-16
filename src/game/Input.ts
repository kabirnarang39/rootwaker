export type PlayerAction = 'left' | 'right' | 'jump' | 'slide';

/** Keyboard (desktop) + swipe (touch) → one normalized action stream. */
export class Input {
  private handlers: Array<(action: PlayerAction) => void> = [];
  private touchStartX = 0;
  private touchStartY = 0;
  private touchActive = false;

  constructor(target: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('touchstart', this.onTouchStart, { passive: true });
    target.addEventListener('touchend', this.onTouchEnd, { passive: true });
  }

  onAction(handler: (action: PlayerAction) => void) {
    this.handlers.push(handler);
  }

  private emit(action: PlayerAction) {
    this.handlers.forEach((h) => h(action));
  }

  private onKeyDown = (e: KeyboardEvent) => {
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.emit('left');
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.emit('right');
        break;
      case 'ArrowUp':
      case 'KeyW':
      case 'Space':
        this.emit('jump');
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.emit('slide');
        break;
    }
  };

  private onTouchStart = (e: TouchEvent) => {
    const t = e.changedTouches[0];
    this.touchStartX = t.clientX;
    this.touchStartY = t.clientY;
    this.touchActive = true;
  };

  private onTouchEnd = (e: TouchEvent) => {
    if (!this.touchActive) return;
    this.touchActive = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - this.touchStartX;
    const dy = t.clientY - this.touchStartY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const SWIPE_THRESHOLD = 30;
    if (Math.max(absX, absY) < SWIPE_THRESHOLD) return;

    if (absX > absY) {
      this.emit(dx > 0 ? 'right' : 'left');
    } else {
      this.emit(dy > 0 ? 'slide' : 'jump');
    }
  };

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
  }
}
