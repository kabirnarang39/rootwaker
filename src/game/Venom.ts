// Pure damage-over-time tracker for Viper Venom — no THREE import, no game-loop coupling, so it's
// testable with plain numbers/objects (same pure-logic-module convention as this project's other
// small trackers, e.g. Stalking.ts/EnemyChase.ts, minus the THREE.Vector3 math those happen to need).

export const VENOM_SECONDS = 6;
export const VENOM_TICK_SECONDS = 1;
export const VENOM_DAMAGE_PER_TICK = 4;

const MAX_TICKS = VENOM_SECONDS / VENOM_TICK_SECONDS;

// Guards against float drift in accumulated `now` (e.g. 360 steps of 1/60 summing to
// 5.999999999999998 instead of 6) tipping a real tick boundary into the wrong whole-tick bucket.
// Far smaller than any real frame delta, so it never causes an early tick.
const EPSILON = 1e-6;

interface VenomState {
  appliedAt: number;
  ticksFired: number;
}

export class VenomTracker {
  private state = new Map<object, VenomState>();

  /** (Re)envenoms `target`, restarting its full duration from `now`. */
  apply(target: object, now: number): void {
    this.state.set(target, { appliedAt: now, ticksFired: 0 });
  }

  /** Calls onTick(target) once per elapsed whole tick per envenomed target; drops expired entries. */
  update(now: number, onTick: (target: object) => void): void {
    for (const [target, s] of this.state) {
      const elapsedTicks = Math.min(MAX_TICKS, Math.floor((now - s.appliedAt) / VENOM_TICK_SECONDS + EPSILON));
      while (s.ticksFired < elapsedTicks) {
        s.ticksFired++;
        onTick(target);
      }
      if (s.ticksFired >= MAX_TICKS) this.state.delete(target);
    }
  }

  /** Called when a target dies or is removed — stops any further ticks immediately. */
  clear(target: object): void {
    this.state.delete(target);
  }
}
