import { type CircuitData, sampleTrackAtS, START_LINE_S, TRACK_HALF_WIDTH } from './trackMath';
import type { RainPatch, WeatherPhase } from './types';

export interface DynamicWeatherState {
  phase: WeatherPhase;
  rainIntensity: number; // 0 (clear) .. 1 (active rain patches)
  cloudCover: number; // 0 .. 1
  patches: RainPatch[];
  nextShiftElapsedMs: number;
  seedState: number;
}

export function createInitialWeatherState(seed = 2026): DynamicWeatherState {
  return {
    phase: 'clear',
    rainIntensity: 0,
    cloudCover: 0,
    patches: [],
    nextShiftElapsedMs: 6500,
    seedState: (seed % 2147483646) + 1,
  };
}

function nextRand(state: DynamicWeatherState): number {
  state.seedState = (state.seedState * 16807) % 2147483647;
  return (state.seedState - 1) / 2147483646;
}

export function spawnRandomRainPatches(
  circuit: CircuitData,
  count: number,
  seedState: number,
  existing: RainPatch[] = [],
): { patches: RainPatch[]; nextSeedState: number } {
  const tempState: DynamicWeatherState = {
    phase: 'rain',
    rainIntensity: 0.7,
    cloudCover: 0.9,
    patches: [],
    nextShiftElapsedMs: 0,
    seedState: (Math.abs(Math.floor(seedState)) % 2147483646) + 1,
  };

  const patches: RainPatch[] = [...existing];
  const lateralLanes = [-4.6, 0, 4.6];
  const minClearS = 140; // avoid cluttering start boxes immediately

  for (let i = 0; i < count; i++) {
    // Spread patches across different sectors of the circuit
    const sectorBase = ((i + nextRand(tempState) * 0.72) / Math.max(1, count)) * circuit.totalLength;
    let s = (START_LINE_S + minClearS + sectorBase) % circuit.totalLength;
    // Keep away from immediate finish gantry box
    if (Math.abs(s - START_LINE_S) < 55) {
      s = (START_LINE_S + 140 + i * 110) % circuit.totalLength;
    }

    const laneChoice = lateralLanes[Math.floor(nextRand(tempState) * lateralLanes.length)] ?? 0;
    const jitterLat = (nextRand(tempState) - 0.5) * 1.4;
    const lateralCenter = Math.max(
      -(TRACK_HALF_WIDTH - 2.6),
      Math.min(TRACK_HALF_WIDTH - 2.6, laneChoice + jitterLat),
    );
    const radiusS = 16 + nextRand(tempState) * 14;
    const radiusLat = 3.2 + nextRand(tempState) * 1.1;
    const intensity = 0.65 + nextRand(tempState) * 0.35;

    const smp = sampleTrackAtS(circuit, s);
    patches.push({
      id: `rain-${patches.length + 1}-${Math.round(s)}`,
      s,
      lateralCenter,
      radiusS,
      radiusLat,
      intensity,
      x: smp.x + smp.nx * lateralCenter,
      z: smp.z + smp.nz * lateralCenter,
      heading: Math.atan2(smp.tx, smp.tz),
    });
  }

  return { patches, nextSeedState: tempState.seedState };
}

export function stepDynamicWeather(
  weather: DynamicWeatherState,
  circuit: CircuitData,
  raceElapsedMs: number,
  dt: number,
  isQualifying = false,
): { changedPhase: boolean; spawnedPatches: boolean } {
  // Qualifying stays clear or clouds lightly; races dynamically move Clear -> Clouds -> Rain Patches
  if (isQualifying) {
    return { changedPhase: false, spawnedPatches: false };
  }

  const prevPhase = weather.phase;
  let spawnedPatches = false;

  if (raceElapsedMs < 6500) {
    weather.phase = 'clear';
    weather.cloudCover = Math.max(0, weather.cloudCover - dt * 0.4);
    weather.rainIntensity = Math.max(0, weather.rainIntensity - dt * 0.4);
  } else if (raceElapsedMs < 13500) {
    weather.phase = 'clouds';
    const targetCloud = 0.45 + ((raceElapsedMs - 6500) / 7000) * 0.45;
    weather.cloudCover += (targetCloud - weather.cloudCover) * Math.min(1, dt * 1.5);
    weather.rainIntensity = Math.max(0, weather.rainIntensity - dt * 0.25);

    // Seed first light rain patches right as storm fronts arrive (~10.5s)
    if (raceElapsedMs >= 10500 && weather.patches.length === 0) {
      const spawned = spawnRandomRainPatches(circuit, 5, weather.seedState);
      weather.patches = spawned.patches;
      weather.seedState = spawned.nextSeedState;
      weather.nextShiftElapsedMs = raceElapsedMs + 14000;
      spawnedPatches = true;
    }
  } else {
    weather.phase = 'rain';
    weather.cloudCover += (1.0 - weather.cloudCover) * Math.min(1, dt * 1.4);
    weather.rainIntensity += (0.85 - weather.rainIntensity) * Math.min(1, dt * 0.8);

    if (weather.patches.length < 10) {
      const needed = 10 - weather.patches.length;
      const spawned = spawnRandomRainPatches(circuit, needed, weather.seedState, weather.patches);
      weather.patches = spawned.patches;
      weather.seedState = spawned.nextSeedState;
      weather.nextShiftElapsedMs = raceElapsedMs + 15000;
      spawnedPatches = true;
    } else if (raceElapsedMs >= weather.nextShiftElapsedMs) {
      // Dynamically shift rain patch locations every 15s so racing lines keep evolving
      const keepCount = Math.min(4, weather.patches.length);
      const retained = weather.patches.slice(weather.patches.length - keepCount);
      const spawned = spawnRandomRainPatches(circuit, 6, weather.seedState, retained);
      weather.patches = spawned.patches;
      weather.seedState = spawned.nextSeedState;
      weather.nextShiftElapsedMs = raceElapsedMs + 15000;
      spawnedPatches = true;
    }
  }

  return {
    changedPhase: weather.phase !== prevPhase,
    spawnedPatches,
  };
}

export function evaluateRainPatchAt(
  circuit: CircuitData,
  trackS: number,
  trackOffset: number,
  patches: RainPatch[],
): { onPatch: boolean; wetness: number; dodgeOffsetSign: number } {
  if (!patches || patches.length === 0) {
    return { onPatch: false, wetness: 0, dodgeOffsetSign: 0 };
  }

  const len = circuit.totalLength;
  let maxWet = 0;
  let dodgeSign = 0;

  for (let i = 0; i < patches.length; i++) {
    const p = patches[i];
    let ds = Math.abs(trackS - p.s);
    if (ds > len * 0.5) ds = len - ds;
    if (ds > p.radiusS) continue;

    const dLat = Math.abs(trackOffset - p.lateralCenter);
    if (dLat > p.radiusLat) continue;

    const normDistSq = (ds / p.radiusS) ** 2 + (dLat / p.radiusLat) ** 2;
    if (normDistSq <= 1.0) {
      const localWet = p.intensity * (1 - normDistSq * 0.45);
      if (localWet > maxWet) {
        maxWet = localWet;
        // Recommend dodging toward the drier side of the 17m track
        dodgeSign = p.lateralCenter >= 0 ? -1 : 1;
      }
    }
  }

  return {
    onPatch: maxWet > 0.15,
    wetness: Math.min(1, maxWet),
    dodgeOffsetSign: dodgeSign,
  };
}

export function findNearestRainPatchAhead(
  circuit: CircuitData,
  trackS: number,
  lookAheadMeters: number,
  patches: RainPatch[],
): RainPatch | null {
  if (!patches || patches.length === 0) return null;
  const len = circuit.totalLength;
  let closest: RainPatch | null = null;
  let closestDs = Infinity;

  for (let i = 0; i < patches.length; i++) {
    const p = patches[i];
    const ds = (p.s - trackS + len) % len;
    if (ds >= -4 && ds <= lookAheadMeters && ds < closestDs) {
      closestDs = ds;
      closest = p;
    }
  }

  return closest;
}
