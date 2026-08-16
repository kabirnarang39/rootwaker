export type WildlifeState = 'graze' | 'alert' | 'fleeing';

const BASE_ALERT_RANGE = 4; // meters, the range at which even a slow approach triggers alert
const SPEED_RANGE_BONUS = 0.6; // extra alert-range meters per m/s of player approach speed
const ALERT_REACTION_SECONDS = 0.4;
const CALM_DISTANCE = 15; // meters, must retreat this far (while slow) to fully calm down
const CALM_SPEED_THRESHOLD = 1.5; // m/s, player must also be below this speed to let prey calm

/**
 * Detection range grows with how fast the player is closing — a slow stalk
 * gets much closer before triggering alert than a running approach. This is
 * the mechanical core of "stalking is a real skill," not a fixed radius.
 */
function alertRangeFor(approachSpeed: number): number {
  return BASE_ALERT_RANGE + Math.max(0, approachSpeed) * SPEED_RANGE_BONUS;
}

export class WildlifeAI {
  state: WildlifeState = 'graze';
  private alertTimer = 0;

  update(distanceToPlayer: number, playerApproachSpeed: number, delta: number): void {
    const detected = distanceToPlayer <= alertRangeFor(playerApproachSpeed);

    switch (this.state) {
      case 'graze':
        if (detected) {
          this.state = 'alert';
          this.alertTimer = 0;
        }
        break;
      case 'alert':
        if (!detected) {
          this.state = 'graze';
          break;
        }
        this.alertTimer += delta;
        if (this.alertTimer >= ALERT_REACTION_SECONDS) this.state = 'fleeing';
        break;
      case 'fleeing':
        if (distanceToPlayer >= CALM_DISTANCE && playerApproachSpeed <= CALM_SPEED_THRESHOLD) {
          this.state = 'graze';
        }
        break;
    }
  }
}
