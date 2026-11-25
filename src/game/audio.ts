// Procedural Web Audio API 4-cylinder MotoGP engine synthesizer & SFX

export class MotoAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private oscPrimary: OscillatorNode | null = null;
  private oscHarmonic: OscillatorNode | null = null;
  private exhaustFilter: BiquadFilterNode | null = null;
  private muted = false;
  private initialized = false;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(mute ? 0 : 0.32, this.ctx.currentTime, 0.04);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public unlock(): void {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      this.ctx = ctx;

      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 0.32;
      master.connect(ctx.destination);
      this.masterGain = master;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 520;
      filter.Q.value = 3.2;

      const engineGain = ctx.createGain();
      engineGain.gain.value = 0;

      const osc1 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.value = 85;

      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.value = 170;

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);

      osc1.start();
      osc2.start();

      this.oscPrimary = osc1;
      this.oscHarmonic = osc2;
      this.exhaustFilter = filter;
      this.engineGain = engineGain;
      this.initialized = true;
    } catch {
      // AudioContext unavailable in headless/restricted environment
    }
  }

  public updateEngine(rpm: number, throttle: number, isBoosting: boolean, active: boolean): void {
    if (!this.initialized || !this.ctx || !this.oscPrimary || !this.oscHarmonic || !this.exhaustFilter || !this.engineGain) {
      return;
    }
    const t = this.ctx.currentTime;
    if (!active || this.muted) {
      this.engineGain.gain.setTargetAtTime(0, t, 0.06);
      return;
    }
    // 4-cylinder MotoGP screamer firing frequency
    const freq = Math.max(55, (rpm / 60) * 2.1);
    this.oscPrimary.frequency.setTargetAtTime(freq, t, 0.03);
    this.oscHarmonic.frequency.setTargetAtTime(freq * (isBoosting ? 2.02 : 1.5), t, 0.03);

    const filterFreq = 320 + (rpm / 16000) * 2400 + (isBoosting ? 800 : 0);
    this.exhaustFilter.frequency.setTargetAtTime(filterFreq, t, 0.04);

    const vol = 0.09 + throttle * 0.14 + (isBoosting ? 0.06 : 0);
    this.engineGain.gain.setTargetAtTime(vol, t, 0.04);
  }

  public silenceEngine(): void {
    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04);
    }
  }

  public playCountdownTone(isGo: boolean): void {
    if (this.muted || !this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = isGo ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isGo ? 880 : 440, t);
    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (isGo ? 0.38 : 0.16));
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + (isGo ? 0.4 : 0.18));
  }

  public playGearShift(): void {
    if (this.muted || !this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.055);
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.065);
  }

  public playImpact(intensity: number): void {
    if (this.muted || !this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140 * (0.9 + Math.random() * 0.2), t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.14);
    gain.gain.setValueAtTime(Math.min(0.32, 0.12 + intensity * 0.2), t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.17);
  }

  public playLapComplete(isFinish: boolean): void {
    if (this.muted || !this.ctx || !this.masterGain) return;
    const notes = isFinish ? [523.25, 659.25, 783.99, 1046.5] : [587.33, 880];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = this.ctx.currentTime + idx * 0.085;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.28);
    });
  }

  public dispose(): void {
    try {
      this.oscPrimary?.stop();
      this.oscHarmonic?.stop();
      void this.ctx?.close();
    } catch {
      // ignore
    }
    this.initialized = false;
  }
}
