// Procedural Web Audio API engine synthesizer, BGM sequencer & motorsport SFX
import type { BikeClassId, SurfaceType } from './types';

export type BgmMode = 'off' | 'title' | 'race';

export class MotoAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private oscPrimary: OscillatorNode | null = null;
  private oscHarmonic: OscillatorNode | null = null;
  private exhaustFilter: BiquadFilterNode | null = null;

  // Surface noise (gravel crunch & curb rumble)
  private surfaceGain: GainNode | null = null;
  private surfaceFilter: BiquadFilterNode | null = null;
  private surfaceSource: AudioBufferSourceNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  // Procedural BGM sequencer
  private bgmGain: GainNode | null = null;
  private bgmMode: BgmMode = 'title';
  private bgmEnabled = true;
  private bgmTimer: number | null = null;
  private bgmStep = 0;
  private nextStepTime = 0;

  private muted = false;
  private initialized = false;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(mute ? 0 : 0.34, this.ctx.currentTime, 0.04);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public isBgmEnabled(): boolean {
    return this.bgmEnabled;
  }

  public setBgmEnabled(enabled: boolean): void {
    this.bgmEnabled = enabled;
    if (this.bgmGain && this.ctx) {
      const target = enabled && this.bgmMode !== 'off' ? (this.bgmMode === 'race' ? 0.24 : 0.2) : 0;
      this.bgmGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    }
  }

  public toggleBgm(): boolean {
    this.setBgmEnabled(!this.bgmEnabled);
    return this.bgmEnabled;
  }

  public setBgmMode(mode: BgmMode): void {
    if (this.bgmMode === mode) return;
    this.bgmMode = mode;
    if (this.bgmGain && this.ctx) {
      const target = this.bgmEnabled && mode !== 'off' ? (mode === 'race' ? 0.24 : 0.2) : 0;
      this.bgmGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.12);
    }
    if (this.ctx) {
      this.nextStepTime = this.ctx.currentTime + 0.05;
    }
  }

  public unlock(): void {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      this.ctx = ctx;

      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 0.34;
      master.connect(ctx.destination);
      this.masterGain = master;

      // Engine synth chain
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 520;
      filter.Q.value = 3.0;

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

      // Reusable 1.5s white noise buffer for gravel / curb / boost whoosh / hi-hats
      const bufLen = Math.floor(ctx.sampleRate * 1.5);
      const noiseBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = noiseBuf;

      // Surface noise loop (gravel spray & curb rumble)
      const surfSrc = ctx.createBufferSource();
      surfSrc.buffer = noiseBuf;
      surfSrc.loop = true;

      const surfFilter = ctx.createBiquadFilter();
      surfFilter.type = 'bandpass';
      surfFilter.frequency.value = 800;
      surfFilter.Q.value = 1.2;

      const surfGain = ctx.createGain();
      surfGain.gain.value = 0;

      surfSrc.connect(surfFilter);
      surfFilter.connect(surfGain);
      surfGain.connect(master);
      surfSrc.start();

      this.surfaceSource = surfSrc;
      this.surfaceFilter = surfFilter;
      this.surfaceGain = surfGain;

      // BGM bus
      const bgmGain = ctx.createGain();
      bgmGain.gain.value =
        this.bgmEnabled && this.bgmMode !== 'off' ? (this.bgmMode === 'race' ? 0.24 : 0.2) : 0;
      bgmGain.connect(master);
      this.bgmGain = bgmGain;

      this.nextStepTime = ctx.currentTime + 0.05;
      this.bgmTimer = window.setInterval(() => this.scheduleBgmSteps(), 65);

      this.initialized = true;
    } catch {
      // AudioContext unavailable in restricted headless environment
    }
  }

  private scheduleBgmSteps(): void {
    if (!this.ctx || !this.bgmGain || this.muted || !this.bgmEnabled || this.bgmMode === 'off') {
      if (this.ctx) {
        this.nextStepTime = this.ctx.currentTime + 0.05;
      }
      return;
    }
    if (this.ctx.state !== 'running') return;

    const bpm = this.bgmMode === 'race' ? 138 : 108;
    const stepDur = 60 / bpm / 4; // 16th note duration
    const lookahead = 0.16;

    while (this.nextStepTime < this.ctx.currentTime + lookahead) {
      this.triggerBgmStep(this.bgmStep, this.nextStepTime, stepDur);
      this.nextStepTime += stepDur;
      this.bgmStep = (this.bgmStep + 1) % 32;
    }
  }

  private triggerBgmStep(step: number, t: number, stepDur: number): void {
    if (!this.ctx || !this.bgmGain) return;
    const isRace = this.bgmMode === 'race';

    // Bass progression (D minor -> Bb -> C -> A)
    const bassRoots = [73.42, 73.42, 58.27, 65.41]; // D2, D2, Bb1, C2
    const bar = Math.floor(step / 8);
    const rootFreq = bassRoots[bar % bassRoots.length];

    if (isRace) {
      // Punchy 4-on-the-floor kick on steps 0, 4, 8, 12, ...
      if (step % 4 === 0) {
        const kick = this.ctx.createOscillator();
        const kGain = this.ctx.createGain();
        kick.type = 'sine';
        kick.frequency.setValueAtTime(118, t);
        kick.frequency.exponentialRampToValueAtTime(42, t + 0.11);
        kGain.gain.setValueAtTime(0.42, t);
        kGain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
        kick.connect(kGain);
        kGain.connect(this.bgmGain);
        kick.start(t);
        kick.stop(t + 0.14);
      }

      // Driving off-beat hi-hat
      if (step % 2 === 1 && this.noiseBuffer) {
        const hat = this.ctx.createBufferSource();
        hat.buffer = this.noiseBuffer;
        const hp = this.ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 6500;
        const hGain = this.ctx.createGain();
        hGain.gain.setValueAtTime(step % 4 === 2 ? 0.11 : 0.055, t);
        hGain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
        hat.connect(hp);
        hp.connect(hGain);
        hGain.connect(this.bgmGain);
        hat.start(t);
        hat.stop(t + 0.05);
      }

      // Driving 8th-note synthwave bassline
      if (step % 2 === 0) {
        const bass = this.ctx.createOscillator();
        const bFilter = this.ctx.createBiquadFilter();
        const bGain = this.ctx.createGain();
        bass.type = 'sawtooth';
        const octave = step % 4 === 2 ? 2 : 1;
        bass.frequency.setValueAtTime(rootFreq * octave, t);
        bFilter.type = 'lowpass';
        bFilter.frequency.setValueAtTime(620, t);
        bGain.gain.setValueAtTime(0.18, t);
        bGain.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 1.7);
        bass.connect(bFilter);
        bFilter.connect(bGain);
        bGain.connect(this.bgmGain);
        bass.start(t);
        bass.stop(t + stepDur * 1.8);
      }

      // Adrenaline motorsport arpeggio
      const arpPattern = [293.66, 349.23, 440.0, 523.25, 440.0, 349.23, 392.0, 440.0];
      const arpFreq = arpPattern[step % arpPattern.length] * (bar === 2 ? 0.89 : 1);
      if (step % 2 === 0 || step % 8 === 7) {
        const lead = this.ctx.createOscillator();
        const lGain = this.ctx.createGain();
        lead.type = 'triangle';
        lead.frequency.setValueAtTime(arpFreq, t);
        lGain.gain.setValueAtTime(0.09, t);
        lGain.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 1.5);
        lead.connect(lGain);
        lGain.connect(this.bgmGain);
        lead.start(t);
        lead.stop(t + stepDur * 1.6);
      }
    } else {
      // Chill Paddock Title groove (quarter bass pulse + soft synth bell arpeggio)
      if (step % 4 === 0) {
        const bass = this.ctx.createOscillator();
        const bGain = this.ctx.createGain();
        bass.type = 'sine';
        bass.frequency.setValueAtTime(rootFreq, t);
        bGain.gain.setValueAtTime(0.24, t);
        bGain.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 3.2);
        bass.connect(bGain);
        bGain.connect(this.bgmGain);
        bass.start(t);
        bass.stop(t + stepDur * 3.4);
      }
      if (step % 4 === 2) {
        const padNotes = [293.66, 349.23, 440.0, 523.25];
        const note = padNotes[Math.floor(step / 4) % padNotes.length];
        if (Number.isFinite(note)) {
          const pad = this.ctx.createOscillator();
          const pGain = this.ctx.createGain();
          pad.type = 'triangle';
          pad.frequency.setValueAtTime(note, t);
          pGain.gain.setValueAtTime(0.09, t);
          pGain.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 3.5);
          pad.connect(pGain);
          pGain.connect(this.bgmGain);
          pad.start(t);
          pad.stop(t + stepDur * 3.6);
        }
      }
    }
  }

  public updateEngine(
    rpm: number,
    throttle: number,
    isBoosting: boolean,
    active: boolean,
    bikeClass: BikeClassId = 'motogp',
  ): void {
    if (!this.initialized || !this.ctx || !this.oscPrimary || !this.oscHarmonic || !this.exhaustFilter || !this.engineGain) {
      return;
    }
    const t = this.ctx.currentTime;
    if (!active || this.muted) {
      this.engineGain.gain.setTargetAtTime(0, t, 0.06);
      return;
    }

    const classPitch = bikeClass === 'moto3' ? 2.45 : bikeClass === 'moto2' ? 1.85 : 2.1;
    const freq = Math.max(55, (rpm / 60) * classPitch);
    this.oscPrimary.frequency.setTargetAtTime(freq, t, 0.03);
    this.oscHarmonic.frequency.setTargetAtTime(freq * (isBoosting ? 2.02 : 1.5), t, 0.03);

    const filterFreq = 320 + (rpm / 16000) * 2400 + (isBoosting ? 850 : 0);
    this.exhaustFilter.frequency.setTargetAtTime(filterFreq, t, 0.04);

    const vol = 0.085 + throttle * 0.13 + (isBoosting ? 0.055 : 0);
    this.engineGain.gain.setTargetAtTime(vol, t, 0.04);
  }

  public updateSurfaceSfx(surface: SurfaceType, speedMs: number, active: boolean): void {
    if (!this.initialized || !this.ctx || !this.surfaceGain || !this.surfaceFilter) return;
    const t = this.ctx.currentTime;
    if (!active || this.muted || speedMs < 6 || surface === 'asphalt') {
      this.surfaceGain.gain.setTargetAtTime(0, t, 0.05);
      return;
    }

    const speedRatio = Math.min(1, speedMs / 55);
    if (surface === 'curb') {
      // Low-mid serrated curb rumble
      this.surfaceFilter.frequency.setTargetAtTime(240 + speedRatio * 180, t, 0.03);
      this.surfaceGain.gain.setTargetAtTime(0.065 * speedRatio, t, 0.03);
    } else if (surface === 'gravel') {
      // Crisp high-frequency gravel spray
      this.surfaceFilter.frequency.setTargetAtTime(1600 + speedRatio * 1100, t, 0.03);
      this.surfaceGain.gain.setTargetAtTime(0.16 * speedRatio, t, 0.03);
    } else {
      // Grass rustle
      this.surfaceFilter.frequency.setTargetAtTime(750 + speedRatio * 400, t, 0.03);
      this.surfaceGain.gain.setTargetAtTime(0.08 * speedRatio, t, 0.03);
    }
  }

  public silenceEngine(): void {
    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04);
    }
    if (this.surfaceGain && this.ctx) {
      this.surfaceGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04);
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
    osc.frequency.setValueAtTime(240, t);
    osc.frequency.exponentialRampToValueAtTime(115, t + 0.05);
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  public playBoostStart(): void {
    if (this.muted || !this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    // Rising turbine tone
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(980, t + 0.22);
    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.3);

    // Filtered air-intake whoosh
    if (this.noiseBuffer) {
      const n = this.ctx.createBufferSource();
      n.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(900, t);
      bp.frequency.exponentialRampToValueAtTime(3200, t + 0.24);
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.12, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
      n.connect(bp);
      bp.connect(ng);
      ng.connect(this.masterGain);
      n.start(t);
      n.stop(t + 0.28);
    }
  }

  public playOvertakeChime(): void {
    if (this.muted || !this.ctx || !this.masterGain) return;
    const notes = [587.33, 783.99];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = this.ctx.currentTime + idx * 0.06;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.11, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.18);
    });
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
    if (this.bgmTimer !== null) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
    try {
      this.oscPrimary?.stop();
      this.oscHarmonic?.stop();
      this.surfaceSource?.stop();
      void this.ctx?.close();
    } catch {
      // ignore
    }
    this.initialized = false;
  }
}
