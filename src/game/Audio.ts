// Shared by every pure-broadband-noise SFX (no per-sample envelope baked in — those that fade
// the noise itself while generating it, e.g. playFootstepRustle/playGustHit, stay inline since
// their formula isn't just random samples).
function makeNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** Small synthesized SFX/ambience — no external audio assets. */
export class AudioFX {
  private ctx: AudioContext | null = null;
  private ambientGain: GainNode | null = null;
  private rainGain: GainNode | null = null;

  unlock() {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.startJungleAmbience();
  }

  private tone(freq: number, duration: number, type: OscillatorType, gainPeak: number, delay = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t0 = ctx.currentTime + delay;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(gainPeak, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  playCollect() {
    this.tone(880, 0.18, 'sine', 0.08);
    this.tone(1320, 0.14, 'sine', 0.05, 0.03);
  }

  playPowerUp() {
    this.tone(440, 0.2, 'triangle', 0.09);
    this.tone(660, 0.2, 'triangle', 0.07, 0.06);
    this.tone(880, 0.25, 'triangle', 0.06, 0.12);
  }

  playHit() {
    this.tone(90, 0.4, 'sawtooth', 0.12);
    this.tone(55, 0.5, 'square', 0.08, 0.03);
  }

  /** The real killing-blow cue — deliberately heavier and more final than playHit (a normal
   * connecting hit) or any ability-activation cue: a sharp filtered-noise crack for the impact
   * instant, a deep sub-bass boom for weight, and a low decaying rumble tail standing in for the
   * body drop — three real layers, not one sound scaled louder. Fires from resolveDefeat(), the
   * single funnel every real kill (melee, venom, AOE) already routes through, so it's universal
   * across every kill source without special-casing each one. */
  playKnockout(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;

    // Layer 1: a sharp crack — the instant of impact.
    const crack = ctx.createBufferSource();
    crack.buffer = makeNoiseBuffer(ctx, 0.12);
    const crackFilter = ctx.createBiquadFilter();
    crackFilter.type = 'bandpass';
    crackFilter.frequency.setValueAtTime(1400, ctx.currentTime);
    crackFilter.Q.value = 2.5;
    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(0.22, ctx.currentTime);
    crackGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    crack.connect(crackFilter);
    crackFilter.connect(crackGain);
    crackGain.connect(ctx.destination);
    crack.start();

    // Layer 2: a deep sub-bass boom — real weight behind the crack, arriving a beat after it
    // (a fighting-game "impact frame" cue, not simultaneous with the crack).
    const boom = ctx.createOscillator();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(70, ctx.currentTime + 0.03);
    boom.frequency.exponentialRampToValueAtTime(28, ctx.currentTime + 0.4);
    const boomGain = ctx.createGain();
    boomGain.gain.setValueAtTime(0.001, ctx.currentTime + 0.03);
    boomGain.gain.linearRampToValueAtTime(0.24, ctx.currentTime + 0.06);
    boomGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    boom.connect(boomGain);
    boomGain.connect(ctx.destination);
    boom.start(ctx.currentTime + 0.03);
    boom.stop(ctx.currentTime + 0.52);

    // Layer 3: a low decaying rumble tail — stands in for the body's real weight settling,
    // giving the kill a sense of finality rather than ending abruptly with the boom.
    const rumble = ctx.createBufferSource();
    rumble.buffer = makeNoiseBuffer(ctx, 0.6);
    const rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.setValueAtTime(180, ctx.currentTime + 0.1);
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(0.001, ctx.currentTime + 0.1);
    rumbleGain.gain.linearRampToValueAtTime(0.09, ctx.currentTime + 0.15);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.65);
    rumble.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(ctx.destination);
    rumble.start(ctx.currentTime + 0.1);
  }

  playBiomeShift() {
    this.tone(220, 1.2, 'sine', 0.05);
    this.tone(330, 1.4, 'sine', 0.04, 0.15);
  }

  // Retired: single flat-drone ambience from the old runner build. Superseded by
  // startJungleAmbience()'s vertically-layered soundscape, kept intact (not deleted)
  // per this project's retirement convention. Not private, so tsc's noUnusedLocals
  // doesn't flag it as dead code (mirrors Player.ts's retired handleAction).
  startAmbient() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 60;
    const gain = ctx.createGain();
    gain.gain.value = 0.025;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    this.ambientGain = gain;
  }

  startJungleAmbience(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;

    // Canopy layer: high, constant filtered-noise drone (insect chorus).
    const canopyNoise = ctx.createBufferSource();
    canopyNoise.buffer = makeNoiseBuffer(ctx, 2);
    canopyNoise.loop = true;
    const canopyFilter = ctx.createBiquadFilter();
    canopyFilter.type = 'bandpass';
    canopyFilter.frequency.value = 3800;
    canopyFilter.Q.value = 0.6;
    const canopyGain = ctx.createGain();
    canopyGain.gain.value = 0.018;
    canopyNoise.connect(canopyFilter);
    canopyFilter.connect(canopyGain);
    canopyGain.connect(ctx.destination);
    canopyNoise.start();

    // Floor layer: low, constant hum (distant wind/undergrowth).
    const floorOsc = ctx.createOscillator();
    floorOsc.type = 'sine';
    floorOsc.frequency.value = 55;
    const floorGain = ctx.createGain();
    floorGain.gain.value = 0.02;
    floorOsc.connect(floorGain);
    floorGain.connect(ctx.destination);
    floorOsc.start();

    // Mid layer: sparse, randomized bird-call bursts.
    const scheduleBirdCall = () => {
      if (!this.ctx) return;
      const freq = 1400 + Math.random() * 900;
      this.tone(freq, 0.12, 'sine', 0.035);
      this.tone(freq * 1.4, 0.08, 'sine', 0.02, 0.05);
      const nextDelay = 2 + Math.random() * 6; // seconds — sparse, not a loop
      setTimeout(scheduleBirdCall, nextDelay * 1000);
    };
    setTimeout(scheduleBirdCall, 1500);

    // Water-drip layer: quiet, irregular single ticks.
    const scheduleDrip = () => {
      if (!this.ctx) return;
      this.tone(1800 + Math.random() * 400, 0.05, 'sine', 0.015);
      const nextDelay = 3 + Math.random() * 8;
      setTimeout(scheduleDrip, nextDelay * 1000);
    };
    setTimeout(scheduleDrip, 4000);
  }

  setAmbientLevel(level: number) {
    if (this.ambientGain) this.ambientGain.gain.value = 0.025 * level;
  }

  playPounceAttempt(success: boolean): void {
    if (success) {
      this.tone(140, 0.22, 'sawtooth', 0.1);
      this.tone(85, 0.3, 'sine', 0.07, 0.04);
    } else {
      this.tone(320, 0.12, 'sine', 0.04);
    }
  }

  playAbilityUnlock(): void {
    this.tone(392, 0.22, 'triangle', 0.08);
    this.tone(523, 0.22, 'triangle', 0.07, 0.08);
    this.tone(659, 0.3, 'triangle', 0.06, 0.16);
  }

  playFootstepRustle(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const bufferSize = ctx.sampleRate * 0.08;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1200;
    const gain = ctx.createGain();
    gain.gain.value = 0.03;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();
  }

  playWindTelegraph(): void {
    this.tone(600, 0.9, 'sine', 0.03);
  }

  playGustHit(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const bufferSize = ctx.sampleRate * 0.5;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    const gain = ctx.createGain();
    gain.gain.value = 0.05;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();
  }

  startMountainWind(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx, 2);
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    filter.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.value = 0.03;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();
  }

  playGroundSlamTelegraph(): void {
    // Low rumble build — same filtered-noise shape as playGustHit, but pitched lower with a
    // slower, ramping attack: a heavier, ground-borne warning rather than an airy gust.
    if (!this.ctx) return;
    const ctx = this.ctx;
    const noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx, 0.7);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(120, ctx.currentTime);
    filter.frequency.linearRampToValueAtTime(400, ctx.currentTime + 0.7);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.7);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();
  }

  playGroundSlamImpact(): void {
    // A short, heavy low-frequency thump — oscillator-driven with a falling pitch and a sharp
    // attack, reading as "impact" landing right after the telegraph's rumble build.
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(60, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.3);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  }

  playArcComplete(): void {
    // A warm, ascending 3-note chime built on the same tone() helper as playAbilityUnlock, but
    // sine-toned (vs. triangle) and more widely spaced — a distinct "real milestone" cue rather
    // than a copy of the routine-pickup chime.
    this.tone(392, 0.6, 'sine', 0.08); // G4
    this.tone(494, 0.6, 'sine', 0.08, 0.15); // B4
    this.tone(587, 0.7, 'sine', 0.08, 0.3); // D5
  }

  /** Sharp, high stab — distinct from playHit's low thud — for "the player took damage". */
  playPlayerHurt(): void {
    this.tone(720, 0.14, 'sawtooth', 0.1);
    this.tone(340, 0.18, 'square', 0.06, 0.02);
  }

  /** A driving low charge-up chord for the boar-charge dash — reuses playPounceAttempt's
   * sawtooth/sine pairing but longer and lower, reading as a heavier, sustained lunge. */
  playChargeDash(): void {
    this.tone(160, 0.28, 'sawtooth', 0.11);
    this.tone(95, 0.34, 'sine', 0.08, 0.03);
  }

  /** A deep, filtered-noise roar for King's Roar — same noise-buffer technique as
   * playGroundSlamTelegraph, but with a falling (not rising) filter sweep so it reads as an
   * outward bellow rather than an incoming rumble. */
  playRoar(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx, 0.6);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.6);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.16, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();
  }

  /** The canopy owl's voice. A barn owl does NOT hoot — its call is a harsh, rasping shriek, so
   * this is deliberately not a tonal two-note cue. Two layers: noise pre-modulated at ~58Hz
   * (the rasp lives in that flutter, not in the filter) pushed through a *bandpass* centred high,
   * and a sawtooth falling fast from 2.2kHz. Contrast with playRoar(), which is the same
   * noise-buffer technique but lowpass with a downward filter sweep — a bellow, not a shriek;
   * copying that shape here would make the owl sound like a small bear. */
  playOwlScreech(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const bufferSize = Math.floor(ctx.sampleRate * 0.45);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const rasp = 0.55 + 0.45 * Math.sign(Math.sin((i / ctx.sampleRate) * 2 * Math.PI * 58));
      data[i] = (Math.random() * 2 - 1) * rasp;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2600;
    filter.Q.value = 1.4;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.14, ctx.currentTime); // no attack ramp: a shriek tears open
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start();

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(2200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(700, ctx.currentTime + 0.4);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.05, ctx.currentTime);
    oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  }

  /** A quiet, wide echoing ping for Keen Ear — two soft sine layers a fifth apart, longer decay
   * than playCollect so it reads as "sound traveling outward" rather than a pickup chime. */
  playSensePulse(): void {
    this.tone(660, 0.5, 'sine', 0.045);
    this.tone(990, 0.6, 'sine', 0.03, 0.08);
  }

  /** The vine viper's voice. A hiss is forced air — pure broadband noise, no oscillator layer at
   * all (contrast with playOwlScreech, which deliberately pairs noise with a falling sawtooth; a
   * snake's hiss has no pitch to it whatsoever). A bandpass filter centred high gives it that
   * airy "sss" character, with a gentle amplitude swell up and fall back down rather than the
   * screech's hard-open attack. */
  playViperHiss(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx, 0.5);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 5200;
    filter.Q.value = 0.9;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.12); // swell
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5); // fall
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();
  }

  /** The grove squirrel's alarm call. A real squirrel's "kuk-kuk-kuk" is tonal and staccato —
   * contrast with playViperHiss/playOwlScreech, which are pure or noise-dominant; this is 5 short
   * square-wave clicks with almost no decay tail, aimed *at* the predator rather than fled with. */
  playSquirrelChatter(): void {
    const clickCount = 5;
    const clickSpacing = 0.09;
    for (let i = 0; i < clickCount; i++) {
      this.tone(1900 + (i % 2) * 220, 0.045, 'square', 0.07, i * clickSpacing);
    }
  }

  /** The dusk finch flock's explosive group takeoff. A short noise burst amplitude-modulated at
   * ~14Hz — fast enough to read as fluttering wingbeats, contrasted with playOwlScreech's slower
   * ~58Hz modulation which reads as a vocal rasp, not a mechanical flutter — plus 2-3 short rising
   * chirps riding on top as the flock scatters and calls out. */
  playBirdFlush(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const bufferSize = Math.floor(ctx.sampleRate * 0.35);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const flutter = 0.5 + 0.5 * Math.sin((i / ctx.sampleRate) * 2 * Math.PI * 14);
      data[i] = (Math.random() * 2 - 1) * flutter;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();

    this.tone(2600, 0.08, 'sine', 0.04, 0.05);
    this.tone(3100, 0.08, 'sine', 0.04, 0.15);
    this.tone(3600, 0.09, 'sine', 0.035, 0.25);
  }

  /** The Canopy Owl's dive-strike: a rushing bandpass-filtered air-swoop — noise swept downward
   * from a high whistle toward a lower rush as the dive closes, the same noise-buffer technique
   * as playGustHit but swept rather than static — cutting straight into a short, hard talon-impact
   * tone with almost no decay, contrasted with playGroundSlamImpact's slow, low thump landing. */
  playOwlDive(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx, 0.35);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 0.7;
    filter.frequency.setValueAtTime(2400, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.35);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.09, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.02, ctx.currentTime + 0.35);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();

    const impact = ctx.createOscillator();
    impact.type = 'square';
    impact.frequency.value = 950;
    const impactGain = ctx.createGain();
    impactGain.gain.setValueAtTime(0, ctx.currentTime);
    impactGain.gain.setValueAtTime(0.14, ctx.currentTime + 0.35);
    impactGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.42);
    impact.connect(impactGain);
    impactGain.connect(ctx.destination);
    impact.start(ctx.currentTime + 0.35);
    impact.stop(ctx.currentTime + 0.45);
  }

  /** Viper Venom landing: reuses playViperHiss's bandpass-noise hiss technique but shorter and
   * pitched lower — a wetter, throatier register than the hiss's airy 5200Hz — with a low tonal
   * sting (a short falling sine thud) underneath so the strike reads as landing and poisoning,
   * not just hissing past. */
  playVenomBurst(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx, 0.3);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3200;
    filter.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.06);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();

    const sting = ctx.createOscillator();
    sting.type = 'sine';
    sting.frequency.setValueAtTime(75, ctx.currentTime);
    sting.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.25);
    const stingGain = ctx.createGain();
    stingGain.gain.setValueAtTime(0.1, ctx.currentTime + 0.05);
    stingGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    sting.connect(stingGain);
    stingGain.connect(ctx.destination);
    sting.start(ctx.currentTime);
    sting.stop(ctx.currentTime + 0.3);
  }

  /** A single real bite/chomp for the eat-ritual (Game.ts loops this once per real chomp in the
   * ritual's animation cycle, not once per whole ritual). Deliberately wet and meaty, not a
   * combat impact: a short LOWPASS noise burst (playHit's own combat thud is a raw
   * sawtooth/square hit, no filtered noise at all — this needs to read as biting flesh, not
   * striking it) layered under a fast, low, downward-snapping tone standing in for the jaw
   * itself closing. */
  playEatBite(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx, 0.22);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    filter.Q.value = 0.7;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, ctx.currentTime);
    noiseGain.gain.linearRampToValueAtTime(0.11, ctx.currentTime + 0.02);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start();

    const snap = ctx.createOscillator();
    snap.type = 'square';
    snap.frequency.setValueAtTime(140, ctx.currentTime);
    snap.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.09);
    const snapGain = ctx.createGain();
    snapGain.gain.setValueAtTime(0.08, ctx.currentTime);
    snapGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    snap.connect(snapGain);
    snapGain.connect(ctx.destination);
    snap.start(ctx.currentTime);
    snap.stop(ctx.currentTime + 0.12);
  }

  /** The coronation's real animal audience — layered, staggered voice bursts standing in for a
   * crowd of different species calling out at once (not one instrument, and deliberately NOT a
   * copy of playArcComplete's clean ascending chime, which plays alongside this at the same
   * moment as the "resolution" cue — this is the "the mountain itself is celebrating" texture).
   * Three real, distinct voices: a low rising roar-sweep (bear-register), 4 quick high dry
   * clicks (squirrel-register, reusing the same square-wave chatter idea as
   * playSquirrelChatter but staggered wider/slower to read as calls, not one alarm burst), and a
   * short rasping screech (owl-register, a lighter version of playOwlScreech's noise-modulation
   * technique). Staggered start times so they overlap like a real crowd, not three sounds in a
   * neat row. */
  playCoronationCheer(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;

    const roar = ctx.createOscillator();
    roar.type = 'sawtooth';
    roar.frequency.setValueAtTime(80, ctx.currentTime);
    roar.frequency.linearRampToValueAtTime(140, ctx.currentTime + 0.5);
    roar.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 1.1);
    const roarFilter = ctx.createBiquadFilter();
    roarFilter.type = 'lowpass';
    roarFilter.frequency.value = 500;
    const roarGain = ctx.createGain();
    roarGain.gain.setValueAtTime(0, ctx.currentTime);
    roarGain.gain.linearRampToValueAtTime(0.09, ctx.currentTime + 0.2);
    roarGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.1);
    roar.connect(roarFilter);
    roarFilter.connect(roarGain);
    roarGain.connect(ctx.destination);
    roar.start(ctx.currentTime);
    roar.stop(ctx.currentTime + 1.15);

    for (let i = 0; i < 4; i++) {
      const delay = 0.3 + i * 0.16 + Math.random() * 0.05;
      this.tone(1500 + Math.random() * 400, 0.07, 'square', 0.05, delay);
    }

    const screechDelay = 0.5;
    const noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx, 0.35);
    const screechFilter = ctx.createBiquadFilter();
    screechFilter.type = 'bandpass';
    screechFilter.frequency.value = 2200;
    screechFilter.Q.value = 1.2;
    const screechGain = ctx.createGain();
    const t0 = ctx.currentTime + screechDelay;
    screechGain.gain.setValueAtTime(0.001, t0);
    screechGain.gain.linearRampToValueAtTime(0.08, t0 + 0.05);
    screechGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
    noise.connect(screechFilter);
    screechFilter.connect(screechGain);
    screechGain.connect(ctx.destination);
    noise.start(t0);
  }

  /** The Grove Bear's/Elder Bear King's own telegraph warning — a real animal characteristic
   * ("resemble the real animal") distinct from playRoar() (King's Roar, a player POWER — a big
   * triumphant sweep 1400->120Hz over 0.6s). This is shorter, narrower, and stays low the whole
   * time: a warning grumble before a swipe, not an epic bellow — the bear hasn't attacked yet,
   * it's telling you it's about to. */
  playBearGrowl(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx, 0.4);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.4);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.12, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start();

    const growl = ctx.createOscillator();
    growl.type = 'sawtooth';
    growl.frequency.setValueAtTime(70, ctx.currentTime);
    growl.frequency.linearRampToValueAtTime(55, ctx.currentTime + 0.4);
    const growlGain = ctx.createGain();
    growlGain.gain.setValueAtTime(0.06, ctx.currentTime);
    growlGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    growl.connect(growlGain);
    growlGain.connect(ctx.destination);
    growl.start(ctx.currentTime);
    growl.stop(ctx.currentTime + 0.42);
  }

  /** The Tusk Boar's own telegraph warning — a sharp, short, aggressive snort, nothing like
   * the bear's low sustained growl: real boars snort explosively right before a charge, not a
   * sustained sound. Deliberately very short (0.18s) and percussive. */
  playBoarSnort(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx, 0.18);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 650;
    filter.Q.value = 0.9;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.15, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start();

    const grunt = ctx.createOscillator();
    grunt.type = 'square';
    grunt.frequency.setValueAtTime(110, ctx.currentTime);
    grunt.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.15);
    const gruntGain = ctx.createGain();
    gruntGain.gain.setValueAtTime(0.08, ctx.currentTime);
    gruntGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
    grunt.connect(gruntGain);
    gruntGain.connect(ctx.destination);
    grunt.start(ctx.currentTime);
    grunt.stop(ctx.currentTime + 0.18);
  }

  /** The root-wraith's own telegraph warning — an eerie, dissonant, slow-bending groan, matching
   * its established creepy root-spirit identity (see rootWraith.ts's own dark-magenta glow), not
   * a real-animal sound at all. Two slightly detuned sine tones sliding downward together create
   * the unsettling beat/dissonance. */
  playWraithGroan(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const a = ctx.createOscillator();
    a.type = 'sine';
    a.frequency.setValueAtTime(140, ctx.currentTime);
    a.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.5);
    const b = ctx.createOscillator();
    b.type = 'sine';
    b.frequency.setValueAtTime(146, ctx.currentTime); // slightly detuned from `a` for real dissonance
    b.frequency.exponentialRampToValueAtTime(72, ctx.currentTime + 0.5);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    a.connect(gain);
    b.connect(gain);
    gain.connect(ctx.destination);
    a.start(ctx.currentTime);
    b.start(ctx.currentTime);
    a.stop(ctx.currentTime + 0.52);
    b.stop(ctx.currentTime + 0.52);
  }

  /** The player's Bear Swipe power activation — previously silent (every other numbered power has
   * its own activation cue; this one relied only on meleeSweep's shared playHit() landing on
   * contact). A heavy whoosh-then-thud, distinct from playChargeDash's driving sawtooth charge-up
   * and from playBearGrowl's own warning-growl role (that's the ENEMY bear warning you; this is
   * YOU swinging). */
  playBearSwipeActivate(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx, 0.22);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.22);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.13, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start();

    const thud = ctx.createOscillator();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(85, ctx.currentTime + 0.08);
    thud.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.24);
    const thudGain = ctx.createGain();
    thudGain.gain.setValueAtTime(0.001, ctx.currentTime + 0.08);
    thudGain.gain.linearRampToValueAtTime(0.14, ctx.currentTime + 0.1);
    thudGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
    thud.connect(thudGain);
    thudGain.connect(ctx.destination);
    thud.start(ctx.currentTime + 0.08);
    thud.stop(ctx.currentTime + 0.3);
  }

  /** Rolling surf — a real ocean's own signature rhythm is not a steady hiss like
   * startMountainWind's gusts, it's a repeated wash-in/wash-out as each wave breaks and recedes.
   * A continuous filtered-noise bed (the "shhh" of water) has its gain driven by a slow LFO
   * (~6.5s period, matching a real breaking-wave cadence) instead of a constant value — that
   * modulation IS the wave sound, not decoration on top of it. */
  startSeaAmbience(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx, 3);
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 700;
    filter.Q.value = 0.5;

    const gain = ctx.createGain();
    gain.gain.value = 0.05;

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 1 / 6.5; // one wave every ~6.5 real seconds
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.035; // modulation depth — gain swings between ~0.015 and ~0.085
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();
    lfo.start();
  }

  /** Real rain, continuously variable — unlike every other `start*` layer here, this one's
   * loudness needs to track WeatherSystem's live `rainIntensity` every frame (a drizzle building
   * into a storm should audibly build, not jump from silent to full volume the instant rain
   * starts). Lazily creates the noise-loop/gain graph on its first call (idempotent — later calls
   * just adjust the existing gain), so callers can pass a live intensity every frame without
   * worrying about "did I start this yet." A higher-frequency, harsher-filtered noise bed than
   * startSeaAmbience's surf — real rain reads as a bright hiss, not a low rolling wash. */
  setRainIntensity(intensity: number): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    if (!this.rainGain) {
      const noise = ctx.createBufferSource();
      noise.buffer = makeNoiseBuffer(ctx, 2);
      noise.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 1200;
      this.rainGain = ctx.createGain();
      this.rainGain.gain.value = 0;
      noise.connect(filter);
      filter.connect(this.rainGain);
      this.rainGain.connect(ctx.destination);
      noise.start();
    }
    const clamped = Math.max(0, Math.min(1, intensity));
    this.rainGain.gain.setTargetAtTime(clamped * 0.09, ctx.currentTime, 0.4);
  }

  /** The lion's real telegraph cue — a deep, sustained roar, distinct from every other species'
   * warning sound (playBearGrowl's short growl, playBoarSnort's quick snort, playWraithGroan's
   * unearthly moan). A low sawtooth oscillator with a slow pitch dip reads as a real chest-deep
   * roar rather than a synth tone, layered with filtered noise for breath/rasp. */
  playLionRoar(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.5);
    const oscFilter = ctx.createBiquadFilter();
    oscFilter.type = 'lowpass';
    oscFilter.frequency.value = 500;
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0, ctx.currentTime);
    oscGain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 0.08);
    oscGain.gain.linearRampToValueAtTime(0.16, ctx.currentTime + 0.3);
    oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    osc.connect(oscFilter);
    oscFilter.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.55);

    const noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx, 0.55);
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 350;
    noiseFilter.Q.value = 0.7;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.05, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start();
  }

  /** The player's Lion's Pounce power activation — a short explosive whoosh, distinct from
   * playChargeDash's driving sawtooth ramp (boar-charge) and playBearSwipeActivate's heavy
   * whoosh-then-thud (this one has no landing thud; the real hit lands via meleeSweep's own
   * playHit(), same as every other power). */
  playLionPounceActivate(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx, 0.3);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(300, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.3);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.16, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();
  }

  /** Real evasive-roll cue — a quick rising whoosh, distinct from playChargeDash's driving
   * sawtooth ramp (an offensive charge) and playLionPounceActivate's short explosive burst (an
   * attack) — this one reads as movement AWAY from danger, a rising pitch rather than either of
   * those attacks' own shapes. */
  playDodgeRoll(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx, 0.25);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(500, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.22);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();
  }

  /** A real blocked hit: a short, dull, low-pitched thud — deliberately unlike playPlayerHurt's
   * own cue (a blocked hit reads as "absorbed," not "wounded"). */
  playBlockImpact(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.12);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.14, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
  }

  startVillageAmbience(): void {
    // A single warm, sustained drone — deliberately sparser than startJungleAmbience's
    // multi-layer canopy/floor/bird/water soundscape or startMountainWind's noise gusts: this is
    // a resolution beat, not an explorable environment, so one gentle harmonic layer is enough to
    // signal safety/warmth without competing with the arc-complete chime.
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 130;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.035, ctx.currentTime + 2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
  }

  /** The crocodile's telegraph — a real threat-display hiss, deliberately much lower and throatier
   * than the viper's own airy 5200Hz hiss (a crocodile is a far bigger animal): a low bandpass
   * growl around 900Hz with a real sub-bass rumble underneath for genuine weight, not just a
   * pitched-down copy of the viper's cue. */
  playCrocodileHiss(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx, 0.6);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    filter.Q.value = 1.1;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, ctx.currentTime);
    noiseGain.gain.linearRampToValueAtTime(0.09, ctx.currentTime + 0.15);
    noiseGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start();

    const rumble = ctx.createOscillator();
    rumble.type = 'sine';
    rumble.frequency.value = 55;
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(0, ctx.currentTime);
    rumbleGain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.2);
    rumbleGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
    rumble.connect(rumbleGain);
    rumbleGain.connect(ctx.destination);
    rumble.start();
    rumble.stop(ctx.currentTime + 0.62);
  }

  /** Croc Lunge's real bite-snap: a sharp high-frequency crack (jaws slamming shut) landing right
   * on top of a deep thud (real impact weight) — the two layers arrive together, not staggered
   * like playBearSwipeActivate's noise-then-thud, since a real bite is one instantaneous event,
   * not a wind-up-then-impact swing. */
  playCrocodileLungeActivate(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const crack = ctx.createBufferSource();
    crack.buffer = makeNoiseBuffer(ctx, 0.1);
    const crackFilter = ctx.createBiquadFilter();
    crackFilter.type = 'highpass';
    crackFilter.frequency.value = 2200;
    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(0.2, ctx.currentTime);
    crackGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    crack.connect(crackFilter);
    crackFilter.connect(crackGain);
    crackGain.connect(ctx.destination);
    crack.start();

    const thud = ctx.createOscillator();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(90, ctx.currentTime);
    thud.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.22);
    const thudGain = ctx.createGain();
    thudGain.gain.setValueAtTime(0.16, ctx.currentTime);
    thudGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    thud.connect(thudGain);
    thudGain.connect(ctx.destination);
    thud.start();
    thud.stop(ctx.currentTime + 0.27);
  }

  // Real per-species HURT reactions — every landed player hit used to route through the one
  // generic playHit() thud regardless of which animal was struck (a real, user-reported gap: "not
  // just eating eating is a ceremony... real animal voices should be there... not just tuun
  // tuun"). Each of these is deliberately distinct from BOTH playHit() (still used as the
  // fallback for species with no dedicated cue) and that species' own telegraph/aggro sound above
  // — a hurt reaction has a hard, unramped attack (pain snaps open, it doesn't build like a
  // threat display) and is shorter, reading as "struck," not "warning."

  /** Real boar squeal: a RISING pitch burst, the opposite direction of playBoarSnort's falling
   * grunt — a real pained squeal climbs, a threat-snort doesn't. */
  playBoarHurt(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx, 0.12);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1400;
    filter.Q.value = 1.2;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.14, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start();

    const squeal = ctx.createOscillator();
    squeal.type = 'sawtooth';
    squeal.frequency.setValueAtTime(300, ctx.currentTime);
    squeal.frequency.linearRampToValueAtTime(650, ctx.currentTime + 0.1);
    const squealGain = ctx.createGain();
    squealGain.gain.setValueAtTime(0.09, ctx.currentTime);
    squealGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    squeal.connect(squealGain);
    squealGain.connect(ctx.destination);
    squeal.start();
    squeal.stop(ctx.currentTime + 0.16);
  }

  /** Real bear hurt-bark: higher and brighter than playBearGrowl's low 420->150Hz sweep, with a
   * hard unramped attack instead of the growl's own building swell — reused for the Elder Bear
   * King too, since he's the same animal underneath the crown. */
  playBearHurt(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx, 0.16);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.16, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start();

    const bark = ctx.createOscillator();
    bark.type = 'sawtooth';
    bark.frequency.setValueAtTime(160, ctx.currentTime);
    bark.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.15);
    const barkGain = ctx.createGain();
    barkGain.gain.setValueAtTime(0.1, ctx.currentTime);
    barkGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    bark.connect(barkGain);
    barkGain.connect(ctx.destination);
    bark.start();
    bark.stop(ctx.currentTime + 0.17);
  }

  /** Real owl hurt-yelp: much shorter than playOwlScreech's 0.45s hunting cry, and snaps down
   * fast (2600->1400Hz over 0.15s) instead of the screech's long, deliberate glide. */
  playOwlHurt(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx, 0.18);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3200;
    filter.Q.value = 1.6;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.13, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start();

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(2600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.15);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.05, ctx.currentTime);
    oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
  }

  /** Real viper hurt hiss-spit: a hard-attack burst (vs. playViperHiss's gentle swell-then-fall)
   * plus a short low body-recoil thump — real recoil weight the pure-hiss aggro cue never has. */
  playViperHurt(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx, 0.15);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 4600;
    filter.Q.value = 1.0;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.09, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();

    const thump = ctx.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(120, ctx.currentTime);
    thump.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.12);
    const thumpGain = ctx.createGain();
    thumpGain.gain.setValueAtTime(0.07, ctx.currentTime);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    thump.connect(thumpGain);
    thumpGain.connect(ctx.destination);
    thump.start();
    thump.stop(ctx.currentTime + 0.14);
  }

  /** Real lion hurt-snarl: sharper and shorter than playLionRoar's big triumphant 0.55s sweep,
   * with a hard unramped attack instead of the roar's own building swell. */
  playLionHurt(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.18);
    const oscFilter = ctx.createBiquadFilter();
    oscFilter.type = 'lowpass';
    oscFilter.frequency.value = 900;
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.18, ctx.currentTime);
    oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.connect(oscFilter);
    oscFilter.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.22);

    const noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx, 0.2);
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 600;
    noiseFilter.Q.value = 0.8;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.05, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start();
  }

  /** Real crocodile hurt hiss-thrash: shorter and hard-attack (vs. playCrocodileHiss's slow
   * threat-display swell), with a low thrashing thump standing in for real body-roll weight. */
  playCrocodileHurt(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx, 0.22);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1100;
    filter.Q.value = 1.0;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.13, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start();

    const thrash = ctx.createOscillator();
    thrash.type = 'square';
    thrash.frequency.setValueAtTime(80, ctx.currentTime);
    thrash.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.18);
    const thrashGain = ctx.createGain();
    thrashGain.gain.setValueAtTime(0.09, ctx.currentTime);
    thrashGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    thrash.connect(thrashGain);
    thrashGain.connect(ctx.destination);
    thrash.start();
    thrash.stop(ctx.currentTime + 0.22);
  }

  // Real per-species DEATH cries — play alongside playKnockout()'s own generic crack/boom/rumble
  // (that stays as the universal physical-impact layer; these add the missing vocal identity on
  // top). Distinct from the hurt reactions above in shape, not just duration: a death cry has a
  // real ATTACK then a long FALLING fade to nothing — expiring, not flinching — where a hurt
  // reaction snaps open and cuts off short. Wraith and King intentionally excluded: the wraith's
  // "defeat" is dissolving, not a normal animal dying, and the King's fall is its own scripted
  // coronation beat elsewhere, neither is a normal kill.

  /** Real boar death: the hurt squeal's rising shape inverted — starts high, falls and fades,
   * roughly triple the hurt reaction's own length. */
  playBoarDeath(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const cry = ctx.createOscillator();
    cry.type = 'sawtooth';
    cry.frequency.setValueAtTime(600, ctx.currentTime);
    cry.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.4);
    const cryGain = ctx.createGain();
    cryGain.gain.setValueAtTime(0.1, ctx.currentTime);
    cryGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.42);
    cry.connect(cryGain);
    cryGain.connect(ctx.destination);
    cry.start();
    cry.stop(ctx.currentTime + 0.44);

    const noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx, 0.3);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.08, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start();
  }

  /** Real bear death: a deep falling groan-roar that fades over 0.6s — much longer and lower
   * than playBearHurt's short bright bark, a real final sound. */
  playBearDeath(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const roar = ctx.createOscillator();
    roar.type = 'sawtooth';
    roar.frequency.setValueAtTime(140, ctx.currentTime);
    roar.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.6);
    const roarFilter = ctx.createBiquadFilter();
    roarFilter.type = 'lowpass';
    roarFilter.frequency.value = 400;
    const roarGain = ctx.createGain();
    roarGain.gain.setValueAtTime(0.14, ctx.currentTime);
    roarGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    roar.connect(roarFilter);
    roarFilter.connect(roarGain);
    roarGain.connect(ctx.destination);
    roar.start();
    roar.stop(ctx.currentTime + 0.62);

    const noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx, 0.5);
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 350;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.06, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start();
  }

  /** Real owl death: a falling screech that fades to nothing over 0.5s — the wings going still,
   * unlike playOwlHurt's short, sharp yelp. */
  playOwlDeath(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx, 0.5);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2800, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.5);
    filter.Q.value = 1.3;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.12, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start();

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(2000, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.45);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.04, ctx.currentTime);
    oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.48);
  }

  /** Real viper death: a long hiss that thins and fades over 0.5s, with no recoil thump at all —
   * unlike playViperHurt, there's no more body left to recoil. */
  playViperDeath(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx, 0.55);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(5000, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(2200, ctx.currentTime + 0.55);
    filter.Q.value = 0.9;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();
  }

  /** Real lion death: a falling roar that fades over 0.6s — the jungle's own crown falling
   * silent, longer and lower than playLionHurt's sharp snarl. */
  playLionDeath(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.6);
    const oscFilter = ctx.createBiquadFilter();
    oscFilter.type = 'lowpass';
    oscFilter.frequency.value = 550;
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.15, ctx.currentTime);
    oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.connect(oscFilter);
    oscFilter.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.62);

    const noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx, 0.5);
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 400;
    noiseFilter.Q.value = 0.7;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.05, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start();
  }

  /** Real crocodile death: a low fading growl-hiss with one final splashy thud — longer and
   * lower than playCrocodileHurt's sharp thrash. */
  playCrocodileDeath(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx, 0.5);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 750;
    filter.Q.value = 1.0;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.11, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start();

    const splash = ctx.createOscillator();
    splash.type = 'sine';
    splash.frequency.setValueAtTime(70, ctx.currentTime);
    splash.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.4);
    const splashGain = ctx.createGain();
    splashGain.gain.setValueAtTime(0.1, ctx.currentTime);
    splashGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    splash.connect(splashGain);
    splashGain.connect(ctx.destination);
    splash.start();
    splash.stop(ctx.currentTime + 0.42);
  }

  /** The player fox's own voice — a real short, high-pitched double-yip, distinct from every
   * predator sound above (all lower and longer): a fox bark is quick, bright, almost bird-like.
   * Used as the character-select voice preview (CharacterSelect.ts) alongside playBearGrowl/
   * playViperHiss for the other 2 playable species — previously the only playable species with
   * no voice of its own anywhere in the game. */
  playFoxBark(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const yip = (delay: number) => {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(950, ctx.currentTime + delay);
      osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + delay + 0.08);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.08, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.1);
    };
    yip(0);
    yip(0.12);
  }
}
