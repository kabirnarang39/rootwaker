/** Small synthesized SFX/ambience — no external audio assets. */
export class AudioFX {
  private ctx: AudioContext | null = null;
  private ambientGain: GainNode | null = null;

  unlock() {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.startAmbient();
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

  private startAmbient() {
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
}
