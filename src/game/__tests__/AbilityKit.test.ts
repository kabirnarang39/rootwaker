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
});
