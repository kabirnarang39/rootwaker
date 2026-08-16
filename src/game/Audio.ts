/** Small synthesized SFX/ambience — no external audio assets. */
export class AudioFX {
  private ctx: AudioContext | null = null;
  private ambientGain: GainNode | null = null;

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
    const canopyBufferSize = ctx.sampleRate * 2;
    const canopyBuffer = ctx.createBuffer(1, canopyBufferSize, ctx.sampleRate);
    const canopyData = canopyBuffer.getChannelData(0);
    for (let i = 0; i < canopyBufferSize; i++) canopyData[i] = Math.random() * 2 - 1;
    const canopyNoise = ctx.createBufferSource();
    canopyNoise.buffer = canopyBuffer;
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
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
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
    const bufferSize = ctx.sampleRate * 0.7;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
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
}
