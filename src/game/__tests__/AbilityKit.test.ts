import { describe, it, expect } from 'vitest';
import { AbilityKit, ABILITIES, ABILITY_SLOTS } from '../AbilityKit';

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

  it('owl-dive and viper-venom are registered with the right keys, cooldowns, and slot order', () => {
    expect(ABILITIES['owl-dive'].key).toBe('5');
    expect(ABILITIES['owl-dive'].cooldownSeconds).toBe(6);
    expect(ABILITIES['viper-venom'].key).toBe('6');
    expect(ABILITIES['viper-venom'].cooldownSeconds).toBe(9);
    expect(ABILITY_SLOTS).toEqual([
      'keen-ear',
      'boar-charge',
      'bear-swipe',
      'kings-roar',
      'owl-dive',
      'viper-venom',
      'lion-pounce',
      'croc-lunge',
      'shark-bite',
      'monkey-dash',
    ]);
  });

  it('lion-pounce is registered with the right key, cooldown, and slot order', () => {
    expect(ABILITIES['lion-pounce'].key).toBe('7');
    expect(ABILITIES['lion-pounce'].cooldownSeconds).toBe(5);
    expect(ABILITY_SLOTS[6]).toBe('lion-pounce');
  });

  it('croc-lunge is registered with the right key, cooldown, and slot order', () => {
    expect(ABILITIES['croc-lunge'].key).toBe('8');
    expect(ABILITIES['croc-lunge'].cooldownSeconds).toBe(5);
    expect(ABILITY_SLOTS[7]).toBe('croc-lunge');
  });

  it('shark-bite is registered with the right key, cooldown, and slot order', () => {
    expect(ABILITIES['shark-bite'].key).toBe('9');
    expect(ABILITIES['shark-bite'].cooldownSeconds).toBe(5);
    expect(ABILITY_SLOTS[8]).toBe('shark-bite');
  });

  it('monkey-dash is registered with the right key, cooldown, and slot order', () => {
    expect(ABILITIES['monkey-dash'].key).toBe('0');
    expect(ABILITIES['monkey-dash'].cooldownSeconds).toBe(3);
    expect(ABILITY_SLOTS[9]).toBe('monkey-dash');
  });

  it('owl-dive and viper-venom activate/cooldown like every other ability once unlocked', () => {
    const kit = new AbilityKit();
    kit.unlock('owl-dive');
    kit.unlock('viper-venom');
    expect(kit.activate('owl-dive', 0)).toBe(true);
    expect(kit.activate('owl-dive', 0)).toBe(false); // still on cooldown
    expect(kit.activate('viper-venom', 0)).toBe(true);
    expect(kit.cooldownRemaining('owl-dive', 0)).toBe(ABILITIES['owl-dive'].cooldownSeconds);
    expect(kit.cooldownRemaining('viper-venom', 0)).toBe(ABILITIES['viper-venom'].cooldownSeconds);
  });
});
