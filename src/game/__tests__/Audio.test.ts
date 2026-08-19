import { describe, it, expect } from 'vitest';
import { AudioFX, computeSpatialPan, computeSpatialAttenuation } from '../Audio';

describe('spatial audio math', () => {
  it('a source dead ahead of the listener pans center', () => {
    // Listener facing yaw=0 (real forward = +Z per FoxFacing.ts's own atan2(x,z) convention);
    // a source directly ahead has dx=0, so pan must be ~0, not pulled left or right.
    expect(computeSpatialPan(0, 10, 0, 0, 0)).toBeCloseTo(0, 5);
  });

  it('a source to the listener\'s right pans positive, left pans negative', () => {
    expect(computeSpatialPan(10, 0, 0, 0, 0)).toBeGreaterThan(0);
    expect(computeSpatialPan(-10, 0, 0, 0, 0)).toBeLessThan(0);
  });

  it('rotating the listener 180 degrees flips a source from ahead to behind — pan crosses zero, sign flips with a quarter-turn either way', () => {
    const facingAway = computeSpatialPan(0, 10, 0, 0, Math.PI);
    // Directly behind stays centered (sin(pi) ~ 0), but a quarter-turn either side of that
    // reveals the flip: same world source, opposite ear once the listener has turned around.
    const turnedOneWay = computeSpatialPan(0, 10, 0, 0, Math.PI - Math.PI / 2);
    const turnedOtherWay = computeSpatialPan(0, 10, 0, 0, Math.PI + Math.PI / 2);
    expect(facingAway).toBeCloseTo(0, 5);
    expect(turnedOneWay).toBeLessThan(0);
    expect(turnedOtherWay).toBeGreaterThan(0);
    expect(Math.sign(turnedOneWay)).not.toBe(Math.sign(turnedOtherWay));
  });

  it('pan never exceeds the real stereo range [-1, 1]', () => {
    for (let angle = 0; angle < Math.PI * 2; angle += 0.3) {
      const x = Math.sin(angle) * 20;
      const z = Math.cos(angle) * 20;
      const pan = computeSpatialPan(x, z, 0, 0, 0);
      expect(pan).toBeGreaterThanOrEqual(-1);
      expect(pan).toBeLessThanOrEqual(1);
    }
  });

  it('a source at the listener\'s own position is full volume', () => {
    expect(computeSpatialAttenuation(0)).toBe(1);
  });

  it('attenuation falls off linearly with real distance, never below the audible floor', () => {
    const near = computeSpatialAttenuation(10);
    const far = computeSpatialAttenuation(30);
    const beyondWorldEdge = computeSpatialAttenuation(1000);
    expect(near).toBeGreaterThan(far);
    expect(beyondWorldEdge).toBeCloseTo(0.12, 5); // a telegraphed threat stays a faint cue, never silent
  });
});

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

  it('playClimbScrabble does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playClimbScrabble()).not.toThrow();
  });
});

describe('AudioFX throne-room sounds', () => {
  it('playGroundSlamTelegraph does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playGroundSlamTelegraph(5, 5)).not.toThrow();
  });

  it('playGroundSlamImpact does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playGroundSlamImpact(5, 5)).not.toThrow();
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
    expect(() => fx.playOwlScreech(5, 5)).not.toThrow();
  });

  it('playViperHiss does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playViperHiss(5, 5)).not.toThrow();
  });

  it('playSquirrelChatter does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playSquirrelChatter(5, 5)).not.toThrow();
  });

  it('playBirdFlush does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playBirdFlush(5, 5)).not.toThrow();
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
    expect(() => fx.playBearGrowl(5, 5)).not.toThrow();
  });

  it('playBoarSnort does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playBoarSnort(5, 5)).not.toThrow();
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

  it('setRainIntensity does not throw before unlock(), or across repeated calls with varying intensity', () => {
    const fx = new AudioFX();
    expect(() => {
      fx.setRainIntensity(0);
      fx.setRainIntensity(0.5);
      fx.setRainIntensity(1);
    }).not.toThrow();
  });

  it('playLionRoar does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playLionRoar(5, 5)).not.toThrow();
  });

  it('playLionPounceActivate does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playLionPounceActivate()).not.toThrow();
  });

  it('playCrocodileHiss does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playCrocodileHiss(5, 5)).not.toThrow();
  });

  it('playCrocodileLungeActivate does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playCrocodileLungeActivate()).not.toThrow();
  });

  it('playDodgeRoll does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playDodgeRoll()).not.toThrow();
  });

  it('playBlockImpact does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playBlockImpact()).not.toThrow();
  });

  it('playKnockout does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playKnockout()).not.toThrow();
  });
});

describe('AudioFX real per-species hurt reactions', () => {
  it('playBoarHurt does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playBoarHurt()).not.toThrow();
  });

  it('playBearHurt does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playBearHurt()).not.toThrow();
  });

  it('playOwlHurt does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playOwlHurt()).not.toThrow();
  });

  it('playViperHurt does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playViperHurt()).not.toThrow();
  });

  it('playLionHurt does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playLionHurt()).not.toThrow();
  });

  it('playCrocodileHurt does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playCrocodileHurt()).not.toThrow();
  });
});

describe('AudioFX player-fox voice', () => {
  it('playFoxBark does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playFoxBark()).not.toThrow();
  });
});

describe('AudioFX shark (living sea)', () => {
  it('playSharkThreat does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playSharkThreat(5, 5)).not.toThrow();
  });

  it('playSharkBiteActivate does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playSharkBiteActivate()).not.toThrow();
  });

  it('playSharkHurt does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playSharkHurt()).not.toThrow();
  });

  it('playSharkDeath does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playSharkDeath()).not.toThrow();
  });
});

describe('AudioFX monkey', () => {
  it('playMonkeyChatter does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playMonkeyChatter(5, 5)).not.toThrow();
  });

  it('playMonkeyHurt does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playMonkeyHurt()).not.toThrow();
  });

  it('playMonkeyDeath does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playMonkeyDeath()).not.toThrow();
  });

  it('playMonkeyDashActivate does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playMonkeyDashActivate()).not.toThrow();
  });
});

describe('AudioFX weather', () => {
  it('playThunder does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playThunder()).not.toThrow();
  });
});

describe('AudioFX real per-species death cries', () => {
  it('playBoarDeath does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playBoarDeath()).not.toThrow();
  });

  it('playBearDeath does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playBearDeath()).not.toThrow();
  });

  it('playOwlDeath does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playOwlDeath()).not.toThrow();
  });

  it('playViperDeath does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playViperDeath()).not.toThrow();
  });

  it('playLionDeath does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playLionDeath()).not.toThrow();
  });

  it('playCrocodileDeath does not throw before unlock()', () => {
    const fx = new AudioFX();
    expect(() => fx.playCrocodileDeath()).not.toThrow();
  });
});
