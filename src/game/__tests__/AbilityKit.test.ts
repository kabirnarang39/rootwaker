import { describe, it, expect } from 'vitest';
import { AbilityKit, ABILITIES } from '../AbilityKit';

describe('AbilityKit', () => {
  it('starts with no abilities unlocked', () => {
    const kit = new AbilityKit();
    expect(kit.has('keen-ear')).toBe(false);
    expect(kit.has('boar-charge')).toBe(false);
  });

  it('unlock() grants the ability and unlockedThisFrame() reports it once', () => {
    const kit = new AbilityKit();
    kit.unlock('keen-ear');
    expect(kit.has('keen-ear')).toBe(true);
    expect(kit.unlockedThisFrame()).toEqual(ABILITIES['keen-ear']);
    expect(kit.unlockedThisFrame()).toBeNull(); // only reported once
  });

  it('unlocking an already-unlocked ability is a no-op, does not re-report', () => {
    const kit = new AbilityKit();
    kit.unlock('boar-charge');
    kit.unlockedThisFrame(); // consume the report
    kit.unlock('boar-charge');
    expect(kit.unlockedThisFrame()).toBeNull();
  });

  it('activate() fails for a locked ability and does not start its cooldown', () => {
    const kit = new AbilityKit();
    expect(kit.activate('boar-charge', 0)).toBe(false);
    expect(kit.cooldownRemaining('boar-charge', 0)).toBe(0);
  });

  it('activate() succeeds once unlocked, then blocks until the cooldown elapses', () => {
    const kit = new AbilityKit();
    kit.unlock('boar-charge');
    expect(kit.activate('boar-charge', 10)).toBe(true);
    expect(kit.cooldownRemaining('boar-charge', 10)).toBe(ABILITIES['boar-charge'].cooldownSeconds);
    expect(kit.activate('boar-charge', 10 + ABILITIES['boar-charge'].cooldownSeconds - 0.01)).toBe(false);
    expect(kit.activate('boar-charge', 10 + ABILITIES['boar-charge'].cooldownSeconds)).toBe(true);
  });
});
