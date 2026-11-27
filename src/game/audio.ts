// Procedural Web Audio API engine synthesizer (Moto3 / Moto2 / MotoGP), BGM sequencer & motorsport SFX
import type { BikeClassId, SurfaceType } from './types';

export type BgmMode = 'off' | 'title' | 'race';

export interface EngineAudioParams {
  fundamentalHz: number;
  subHarmonicHz: number;
  overtoneHz: number;
  filterHz: number;
  filterQ: number;
  primaryWave: OscillatorType;
  subWave: OscillatorType;
  overtoneWave: OscillatorType;
  subGain: number;
  overtoneGain: number;
  masterEngineGain: number;
}

export function computeEngineAudioParams(
  rpm: number,
  throttle: number,
  isBoosting: boolean,
  bikeClass: BikeClassId = 'motogp',
  gear = 1,
): EngineAudioParams {
  const safeRpm = Math.max(2200, rpm);
  const clampedGear = Math.max(1, Math.min(6, gear));
  // Higher gears subtly shift intake load & exhaust resonance upward
  const gearLoadPitch = 0.93 + (clampedGear - 1) * 0.03;
  const boostPitch = isBoosting ? 1.07 : 1.0;

  if (bikeClass === 'moto3') {
    // 250cc Single-Cylinder: crisp thumper pulse + high-rev valve-train zing
    const fundamentalHz = Math.max(48, (safeRpm / 60) * 1.62 * gearLoadPitch * boostPitch);
    return {
      fundamentalHz,
      subHarmonicHz: fundamentalHz * 0.5,
      overtoneHz: fundamentalHz * 2.0,
      filterHz: 380 + (safeRpm / 14000) * 2800 + (isBoosting ? 750 : 0),
      filterQ: 4.4,
      primaryWave: 'sawtooth',
      subWave: 'square',
      overtoneWave: 'triangle',
      subGain: 0.42,
      overtoneGain: 0.36,
      masterEngineGain: 0.085 + throttle * 0.125 + (isBoosting ? 0.045 : 0),
    };
  }

  if (bikeClass === 'moto2') {
    // 765cc Inline-3 Triple: unmistakable 1.5x fifth harmonic + silky intake howl
    const fundamentalHz = Math.max(54, (safeRpm / 60) * 1.92 * gearLoadPitch * boostPitch);
    return {
      fundamentalHz,
      subHarmonicHz: fundamentalHz * 1.5,
      overtoneHz: fundamentalHz * 3.0,
      filterHz: 340 + (safeRpm / 15000) * 2600 + (isBoosting ? 800 : 0),
      filterQ: 3.1,
      primaryWave: 'sawtooth',
      subWave: 'triangle',
      overtoneWave: 'sawtooth',
      subGain: 0.48,
      overtoneGain: 0.28,
      masterEngineGain: 0.085 + throttle * 0.13 + (isBoosting ? 0.05 : 0),
    };
  }

  // MotoGP 1000cc Big-Bang V4: aggressive low-end firing pulse + screaming top-end V4 snarl
  const fundamentalHz = Math.max(52, (safeRpm / 60) * 1.78 * gearLoadPitch * boostPitch);
  return {
    fundamentalHz,
    subHarmonicHz: fundamentalHz * 0.75,
    overtoneHz: fundamentalHz * 2.5,
    filterHz: 310 + (safeRpm / 16500) * 3200 + (isBoosting ? 950 : 0),
    filterQ: 2.5,
    primaryWave: 'sawtooth',
    subWave: 'square',
    overtoneWave: 'sawtooth',
    subGain: 0.52,
    overtoneGain: 0.34,
    masterEngineGain: 0.092 + throttle * 0.14 + (isBoosting ? 0.06 : 0),
  };
}

// Official MotoGP Broadcast Championship Menu Anthem (118 BPM, 64-step 4-bar D minor fanfare)
// Combines soaring French Horn / Synth Brass lead melody, driving string ostinato, and timpani/snare march
export interface AnthemStepSpec {
  bassHz: number;
  leadHz: number | null;
  ostinatoHz: number;
  kick: boolean;
  snare: boolean;
  crashCymbal: boolean;
}

const ANTHEM_CHORD_BASS = [
  73.42, // Bar 0: Dm (D2)
  58.27, // Bar 1: Bb (Bb1)
  65.41, // Bar 2: C  (C2)
  55.0, // Bar 3: A7 (A1)
];

// Dramatic heroic MotoGP-style championship melody (D4, A4, F4, G4, A4, Bb4, C5, D5...)
const ANTHEM_LEAD_64: Array<number | null> = [
  // Bar 0 (Dm)
  293.66, null, null, null, 440.0, null, 392.0, null, 349.23, null, null, null, 329.63, null, 293.66, null,
  // Bar 1 (Bb)
  233.08, null, null, null, 349.23, null, 392.0, null, 440.0, null, null, null, 466.16, null, 440.0, null,
  // Bar 2 (C)
  392.0, null, null, null, 523.25, null, 493.88, null, 440.0, null, null, null, 392.0, null, 349.23, null,
  // Bar 3 (A -> Dm turnaround)
  329.63, null, 349.23, null, 392.0, null, 440.0, null, 523.25, null, 493.88, null, 440.0, null, 329.63, null,
];

const ANTHEM_OSTINATO_BARS: number[][] = [
  [293.66, 349.23, 440.0, 349.23], // Dm
  [233.08, 293.66, 349.23, 293.66], // Bb
  [261.63, 329.63, 392.0, 329.63], // C
  [220.0, 277.18, 329.63, 277.18], // A major dominant tension
];

export function getTitleAnthemStepSpec(step: number): AnthemStepSpec {
  const s = ((step % 64) + 64) % 64;
  const bar = Math.floor(s / 16);
  const beatStep = s % 16;
  const ostBar = ANTHEM_OSTINATO_BARS[bar % ANTHEM_OSTINATO_BARS.length];

  return {
    bassHz: ANTHEM_CHORD_BASS[bar % ANTHEM_CHORD_BASS.length],
    leadHz: ANTHEM_LEAD_64[s],
    ostinatoHz: ostBar[s % ostBar.length],
    kick: beatStep === 0 || beatStep === 6 || beatStep === 8 || beatStep === 14,
    snare: beatStep === 4 || beatStep === 12 || (bar === 3 && beatStep >= 13),
    crashCymbal: s === 0 || s === 32,
  };
}

export class MotoAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private oscPrimary: OscillatorNode | null = null;
  private oscSub: OscillatorNode | null = null;
  private oscOvertone: OscillatorNode | null = null;
  private subGainNode: GainNode | null = null;
  private overtoneGainNode: GainNode | null = null;
  private exhaustFilter: BiquadFilterNode | null = null;
  private currentEngineClass: BikeClassId | null = null;
  private lastGear = 1;
  private gearDipUntil = 0;

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
      const target = enabled && this.bgmMode !== 'off' ? (this.bgmMode === 'race' ? 0.24 : 0.26) : 0;
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
    this.bgmStep = 0;
    if (this.bgmGain && this.ctx) {
      const target = this.bgmEnabled && mode !== 'off' ? (mode === 'race' ? 0.24 : 0.26) : 0;
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

      // 3-Oscillator Class-Specific Engine Synth Chain
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 520;
      filter.Q.value = 2.8;

      const engineGain = ctx.createGain();
      engineGain.gain.value = 0;

      const osc1 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.value = 85;

      const oscSub = ctx.createOscillator();
      oscSub.type = 'square';
      oscSub.frequency.value = 64;

      const subGain = ctx.createGain();
      subGain.gain.value = 0.45;

      const oscOvertone = ctx.createOscillator();
      oscOvertone.type = 'sawtooth';
      oscOvertone.frequency.value = 212;

      const overtoneGain = ctx.createGain();
      overtoneGain.gain.value = 0.32;

      osc1.connect(filter);
      oscSub.connect(subGain);
      subGain.connect(filter);
      oscOvertone.connect(overtoneGain);
      overtoneGain.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);

      osc1.start();
      oscSub.start();
      oscOvertone.start();

      this.oscPrimary = osc1;
      this.oscSub = oscSub;
      this.oscOvertone = oscOvertone;
      this.subGainNode = subGain;
      this.overtoneGainNode = overtoneGain;
      this.exhaustFilter = filter;
      this.engineGain = engineGain;

      // Reusable 1.5s white noise buffer for gravel / curb / boost whoosh / hi-hats / snares
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
        this.bgmEnabled && this.bgmMode !== 'off' ? (this.bgmMode === 'race' ? 0.24 : 0.26) : 0;
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

    const isRace = this.bgmMode === 'race';
    const bpm = isRace ? 138 : 118;
    const stepDur = 60 / bpm / 4; // 16th note duration
    const lookahead = 0.16;
    const loopSteps = isRace ? 32 : 64;

    while (this.nextStepTime < this.ctx.currentTime + lookahead) {
      this.triggerBgmStep(this.bgmStep, this.nextStepTime, stepDur);
      this.nextStepTime += stepDur;
      this.bgmStep = (this.bgmStep + 1) % loopSteps;
    }
  }

  private triggerBgmStep(step: number, t: number, stepDur: number): void {
    if (!this.ctx || !this.bgmGain) return;
    const isRace = this.bgmMode === 'race';

    if (isRace) {
      const bassRoots = [73.42, 73.42, 58.27, 65.41]; // D2, D2, Bb1, C2
      const bar = Math.floor(step / 8);
      const rootFreq = bassRoots[bar % bassRoots.length];

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
      return;
    }

    // Authentic MotoGP World Feed Orchestral Broadcast Menu Anthem
    const spec = getTitleAnthemStepSpec(step);

    // 1. Timpani & Taiko march kick
    if (spec.kick) {
      const timp = this.ctx.createOscillator();
      const tGain = this.ctx.createGain();
      timp.type = 'sine';
      timp.frequency.setValueAtTime(102, t);
      timp.frequency.exponentialRampToValueAtTime(44, t + 0.16);
      tGain.gain.setValueAtTime(0.36, t);
      tGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      timp.connect(tGain);
      tGain.connect(this.bgmGain);
      timp.start(t);
      timp.stop(t + 0.24);
    }

    // 2. Orchestral Snare Drum Hit
    if (spec.snare && this.noiseBuffer) {
      const sn = this.ctx.createBufferSource();
      sn.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1950, t);
      bp.Q.value = 1.1;
      const sGain = this.ctx.createGain();
      sGain.gain.setValueAtTime(0.14, t);
      sGain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      sn.connect(bp);
      bp.connect(sGain);
      sGain.connect(this.bgmGain);
      sn.start(t);
      sn.stop(t + 0.12);
    }

    // 3. Cymbal Swell on section downbeats
    if (spec.crashCymbal && this.noiseBuffer) {
      const cym = this.ctx.createBufferSource();
      cym.buffer = this.noiseBuffer;
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(5200, t);
      const cGain = this.ctx.createGain();
      cGain.gain.setValueAtTime(0.09, t);
      cGain.gain.exponentialRampToValueAtTime(0.001, t + 0.72);
      cym.connect(hp);
      hp.connect(cGain);
      cGain.connect(this.bgmGain);
      cym.start(t);
      cym.stop(t + 0.74);
    }

    // 4. Sustained Low Brass Bass Foundation on bar starts
    if (step % 16 === 0 || step % 16 === 8) {
      const bass = this.ctx.createOscillator();
      const bFilt = this.ctx.createBiquadFilter();
      const bGain = this.ctx.createGain();
      bass.type = 'sawtooth';
      bass.frequency.setValueAtTime(spec.bassHz, t);
      bFilt.type = 'lowpass';
      bFilt.frequency.setValueAtTime(340, t);
      bGain.gain.setValueAtTime(0.24, t);
      bGain.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 7.6);
      bass.connect(bFilt);
      bFilt.connect(bGain);
      bGain.connect(this.bgmGain);
      bass.start(t);
      bass.stop(t + stepDur * 7.8);
    }

    // 5. Driving 16th-Note String Ostinato
    const ost = this.ctx.createOscillator();
    const oFilt = this.ctx.createBiquadFilter();
    const oGain = this.ctx.createGain();
    ost.type = 'sawtooth';
    ost.frequency.setValueAtTime(spec.ostinatoHz, t);
    oFilt.type = 'bandpass';
    oFilt.frequency.setValueAtTime(1100, t);
    oFilt.Q.value = 0.85;
    oGain.gain.setValueAtTime(step % 2 === 0 ? 0.085 : 0.055, t);
    oGain.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 0.92);
    ost.connect(oFilt);
    oFilt.connect(oGain);
    oGain.connect(this.bgmGain);
    ost.start(t);
    ost.stop(t + stepDur * 0.96);

    // 6. Dual-Voice French Horn / Brass Anthem Lead
    if (spec.leadHz !== null) {
      const hornA = this.ctx.createOscillator();
      const hornB = this.ctx.createOscillator();
      const hFilt = this.ctx.createBiquadFilter();
      const hGain = this.ctx.createGain();

      hornA.type = 'sawtooth';
      hornB.type = 'triangle';
      hornA.frequency.setValueAtTime(spec.leadHz, t);
      hornB.frequency.setValueAtTime(spec.leadHz * 0.5, t);

      hFilt.type = 'lowpass';
      hFilt.frequency.setValueAtTime(950, t);
      hFilt.frequency.linearRampToValueAtTime(2200, t + 0.09);
      hFilt.frequency.exponentialRampToValueAtTime(1250, t + stepDur * 3.2);

      hGain.gain.setValueAtTime(0.01, t);
      hGain.gain.linearRampToValueAtTime(0.18, t + 0.045);
      hGain.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 3.6);

      hornA.connect(hFilt);
      hornB.connect(hFilt);
      hFilt.connect(hGain);
      hGain.connect(this.bgmGain);

      hornA.start(t);
      hornB.start(t);
      hornA.stop(t + stepDur * 3.7);
      hornB.stop(t + stepDur * 3.7);
    }
  }

  public updateEngine(
    rpm: number,
    throttle: number,
    isBoosting: boolean,
    active: boolean,
    bikeClass: BikeClassId = 'motogp',
    gear = 1,
  ): void {
    if (
      !this.initialized ||
      !this.ctx ||
      !this.oscPrimary ||
      !this.oscSub ||
      !this.oscOvertone ||
      !this.subGainNode ||
      !this.overtoneGainNode ||
      !this.exhaustFilter ||
      !this.engineGain
    ) {
      return;
    }
    const t = this.ctx.currentTime;
    if (!active || this.muted) {
      this.engineGain.gain.setTargetAtTime(0, t, 0.06);
      return;
    }

    const params = computeEngineAudioParams(rpm, throttle, isBoosting, bikeClass, gear);

    if (this.currentEngineClass !== bikeClass) {
      this.currentEngineClass = bikeClass;
      this.oscPrimary.type = params.primaryWave;
      this.oscSub.type = params.subWave;
      this.oscOvertone.type = params.overtoneWave;
      this.exhaustFilter.Q.setTargetAtTime(params.filterQ, t, 0.04);
      this.subGainNode.gain.setTargetAtTime(params.subGain, t, 0.04);
      this.overtoneGainNode.gain.setTargetAtTime(params.overtoneGain, t, 0.04);
    }

    // Trigger quickshifter cut/blip when gear shifts while actively rolling
    if (gear !== this.lastGear) {
      const isUpshift = gear > this.lastGear;
      this.lastGear = gear;
      this.gearDipUntil = t + 0.055;
      this.playGearShift(isUpshift, bikeClass);
    }

    this.oscPrimary.frequency.setTargetAtTime(params.fundamentalHz, t, 0.025);
    this.oscSub.frequency.setTargetAtTime(params.subHarmonicHz, t, 0.025);
    this.oscOvertone.frequency.setTargetAtTime(params.overtoneHz, t, 0.025);
    this.exhaustFilter.frequency.setTargetAtTime(params.filterHz, t, 0.035);

    const cutScale = t < this.gearDipUntil ? 0.38 : 1.0;
    this.engineGain.gain.setTargetAtTime(params.masterEngineGain * cutScale, t, 0.028);
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
      this.surfaceFilter.frequency.setTargetAtTime(240 + speedRatio * 180, t, 0.03);
      this.surfaceGain.gain.setTargetAtTime(0.065 * speedRatio, t, 0.03);
    } else if (surface === 'gravel') {
      this.surfaceFilter.frequency.setTargetAtTime(1600 + speedRatio * 1100, t, 0.03);
      this.surfaceGain.gain.setTargetAtTime(0.16 * speedRatio, t, 0.03);
    } else {
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

  public playGearShift(isUpshift = true, bikeClass: BikeClassId = 'motogp'): void {
    if (this.muted || !this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const classScale = bikeClass === 'moto3' ? 1.25 : bikeClass === 'moto2' ? 1.08 : 1.0;

    if (isUpshift) {
      // Seamless quickshifter exhaust crackle + pitch drop
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(240 * classScale, t);
      osc.frequency.exponentialRampToValueAtTime(95 * classScale, t + 0.055);
      gain.gain.setValueAtTime(0.095, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    } else {
      // Auto-blipper throttle rev-match chirp on downshift
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160 * classScale, t);
      osc.frequency.exponentialRampToValueAtTime(340 * classScale, t + 0.065);
      gain.gain.setValueAtTime(0.085, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
    }
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  public playBoostStart(): void {
    if (this.muted || !this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

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

  public playWeatherCue(isRain: boolean): void {
    if (this.muted || !this.ctx || !this.masterGain) return;
    const notes = isRain ? [392.0, 329.63, 293.66] : [440.0, 523.25];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = this.ctx.currentTime + idx * 0.09;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.09, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.25);
    });
  }

  public playBroadcastChime(): void {
    if (this.muted || !this.ctx || !this.masterGain) return;
    const notes = [440.0, 587.33, 880.0];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = this.ctx.currentTime + idx * 0.065;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.24);
    });
  }

  public dispose(): void {
    if (this.bgmTimer !== null) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
    try {
      this.oscPrimary?.stop();
      this.oscSub?.stop();
      this.oscOvertone?.stop();
      this.surfaceSource?.stop();
      void this.ctx?.close();
    } catch {
      // ignore
    }
    this.initialized = false;
  }
}
