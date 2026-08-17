export type WeatherCondition = 'clear' | 'overcast' | 'rain' | 'storm';

export interface WeatherParams {
  fogMultiplier: number;
  lightMultiplier: number;
  tideAmplitudeMultiplier: number;
  rainIntensity: number; // 0 (none) .. 1 (storm-heavy)
}

export interface WeatherSnapshot {
  condition: WeatherCondition;
  params: WeatherParams;
}

// Ordered clear->overcast->rain->storm so pickNext() only ever steps to a NEIGHBOR, never jumps
// straight from clear to storm — real weather rolls in through intermediate states, it doesn't
// snap from a clear sky to a downpour in one beat.
const CONDITION_ORDER: WeatherCondition[] = ['clear', 'overcast', 'rain', 'storm'];

const WEATHER_PARAMS: Record<WeatherCondition, WeatherParams> = {
  clear: { fogMultiplier: 1.0, lightMultiplier: 1.0, tideAmplitudeMultiplier: 1.0, rainIntensity: 0 },
  overcast: { fogMultiplier: 1.6, lightMultiplier: 0.72, tideAmplitudeMultiplier: 1.3, rainIntensity: 0 },
  rain: { fogMultiplier: 2.2, lightMultiplier: 0.55, tideAmplitudeMultiplier: 1.7, rainIntensity: 0.55 },
  storm: { fogMultiplier: 3.0, lightMultiplier: 0.4, tideAmplitudeMultiplier: 2.4, rainIntensity: 1.0 },
};

const HOLD_MIN_SECONDS = 90;
const HOLD_MAX_SECONDS = 210;
// Real weather rolls in and out over minutes, not seconds — a long, genuinely gradual crossfade
// (fog thickening, light dimming, rain building) rather than a switch flip.
const TRANSITION_SECONDS = 45;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Drives real, continuously varying weather: fog density, light intensity, sea tide amplitude,
 * and rain intensity all derive from ONE shared condition instead of each having its own
 * unrelated random wobble — a storm makes the fog thicker, the light dimmer, the tide higher, and
 * the rain heavier all together, the way real weather actually correlates those things. Holds
 * each condition for a real multi-minute stretch, then rolls gradually toward a neighboring
 * condition on the clear<->overcast<->rain<->storm chain (see CONDITION_ORDER) — never an instant
 * snap and never a same-frame jump straight from clear to storm. */
export class WeatherSystem {
  private current: WeatherCondition = 'clear';
  private next: WeatherCondition = 'clear';
  private transitioning = false;
  private transitionStart = 0;
  private holdUntil: number;
  private rng: () => number;

  constructor(startTime = 0, rng: () => number = Math.random) {
    this.rng = rng;
    this.holdUntil = startTime + this.randomHold();
  }

  private randomHold(): number {
    return HOLD_MIN_SECONDS + this.rng() * (HOLD_MAX_SECONDS - HOLD_MIN_SECONDS);
  }

  private pickNext(): WeatherCondition {
    const idx = CONDITION_ORDER.indexOf(this.current);
    const neighbors = [idx - 1, idx + 1].filter((i) => i >= 0 && i < CONDITION_ORDER.length);
    const pick = neighbors[Math.floor(this.rng() * neighbors.length)] ?? idx;
    return CONDITION_ORDER[pick];
  }

  update(time: number): WeatherSnapshot {
    if (!this.transitioning && time >= this.holdUntil) {
      this.next = this.pickNext();
      this.transitioning = true;
      this.transitionStart = time;
    }

    let weight = 0;
    if (this.transitioning) {
      weight = Math.min(1, (time - this.transitionStart) / TRANSITION_SECONDS);
      if (weight >= 1) {
        this.current = this.next;
        this.transitioning = false;
        this.holdUntil = time + this.randomHold();
        weight = 0;
      }
    }

    const a = WEATHER_PARAMS[this.current];
    const b = WEATHER_PARAMS[this.next];
    return {
      condition: this.transitioning ? this.next : this.current,
      params: {
        fogMultiplier: lerp(a.fogMultiplier, b.fogMultiplier, weight),
        lightMultiplier: lerp(a.lightMultiplier, b.lightMultiplier, weight),
        tideAmplitudeMultiplier: lerp(a.tideAmplitudeMultiplier, b.tideAmplitudeMultiplier, weight),
        rainIntensity: lerp(a.rainIntensity, b.rainIntensity, weight),
      },
    };
  }
}
