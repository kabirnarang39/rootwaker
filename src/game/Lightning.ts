// Real physical basis, not an arbitrary tuning knob: light reaches an observer effectively
// instantly, but sound travels at ~343 m/s — a storm strike 200-750m away arrives as thunder
// 0.6-2.2s after the flash. MIN/MAX_THUNDER_DELAY_SECONDS reflect that real range rather than a
// made-up "feels dramatic" number.
const MIN_THUNDER_DELAY_SECONDS = 0.4;
const MAX_THUNDER_DELAY_SECONDS = 2.2;
const FLASH_SECONDS = 0.15; // a real lightning flash is a near-instant bright spike, not a fade
const MIN_STRIKE_INTERVAL_SECONDS = 6;
const MAX_STRIKE_INTERVAL_SECONDS = 18;

/**
 * Real lightning strikes, gated on an actual storm (not just "any rain" — a thunderstorm is its
 * own distinct weather identity, see WeatherSystem's own 'storm' condition). Strikes at real
 * random intervals (scaled faster for a fiercer storm), each flash followed by a real,
 * physically-grounded thunder delay rather than a simultaneous flash+boom.
 */
export class Lightning {
  flashing = false;
  private elapsed = 0;
  private nextFlashAt: number;
  private flashEndAt = -Infinity;
  private thunderAt = Infinity;
  private rng: () => number;

  constructor(rng: () => number = Math.random) {
    this.rng = rng;
    this.nextFlashAt = this.randomInterval();
  }

  private randomInterval(): number {
    return MIN_STRIKE_INTERVAL_SECONDS + this.rng() * (MAX_STRIKE_INTERVAL_SECONDS - MIN_STRIKE_INTERVAL_SECONDS);
  }

  /** `stormIntensity` is 0 outside a real storm, otherwise WeatherSystem's own rainIntensity
   * (already near 1.0 once a storm has fully rolled in) — a fiercer storm strikes more often. */
  update(delta: number, stormIntensity: number): { justFlashed: boolean; justThundered: boolean } {
    if (stormIntensity <= 0) {
      // A storm that ends and later resumes must wait a real fresh interval before its first
      // strike — resetting here means the countdown never stays "primed" across a calm gap.
      this.elapsed = 0;
      this.flashing = false;
      this.flashEndAt = -Infinity;
      this.thunderAt = Infinity;
      this.nextFlashAt = this.randomInterval();
      return { justFlashed: false, justThundered: false };
    }

    this.elapsed += delta;
    let justFlashed = false;
    let justThundered = false;

    if (!this.flashing && this.elapsed >= this.nextFlashAt) {
      this.flashing = true;
      justFlashed = true;
      this.flashEndAt = this.elapsed + FLASH_SECONDS;
      this.thunderAt =
        this.elapsed + MIN_THUNDER_DELAY_SECONDS + this.rng() * (MAX_THUNDER_DELAY_SECONDS - MIN_THUNDER_DELAY_SECONDS);
    }
    if (this.flashing && this.elapsed >= this.flashEndAt) {
      this.flashing = false;
      this.nextFlashAt = this.elapsed + this.randomInterval() / Math.max(stormIntensity, 0.3);
    }
    if (this.thunderAt !== Infinity && this.elapsed >= this.thunderAt) {
      justThundered = true;
      this.thunderAt = Infinity;
    }

    return { justFlashed, justThundered };
  }
}
