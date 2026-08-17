import { describe, it, expect } from 'vitest';
import { AudioFX } from '../Audio';

describe('AudioFX hunting sounds', () => {
  it('playPounceAttempt does not throw before unlock() (no AudioContext yet)', () => {
    const fx = new AudioFX();
    expect(() => fx.playPounceAttempt(true)).not.toThrow();
    expect(() => fx.playPounceAttempt(false)).not.toThrow();
  });

  it('playAbilityUnlock does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playAbilityUnlock()).not.toThrow();
  });

  it('playFootstepRustle does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playFootstepRustle()).not.toThrow();
  });
});

describe('AudioFX throne-room sounds', () => {
  it('playGroundSlamTelegraph does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playGroundSlamTelegraph()).not.toThrow();
  });

  it('playGroundSlamImpact does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playGroundSlamImpact()).not.toThrow();
  });

  it('playArcComplete does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playArcComplete()).not.toThrow();
  });

  it('startVillageAmbience does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.startVillageAmbience()).not.toThrow();
  });
});

describe('AudioFX combat-clarity sounds', () => {
  it('playPlayerHurt does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playPlayerHurt()).not.toThrow();
  });

  it('playChargeDash does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playChargeDash()).not.toThrow();
  });

  it('playRoar does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playRoar()).not.toThrow();
  });

  it('playSensePulse does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playSensePulse()).not.toThrow();
  });
});

describe('AudioFX species sounds', () => {
  it('playOwlScreech does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playOwlScreech()).not.toThrow();
  });

  it('playViperHiss does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playViperHiss()).not.toThrow();
  });

  it('playSquirrelChatter does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playSquirrelChatter()).not.toThrow();
  });

  it('playBirdFlush does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playBirdFlush()).not.toThrow();
  });

  it('playOwlDive does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playOwlDive()).not.toThrow();
  });

  it('playVenomBurst does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playVenomBurst()).not.toThrow();
  });

  it('playEatBite does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playEatBite()).not.toThrow();
  });

  it('playCoronationCheer does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playCoronationCheer()).not.toThrow();
  });

  it('playBearGrowl does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playBearGrowl()).not.toThrow();
  });

  it('playBoarSnort does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playBoarSnort()).not.toThrow();
  });

  it('playWraithGroan does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playWraithGroan()).not.toThrow();
  });

  it('playBearSwipeActivate does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playBearSwipeActivate()).not.toThrow();
  });

  it('startSeaAmbience does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.startSeaAmbience()).not.toThrow();
  });
});
