import { describe, it, expect } from 'vitest';
import { Lightning } from '../Lightning';

// Deterministic rng: always returns 0, so every random interval resolves to its own minimum —
// makes exact strike/thunder timing predictable for these tests.
const zeroRng = () => 0;

describe('Lightning', () => {
  it('never strikes outside a real storm (stormIntensity 0)', () => {
    const lightning = new Lightning(zeroRng);
    for (let i = 0; i < 100; i++) {
      const { justFlashed, justThundered } = lightning.update(1, 0);
      expect(justFlashed).toBe(false);
      expect(justThundered).toBe(false);
    }
  });

  it('strikes after the minimum real interval once a storm is active', () => {
    const lightning = new Lightning(zeroRng);
    // MIN_STRIKE_INTERVAL_SECONDS = 6 with zeroRng (interval resolves to its minimum)
    let flashed = false;
    for (let i = 0; i < 6; i++) {
      const { justFlashed } = lightning.update(1, 1);
      if (justFlashed) flashed = true;
    }
    expect(flashed).toBe(true);
  });

  it('thunder follows the flash after a real physically-grounded delay, never simultaneously', () => {
    const lightning = new Lightning(zeroRng);
    let flashTick = -1;
    let thunderTick = -1;
    for (let i = 0; i < 12; i++) {
      const { justFlashed, justThundered } = lightning.update(1, 1);
      if (justFlashed && flashTick === -1) flashTick = i;
      if (justThundered && thunderTick === -1) thunderTick = i;
      // the flash and its own thunder must never register on the exact same update — a real
      // thunderstorm's flash-to-boom delay is never zero (light is instant, sound isn't).
      expect(justFlashed && justThundered).toBe(false);
    }
    expect(flashTick).toBeGreaterThanOrEqual(0);
    expect(thunderTick).toBeGreaterThan(flashTick);
  });

  it('a storm that ends and later resumes waits a real fresh interval, not an instantly-primed strike', () => {
    const lightning = new Lightning(zeroRng);
    lightning.update(6, 1); // reach the first real strike
    lightning.update(0.1, 0); // storm ends abruptly, mid-cycle
    const { justFlashed } = lightning.update(0.01, 1); // storm resumes immediately after
    expect(justFlashed).toBe(false); // must not fire on the very next frame
  });

  it('flashing is true only for the brief real flash window, not a lingering glow', () => {
    const lightning = new Lightning(zeroRng);
    lightning.update(6, 1);
    expect(lightning.flashing).toBe(true);
    lightning.update(0.2, 1); // past FLASH_SECONDS (0.15)
    expect(lightning.flashing).toBe(false);
  });
});
