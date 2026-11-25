import {
  CircuitData,
  getGridSlotTransform,
  getLapProgressS,
  projectToTrack,
  sampleTrackAtS,
  TRACK_HALF_WIDTH,
  updateLapAndCheckpoints,
  WORLD_BOUNDARY_RADIUS,
} from './trackMath';
import { BIKE_CLASSES, type BikeClassId, type BikeState, type RiderInput, type TeamLivery } from './types';

export const MAX_SPEED_MS = 88; // ~317 km/h MotoGP top speed
export const BOOST_TOP_SPEED_MS = 97; // ~349 km/h KERS slipstream boost
export const MAX_LEAN_RAD = 0.84; // ~48 degrees elbow-down MotoGP lean

const GEAR_THRESHOLDS_RATIO = [0, 0.24, 0.39, 0.54, 0.69, 0.84, 1.15];

export function computeGearAndRpm(
  speedMs: number,
  isBoosting: boolean,
  bikeClass: BikeClassId = 'motogp',
): { gear: number; rpm: number } {
  const spec = BIKE_CLASSES[bikeClass];
  const absSpeed = Math.max(0, speedMs);
  let gear = 1;
  for (let g = 1; g <= 6; g++) {
    if (absSpeed >= GEAR_THRESHOLDS_RATIO[g - 1] * spec.topSpeedMs) {
      gear = g;
    }
  }
  const low = GEAR_THRESHOLDS_RATIO[gear - 1] * spec.topSpeedMs;
  const high = GEAR_THRESHOLDS_RATIO[gear] * spec.topSpeedMs;
  const span = Math.max(1, high - low);
  const ratio = Math.min(1, Math.max(0, (absSpeed - low) / span));
  const baseRpm = gear === 1 ? 3800 : Math.round(spec.maxRpm * 0.54);
  const peakRpm = isBoosting ? spec.maxRpm + 700 : spec.maxRpm;
  const rpm = Math.round(baseRpm + ratio * (peakRpm - baseRpm));
  return { gear, rpm };
}

export function normalizeAngle(a: number): number {
  let angle = a;
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

export function createInitialBikeState(params: {
  id: string;
  name: string;
  livery: TeamLivery;
  bikeClass?: BikeClassId;
  slotIndex: number;
  circuit: CircuitData;
  isPlayer: boolean;
  isRemote: boolean;
  isAi: boolean;
  aiPaceFactor?: number;
}): BikeState {
  const slot = getGridSlotTransform(params.circuit, params.slotIndex);
  return {
    id: params.id,
    name: params.name,
    livery: params.livery,
    bikeClass: params.bikeClass ?? 'motogp',
    isPlayer: params.isPlayer,
    isRemote: params.isRemote,
    isAi: params.isAi,
    x: slot.x,
    z: slot.z,
    heading: slot.heading,
    speed: 0,
    leanAngle: 0,
    steerVisual: 0,
    wheelSpin: 0,
    gear: 1,
    rpm: 4200,
    boostFuel: 100,
    isBoosting: false,
    surface: 'asphalt',
    trackS: slot.trackS,
    trackOffset: slot.offset,
    lap: 1,
    checkpointMask: 0,
    totalProgress: -10 - Math.floor(params.slotIndex / 2) * 7.5,
    finished: false,
    finishTimeMs: 0,
    currentLapStartMs: 0,
    bestLapMs: null,
    topSpeedKmh: 0,
    rank: params.slotIndex + 1,
    aiTargetOffset: ((params.slotIndex % 3) - 1) * 2.2,
    aiPaceFactor: params.aiPaceFactor ?? 0.9,
  };
}

export function computeAiInput(
  bike: BikeState,
  circuit: CircuitData,
  allBikes: BikeState[],
): RiderInput {
  if (bike.finished) {
    return { throttle: 0.25, brake: 0.3, steer: 0, boost: false };
  }

  const lookAheadDist = 18 + bike.speed * 0.48;
  const targetSample = sampleTrackAtS(circuit, bike.trackS + lookAheadDist);
  const cornerSample = sampleTrackAtS(circuit, bike.trackS + 34 + bike.speed * 0.55);

  // Dynamic overtaking offset if another bike is directly ahead
  let avoidOffset = 0;
  for (const other of allBikes) {
    if (other.id === bike.id) continue;
    const ds = other.trackS - bike.trackS;
    if (ds > 2 && ds < 16 && Math.abs(other.trackOffset - bike.trackOffset) < 2.6) {
      avoidOffset = other.trackOffset > 0 ? -3.0 : 3.0;
      break;
    }
  }

  const desiredOffset = Math.max(
    -(TRACK_HALF_WIDTH - 1.8),
    Math.min(TRACK_HALF_WIDTH - 1.8, bike.aiTargetOffset + avoidOffset),
  );
  const tx = targetSample.x + targetSample.nx * desiredOffset;
  const tz = targetSample.z + targetSample.nz * desiredOffset;

  const angleToTarget = Math.atan2(tx - bike.x, tz - bike.z);
  const angleErr = normalizeAngle(angleToTarget - bike.heading);
  const steer = Math.max(-1, Math.min(1, angleErr * 2.2));

  // Cornering target speed from upcoming curvature scaled by bike class
  const spec = BIKE_CLASSES[bike.bikeClass];
  const absCurv = Math.abs(cornerSample.curvature);
  const cornerSpeedLimit = absCurv > 0.008 ? Math.max(26, 56 - absCurv * 1100) : spec.topSpeedMs;
  const targetSpeed = Math.min(spec.topSpeedMs, cornerSpeedLimit) * bike.aiPaceFactor;

  let throttle = 1;
  let brake = 0;
  if (bike.speed > targetSpeed + 4) {
    throttle = 0;
    brake = Math.min(1, (bike.speed - targetSpeed) * 0.08);
  } else if (bike.speed > targetSpeed) {
    throttle = 0.35;
  }

  const boost =
    absCurv < 0.004 &&
    Math.abs(angleErr) < 0.12 &&
    bike.boostFuel > 55 &&
    bike.speed > 45;

  return { throttle, brake, steer, boost };
}

export interface StepResult {
  completedLap: boolean;
  finishedRace: boolean;
  gearChanged: boolean;
  wrongWay: boolean;
}

export function stepBikePhysics(
  bike: BikeState,
  input: RiderInput,
  dt: number,
  circuit: CircuitData,
  raceTimeMs: number,
  totalLaps: number,
  canMove: boolean,
): StepResult {
  const prevGear = bike.gear;
  const prevLapProgress = getLapProgressS(bike.trackS, circuit.totalLength);

  if (!canMove) {
    // Revving on the starting grid before lights go out
    const targetRpm = 4200 + input.throttle * 9500;
    bike.rpm += (targetRpm - bike.rpm) * Math.min(1, dt * 10);
    bike.leanAngle += (0 - bike.leanAngle) * Math.min(1, dt * 8);
    return { completedLap: false, finishedRace: false, gearChanged: false, wrongWay: false };
  }

  const effectiveInput: RiderInput = bike.finished
    ? { throttle: 0.25, brake: 0.35, steer: 0, boost: false }
    : input;

  // Boost logic
  const wantsBoost = effectiveInput.boost && bike.boostFuel > 2 && effectiveInput.throttle > 0.2;
  bike.isBoosting = wantsBoost;
  if (wantsBoost) {
    bike.boostFuel = Math.max(0, bike.boostFuel - 26 * dt);
  } else {
    bike.boostFuel = Math.min(100, bike.boostFuel + 7.5 * dt);
  }

  const spec = BIKE_CLASSES[bike.bikeClass];
  const topSpeed = wantsBoost ? spec.boostTopSpeedMs : spec.topSpeedMs;

  // Acceleration / braking curve scaled by Moto3 / Moto2 / MotoGP class
  const speedNorm = Math.min(1, bike.speed / topSpeed);
  const accelPower = (wantsBoost ? 46 : 33) * spec.accelMultiplier * (1.05 - 0.52 * speedNorm);
  const brakePower = 48;

  if (effectiveInput.throttle > 0) {
    bike.speed += effectiveInput.throttle * accelPower * dt;
  }
  if (effectiveInput.brake > 0) {
    bike.speed -= effectiveInput.brake * brakePower * dt;
  }

  // Natural aerodynamic drag & surface resistance
  const aeroDrag = 0.0022 * bike.speed * bike.speed;
  const rollingDrag = 1.6;
  let surfaceDrag = 0;
  let surfaceMaxSpeed = topSpeed;

  if (bike.surface === 'curb') {
    surfaceDrag = 2.0;
  } else if (bike.surface === 'gravel') {
    surfaceDrag = 22.0 + bike.speed * 0.55;
    surfaceMaxSpeed = 32;
  } else if (bike.surface === 'grass') {
    surfaceDrag = 16.0 + bike.speed * 0.4;
    surfaceMaxSpeed = 38;
  }

  const leanDrag = Math.abs(bike.leanAngle) * 3.5;
  bike.speed -= (aeroDrag + rollingDrag + surfaceDrag + leanDrag) * dt;
  bike.speed = Math.max(0, Math.min(surfaceMaxSpeed, bike.speed));

  const steerFactor = Math.min(1, bike.speed / 12);
  const targetLean = effectiveInput.steer * MAX_LEAN_RAD * Math.min(1, bike.speed / 16 + 0.15);
  bike.leanAngle += (targetLean - bike.leanAngle) * Math.min(1, dt * 8.5 * spec.handlingMultiplier);
  bike.steerVisual += (effectiveInput.steer * 0.35 - bike.steerVisual) * Math.min(1, dt * 10);

  const gripMultiplier =
    bike.surface === 'gravel' ? 0.55 : bike.surface === 'grass' ? 0.65 : 1.0;
  const highSpeedStability = 1.0 / (1.0 + bike.speed * 0.011);
  const yawRate = -bike.leanAngle * 2.15 * spec.handlingMultiplier * steerFactor * gripMultiplier * highSpeedStability;
  bike.heading = normalizeAngle(bike.heading + yawRate * dt);

  // Integrate world position
  bike.x += Math.sin(bike.heading) * bike.speed * dt;
  bike.z += Math.cos(bike.heading) * bike.speed * dt;
  bike.wheelSpin += (bike.speed / 0.32) * dt;

  // Keep inside outdoor circuit perimeter barriers
  const distFromCenter = Math.hypot(bike.x, bike.z);
  if (distFromCenter > WORLD_BOUNDARY_RADIUS) {
    const scale = WORLD_BOUNDARY_RADIUS / distFromCenter;
    bike.x *= scale;
    bike.z *= scale;
    bike.speed *= 0.6;
  }

  // Project onto circuit spline
  const proj = projectToTrack(circuit, bike.x, bike.z, bike.trackS);
  bike.trackS = proj.s;
  bike.trackOffset = proj.offset;
  bike.surface = proj.surface;

  const newLapProgress = getLapProgressS(bike.trackS, circuit.totalLength);
  const lapState = updateLapAndCheckpoints(
    prevLapProgress,
    newLapProgress,
    bike.checkpointMask,
    bike.lap,
    totalLaps,
    circuit.totalLength,
  );

  if (lapState.completedLap && !bike.finished) {
    const lapTime = raceTimeMs - bike.currentLapStartMs;
    if (lapTime > 4000 && (bike.bestLapMs === null || lapTime < bike.bestLapMs)) {
      bike.bestLapMs = lapTime;
    }
    bike.currentLapStartMs = raceTimeMs;
  }

  bike.lap = lapState.lap;
  bike.checkpointMask = lapState.checkpointMask;
  if (lapState.finishedRace && !bike.finished) {
    bike.finished = true;
    bike.finishTimeMs = raceTimeMs;
  }

  // Monotonic race progress for ranking
  if (bike.finished) {
    bike.totalProgress = totalLaps * circuit.totalLength + (10_000_000 - bike.finishTimeMs) * 0.001;
  } else {
    // Handle initial grid negative progress cleanly before crossing start line first time
    const started = (bike.checkpointMask & 1) !== 0 || bike.lap > 1 || newLapProgress < circuit.totalLength * 0.65;
    if (!started && newLapProgress > circuit.totalLength * 0.75) {
      bike.totalProgress = newLapProgress - circuit.totalLength;
    } else {
      bike.totalProgress = (bike.lap - 1) * circuit.totalLength + newLapProgress;
    }
  }

  const kmh = Math.round(bike.speed * 3.6);
  if (kmh > bike.topSpeedKmh) bike.topSpeedKmh = kmh;

  const powertrain = computeGearAndRpm(bike.speed, bike.isBoosting, bike.bikeClass);
  bike.gear = powertrain.gear;
  bike.rpm = powertrain.rpm;

  // Wrong-way check: dot product between bike forward and track tangent
  const fwdX = Math.sin(bike.heading);
  const fwdZ = Math.cos(bike.heading);
  const dot = fwdX * proj.sample.tx + fwdZ * proj.sample.tz;
  const wrongWay = bike.speed > 5 && dot < -0.35;

  return {
    completedLap: lapState.completedLap,
    finishedRace: lapState.finishedRace,
    gearChanged: bike.gear !== prevGear,
    wrongWay,
  };
}

export function resolveBikeCollisions(bikes: BikeState[]): Array<{ aId: string; bId: string; intensity: number; x: number; z: number }> {
  const impacts: Array<{ aId: string; bId: string; intensity: number; x: number; z: number }> = [];
  const minDist = 1.65;

  for (let i = 0; i < bikes.length; i++) {
    for (let j = i + 1; j < bikes.length; j++) {
      const a = bikes[i];
      const b = bikes[j];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.0001 && dist < minDist) {
        const overlap = (minDist - dist) * 0.5;
        const nx = dx / dist;
        const nz = dz / dist;

        if (!a.isRemote) {
          a.x -= nx * overlap;
          a.z -= nz * overlap;
          a.speed *= 0.94;
        }
        if (!b.isRemote) {
          b.x += nx * overlap;
          b.z += nz * overlap;
          b.speed *= 0.94;
        }

        const relSpeed = Math.abs(a.speed - b.speed);
        impacts.push({
          aId: a.id,
          bId: b.id,
          intensity: Math.min(1, 0.25 + relSpeed / 40),
          x: (a.x + b.x) * 0.5,
          z: (a.z + b.z) * 0.5,
        });
      }
    }
  }
  return impacts;
}

export function updateRaceRankings(bikes: BikeState[]): void {
  const sorted = [...bikes].sort((a, b) => b.totalProgress - a.totalProgress);
  sorted.forEach((bike, idx) => {
    bike.rank = idx + 1;
  });
}
