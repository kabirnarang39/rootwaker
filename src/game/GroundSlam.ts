export type GroundSlamState = 'idle' | 'telegraph' | 'active';

const TELEGRAPH_SECONDS = 0.7; // a real, fair warning window — same telegraph-then-effect philosophy as WindGust and EnemyAI's combat telegraph
const ACTIVE_SECONDS = 0.4;

/**
 * idle -> telegraph -> active -> idle. Mirrors WindGust's shape, but is armed
 * explicitly by the King (only in its enraged phase) rather than free-running
 * on its own timer.
 */
export class GroundSlam {
  state: GroundSlamState = 'idle';
  private timeInState = 0;

  arm(): void {
    if (this.state !== 'idle') return; // no-op while already telegraphing/active — safe to call every frame
    this.enter('telegraph');
  }

  update(delta: number): void {
    this.timeInState += delta;
    switch (this.state) {
      case 'telegraph':
        if (this.timeInState >= TELEGRAPH_SECONDS) this.enter('active');
        break;
      case 'active':
        if (this.timeInState >= ACTIVE_SECONDS) this.enter('idle');
        break;
    }
  }

  isDamaging(): boolean {
    return this.state === 'active';
  }

  private enter(state: GroundSlamState): void {
    this.state = state;
    this.timeInState = 0;
  }
}
