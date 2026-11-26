import {
  CircuitData,
  CURB_WIDTH,
  getGridSlotTransform,
  getLapProgressS,
  GRAVEL_WIDTH,
  projectToTrack,
  sampleTrackAtS,
  START_LINE_S,
  TRACK_HALF_WIDTH,
  updateLapAndCheckpoints,
  WORLD_BOUNDARY_RADIUS,
} from './trackMath';
import {
  BIKE_CLASSES,
  type BikeClassId,
  type BikeState,
  type RiderInput,
  type SolidCollider,
  type TeamLivery,
} from './types';

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
    inSlipstream: false,
    surface: 'asphalt',
    trackS: slot.trackS,
    trackOffset: slot.offset,
    lap: 1,
    checkpointMask: 0,
    totalProgress: slot.trackS - START_LINE_S,
    finished: false,
    finishTimeMs: 0,
    currentLapStartMs: 0,
    bestLapMs: null,
    topSpeedKmh: 0,
    rank: params.slotIndex + 1,
    crashed: false,
    crashTimer: 0,
    crashSlideYaw: 0,
    crashDirSign: 1,
    recoveryGraceTimer: 0,
    aiTargetOffset: ((params.slotIndex % 3) - 1) * 1.4,
    aiPassOffset: 0,
    aiPaceFactor: params.aiPaceFactor ?? 0.98,
    aiAggression: 0.72 + ((params.slotIndex * 37) % 10) * 0.03,
  };
}

export function triggerBikeCrash(bike: BikeState, dirSign?: 1 | -1): boolean {
  if (bike.crashed || bike.finished || bike.recoveryGraceTimer > 0) return false;
  bike.crashed = true;
  bike.crashTimer = 2.05;
  bike.crashDirSign = dirSign ?? (bike.leanAngle >= 0 ? 1 : -1);
  bike.crashSlideYaw = 0;
  bike.isBoosting = false;
  return true;
}

export function resetBikeToTrack(bike: BikeState, circuit: CircuitData): void {
  const smp = sampleTrackAtS(circuit, bike.trackS);
  bike.x = smp.x;
  bike.z = smp.z;
  bike.trackOffset = 0;
  bike.heading = Math.atan2(smp.tx, smp.tz);
  bike.speed = 0;
  bike.leanAngle = 0;
  bike.steerVisual = 0;
  bike.gear = 1;
  bike.rpm = 4200;
  bike.isBoosting = false;
  bike.inSlipstream = false;
  bike.surface = 'asphalt';
  bike.crashed = false;
  bike.crashTimer = 0;
  bike.crashSlideYaw = 0;
  bike.recoveryGraceTimer = 2.2;
}

export function updateSlipstreamStatus(bikes: BikeState[], circuit: CircuitData): void {
  const len = circuit.totalLength;
  for (const bike of bikes) {
    let drafting = false;
    if (bike.speed > 26 && !bike.finished && !bike.crashed) {
      for (const other of bikes) {
        if (other.id === bike.id || other.crashed) continue;
        const ds = (other.trackS - bike.trackS + len) % len;
        if (ds > 2.5 && ds < 28 && Math.abs(other.trackOffset - bike.trackOffset) < 2.3) {
          drafting = true;
          break;
        }
      }
    }
    bike.inSlipstream = drafting;
  }
}

export function computeAiInput(
  bike: BikeState,
  circuit: CircuitData,
  allBikes: BikeState[],
): RiderInput {
  if (bike.finished || bike.crashed) {
    return { throttle: bike.finished ? 0.25 : 0, brake: bike.finished ? 0.3 : 0, steer: 0, boost: false };
  }

  const len = circuit.totalLength;
  // Tighter pro-grade multi-horizon curvature lookahead for chicanes & hairpins
  const lookAheadDist = 13 + bike.speed * 0.4;
  const targetSample = sampleTrackAtS(circuit, bike.trackS + lookAheadDist);

  const nearCurv = sampleTrackAtS(circuit, bike.trackS + 16).curvature;
  const midCurv = sampleTrackAtS(circuit, bike.trackS + 38 + bike.speed * 0.34).curvature;
  const farCurv = sampleTrackAtS(circuit, bike.trackS + 72 + bike.speed * 0.54).curvature;
  const deepCurv = sampleTrackAtS(circuit, bike.trackS + 108 + bike.speed * 0.72).curvature;
  const peakCurv = Math.max(
    Math.abs(nearCurv),
    Math.abs(midCurv),
    Math.abs(farCurv) * 0.92,
    Math.abs(deepCurv) * 0.84,
  );

  let desiredPassOffset = 0;
  let overtaking = false;
  let defending = false;
  const safeHalfWidth = TRACK_HALF_WIDTH - 1.5;

  let closestAheadDist = Infinity;
  let aheadBike: BikeState | null = null;
  let sideRepel = 0;

  for (const other of allBikes) {
    if (other.id === bike.id) continue;
    let ds = (other.trackS - bike.trackS + len) % len;
    if (ds > len * 0.5) ds -= len;

    const dLat = other.trackOffset - bike.trackOffset;

    // Avoid crashed bikes on track early + maintain clean wheel-to-wheel spacing
    const dangerRange = other.crashed ? 18 : 4.2;
    const dangerLat = other.crashed ? 3.4 : 2.5;
    if (ds > -2 && ds < dangerRange && Math.abs(dLat) < dangerLat) {
      sideRepel += dLat >= 0 ? -2.4 : 2.4;
    }

    if (!other.crashed && ds > 1.5 && ds < 46 && Math.abs(dLat) < 3.4) {
      if (ds < closestAheadDist) {
        closestAheadDist = ds;
        aheadBike = other;
      }
    }

    // Aggressively defend inside apex when rival is close behind
    if (!other.crashed && ds < -1.6 && ds > -16 && Math.abs(dLat) < 2.6 && Math.abs(midCurv) > 0.0028) {
      defending = true;
    }
  }

  if (aheadBike) {
    const laneStep = 3.9;
    const leftCand = Math.max(-safeHalfWidth, aheadBike.trackOffset - laneStep);
    const rightCand = Math.min(safeHalfWidth, aheadBike.trackOffset + laneStep);

    const isLaneBlocked = (candLat: number): boolean => {
      if (Math.abs(candLat - aheadBike!.trackOffset) < 2.1) return true;
      for (const other of allBikes) {
        if (other.id === bike.id || other.id === aheadBike!.id) continue;
        let ds = (other.trackS - bike.trackS + len) % len;
        if (ds > len * 0.5) ds -= len;
        if (ds > -3 && ds < closestAheadDist + 12 && Math.abs(other.trackOffset - candLat) < 2.3) {
          return true;
        }
      }
      return false;
    };

    const leftBlocked = isLaneBlocked(leftCand);
    const rightBlocked = isLaneBlocked(rightCand);

    const cornerInsideSign = Math.abs(midCurv) > 0.0028 ? Math.sign(midCurv) : 0;
    if (!leftBlocked && !rightBlocked) {
      if (cornerInsideSign < 0) desiredPassOffset = leftCand;
      else if (cornerInsideSign > 0) desiredPassOffset = rightCand;
      else desiredPassOffset = Math.abs(leftCand - bike.trackOffset) <= Math.abs(rightCand - bike.trackOffset) ? leftCand : rightCand;
      overtaking = true;
    } else if (!leftBlocked) {
      desiredPassOffset = leftCand;
      overtaking = true;
    } else if (!rightBlocked) {
      desiredPassOffset = rightCand;
      overtaking = true;
    }
  }

  const targetPassLat = overtaking ? desiredPassOffset : 0;
  bike.aiPassOffset += (targetPassLat - bike.aiPassOffset) * 0.2;

  // Out-in-out pro racing line: swing wide before entry, clip inside apex, exit fast
  const offTrack = Math.abs(bike.trackOffset) > TRACK_HALF_WIDTH - 0.8;
  const apexBias =
    Math.abs(nearCurv) > 0.0038
      ? Math.sign(nearCurv) * 3.1
      : Math.abs(midCurv) > 0.0032
      ? Math.sign(midCurv) * 2.5
      : Math.abs(farCurv) > 0.0042
      ? -Math.sign(farCurv) * 2.8 // set up wide on approach!
      : 0;
  const defendBias = defending && Math.abs(midCurv) > 0.0028 ? Math.sign(midCurv) * 1.4 : 0;

  let rawDesiredOffset = 0;
  if (!offTrack) {
    rawDesiredOffset = overtaking
      ? bike.aiPassOffset + sideRepel
      : bike.aiTargetOffset * 0.35 + apexBias + defendBias + sideRepel;
  }

  const desiredOffset = Math.max(-safeHalfWidth, Math.min(safeHalfWidth, rawDesiredOffset));
  const tx = targetSample.x + targetSample.nx * desiredOffset;
  const tz = targetSample.z + targetSample.nz * desiredOffset;

  const angleToTarget = Math.atan2(tx - bike.x, tz - bike.z);
  const angleErr = normalizeAngle(angleToTarget - bike.heading);
  // Limit steering slightly on gravel so AI tries not to lowside unless forced off-track
  const steerClamp = offTrack ? 0.65 : 1.0;
  const steer = Math.max(-steerClamp, Math.min(steerClamp, -angleErr * 2.85));

  // Equal bike power: straights ALWAYS target exact same spec.topSpeedMs as player!
  // AI skill (aiPaceFactor) strictly sets cornering braking/grip precision, never engine power.
  const spec = BIKE_CLASSES[bike.bikeClass];
  const cornerSkill = Math.max(0.9, Math.min(1.04, bike.aiPaceFactor));
  const lateralGrip = 33.5 * spec.handlingMultiplier * cornerSkill;
  const cornerSpeedLimit =
    peakCurv > 0.0028
      ? Math.max(22, Math.min(spec.topSpeedMs, Math.sqrt(lateralGrip / peakCurv)))
      : spec.topSpeedMs;

  const alignmentSlowdown = Math.abs(angleErr) > 0.42 ? 0.82 : Math.abs(angleErr) > 0.24 ? 0.94 : 1.0;
  const targetSpeed =
    peakCurv <= 0.0028
      ? spec.topSpeedMs * alignmentSlowdown
      : Math.min(spec.topSpeedMs, cornerSpeedLimit * cornerSkill * alignmentSlowdown);

  let throttle = 1;
  let brake = 0;
  if (bike.speed > targetSpeed + 3.2) {
    throttle = 0;
    // Trail brake safely without locking front wheel past crash threshold
    brake = Math.min(0.82, (bike.speed - targetSpeed) * 0.125);
  } else if (bike.speed > targetSpeed + 0.5) {
    throttle = 0.55;
  }

  // Aggressive pro KERS usage out of corners & down straights/overtakes
  const boost =
    peakCurv < 0.0044 &&
    Math.abs(angleErr) < 0.14 &&
    !offTrack &&
    bike.speed > 30 &&
    ((overtaking && bike.boostFuel > 12) || bike.boostFuel > 45);

  return { throttle, brake, steer, boost };
}

export interface SolidImpact {
  colliderId: string;
  kind: SolidCollider['kind'] | 'guardrail';
  intensity: number;
  x: number;
  z: number;
}

export function resolveSolidCollisions(
  bike: BikeState,
  colliders: SolidCollider[],
  circuit: CircuitData,
): SolidImpact | null {
  const bikeRadius = 0.85;
  let strongestImpact: SolidImpact | null = null;

  // 1. Oriented Bounding Box collisions against every solid Tribun, Building, Tower, Wall & Pillar
  for (let i = 0; i < colliders.length; i++) {
    const col = colliders[i];
    const dx = bike.x - col.x;
    const dz = bike.z - col.z;

    const maxReach = col.halfX + col.halfZ + bikeRadius + 1.0;
    if (Math.abs(dx) > maxReach || Math.abs(dz) > maxReach) continue;

    const lx = dx * col.cosH - dz * col.sinH;
    const lz = dx * col.sinH + dz * col.cosH;

    const ex = col.halfX + bikeRadius;
    const ez = col.halfZ + bikeRadius;

    if (Math.abs(lx) < ex && Math.abs(lz) < ez) {
      const penX = ex - Math.abs(lx);
      const penZ = ez - Math.abs(lz);

      let pushLocalX = 0;
      let pushLocalZ = 0;
      let normalLocalX = 0;
      let normalLocalZ = 0;

      if (penX < penZ) {
        normalLocalX = lx >= 0 ? 1 : -1;
        pushLocalX = normalLocalX * penX;
      } else {
        normalLocalZ = lz >= 0 ? 1 : -1;
        pushLocalZ = normalLocalZ * penZ;
      }

      const pushWorldX = pushLocalX * col.cosH + pushLocalZ * col.sinH;
      const pushWorldZ = -pushLocalX * col.sinH + pushLocalZ * col.cosH;
      const nWorldX = normalLocalX * col.cosH + normalLocalZ * col.sinH;
      const nWorldZ = -normalLocalX * col.sinH + normalLocalZ * col.cosH;

      bike.x += pushWorldX;
      bike.z += pushWorldZ;

      const fwdX = Math.sin(bike.heading);
      const fwdZ = Math.cos(bike.heading);
      const impactDot = fwdX * nWorldX + fwdZ * nWorldZ;

      if (impactDot < 0) {
        const hitSeverity = Math.min(1, (-impactDot * bike.speed) / 42);
        const vx = fwdX * bike.speed;
        const vz = fwdZ * bike.speed;
        const vn = vx * nWorldX + vz * nWorldZ;
        const slideVx = vx - vn * nWorldX * 1.15;
        const slideVz = vz - vn * nWorldZ * 1.15;
        const slideMag = Math.hypot(slideVx, slideVz);

        if (slideMag > 0.5) {
          bike.heading = Math.atan2(slideVx, slideVz);
        } else {
          bike.heading = normalizeAngle(bike.heading + Math.PI * 0.5);
        }
        bike.speed = Math.max(0, bike.speed * (0.42 + 0.48 * (1 - Math.abs(impactDot))));

        if (!strongestImpact || hitSeverity > strongestImpact.intensity) {
          strongestImpact = {
            colliderId: col.id,
            kind: col.kind,
            intensity: Math.max(0.25, hitSeverity),
            x: bike.x,
            z: bike.z,
          };
        }
      }
    }
  }

  // 2. Solid Track Perimeter Armco Guardrails (open along pit lane entry -nx)
  const proj = projectToTrack(circuit, bike.x, bike.z, bike.trackS);
  const railLimit = TRACK_HALF_WIDTH + CURB_WIDTH + GRAVEL_WIDTH + 0.05;
  const inPitOpening =
    proj.s > START_LINE_S - 64 &&
    proj.s < START_LINE_S + 28 &&
    proj.offset < 0;

  const maxAllowedOffset = inPitOpening ? railLimit + 18 : railLimit;

  if (Math.abs(proj.offset) > maxAllowedOffset) {
    const sideSign = proj.offset >= 0 ? 1 : -1;
    const clampedOffset = sideSign * maxAllowedOffset;
    bike.x = proj.sample.x + proj.sample.nx * clampedOffset;
    bike.z = proj.sample.z + proj.sample.nz * clampedOffset;

    const tangentHeading = Math.atan2(proj.sample.tx, proj.sample.tz);
    const angleDiff = normalizeAngle(tangentHeading - bike.heading);
    const impactSeverity = Math.min(1, (Math.abs(Math.sin(angleDiff)) * bike.speed) / 36);
    bike.heading = normalizeAngle(bike.heading + angleDiff * 0.58);

    const prevSpeed = bike.speed;
    bike.speed *= 0.78;
    if (prevSpeed > 12 && (!strongestImpact || impactSeverity > strongestImpact.intensity)) {
      strongestImpact = {
        colliderId: 'armco-guardrail',
        kind: 'guardrail',
        intensity: Math.max(0.2, impactSeverity),
        x: bike.x,
        z: bike.z,
      };
    }
  }

  return strongestImpact;
}

export interface StepResult {
  completedLap: boolean;
  finishedRace: boolean;
  gearChanged: boolean;
  wrongWay: boolean;
  solidImpact: SolidImpact | null;
  justCrashed: boolean;
  justRecovered: boolean;
}

export function stepBikePhysics(
  bike: BikeState,
  input: RiderInput,
  dt: number,
  circuit: CircuitData,
  raceTimeMs: number,
  totalLaps: number,
  canMove: boolean,
  solidColliders: SolidCollider[] = [],
): StepResult {
  const prevGear = bike.gear;
  const prevLapProgress = getLapProgressS(bike.trackS, circuit.totalLength);
  let justCrashed = false;
  let justRecovered = false;

  if (!canMove) {
    const targetRpm = 4200 + input.throttle * 9500;
    bike.rpm += (targetRpm - bike.rpm) * Math.min(1, dt * 10);
    bike.leanAngle += (0 - bike.leanAngle) * Math.min(1, dt * 8);
    return {
      completedLap: false,
      finishedRace: false,
      gearChanged: false,
      wrongWay: false,
      solidImpact: null,
      justCrashed: false,
      justRecovered: false,
    };
  }

  if (bike.recoveryGraceTimer > 0) {
    bike.recoveryGraceTimer = Math.max(0, bike.recoveryGraceTimer - dt);
  }

  // Handle active crash tumble / slide before auto-recovery
  if (bike.crashed) {
    bike.crashTimer -= dt;
    bike.isBoosting = false;
    const slideDecel = bike.surface === 'gravel' || bike.surface === 'grass' ? 24 : 15;
    bike.speed = Math.max(0, bike.speed - slideDecel * dt);

    // Tip motorcycle onto its side and spin slightly as rider & bike slide
    const targetCrashLean = bike.crashDirSign * 1.36;
    bike.leanAngle += (targetCrashLean - bike.leanAngle) * Math.min(1, dt * 11);
    bike.crashSlideYaw += bike.crashDirSign * dt * (1.1 + bike.speed * 0.06);

    bike.x += Math.sin(bike.heading) * bike.speed * dt;
    bike.z += Math.cos(bike.heading) * bike.speed * dt;
    bike.wheelSpin += (bike.speed / 0.32) * dt * 0.35;

    const solidImpact = resolveSolidCollisions(bike, solidColliders, circuit);
    const proj = projectToTrack(circuit, bike.x, bike.z, bike.trackS);
    bike.trackS = proj.s;
    bike.trackOffset = proj.offset;
    bike.surface = proj.surface;

    const crashPowertrain = computeGearAndRpm(bike.speed * 0.2, false, bike.bikeClass);
    bike.gear = 1;
    bike.rpm = Math.max(2400, crashPowertrain.rpm * 0.65);

    if (bike.crashTimer <= 0) {
      resetBikeToTrack(bike, circuit);
      justRecovered = true;
    }

    return {
      completedLap: false,
      finishedRace: false,
      gearChanged: false,
      wrongWay: false,
      solidImpact,
      justCrashed: false,
      justRecovered,
    };
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
    bike.boostFuel = Math.min(100, bike.boostFuel + (bike.inSlipstream ? 11.0 : 7.5) * dt);
  }

  // Equal bike power curve for Player and AI based solely on bikeClass + slipstream + KERS
  const spec = BIKE_CLASSES[bike.bikeClass];
  const slipBonus = bike.inSlipstream ? 3.5 : 0;
  const topSpeed = (wantsBoost ? spec.boostTopSpeedMs : spec.topSpeedMs) + slipBonus;

  const speedNorm = Math.min(1, bike.speed / topSpeed);
  const accelPower =
    (wantsBoost ? 46 : 33) *
    spec.accelMultiplier *
    (bike.inSlipstream ? 1.08 : 1.0) *
    (1.05 - 0.52 * speedNorm);
  const brakePower = 50;

  if (effectiveInput.throttle > 0) {
    bike.speed += effectiveInput.throttle * accelPower * dt;
  }
  if (effectiveInput.brake > 0) {
    bike.speed -= effectiveInput.brake * brakePower * dt;
  }

  const aeroDrag = (bike.inSlipstream ? 0.0016 : 0.0022) * bike.speed * bike.speed;
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

  bike.x += Math.sin(bike.heading) * bike.speed * dt;
  bike.z += Math.cos(bike.heading) * bike.speed * dt;
  bike.wheelSpin += (bike.speed / 0.32) * dt;

  // Enforce solid collisions against Tribuns, Buildings, Walls, Pillars & Guardrails
  const solidImpact = resolveSolidCollisions(bike, solidColliders, circuit);

  // Trigger crash on heavy wall/barrier impact OR gravel/braking washout at extreme lean
  if (!bike.finished && bike.recoveryGraceTimer <= 0) {
    if (solidImpact && solidImpact.intensity >= 0.44) {
      justCrashed = triggerBikeCrash(bike);
    } else if ((bike.surface === 'gravel' || bike.surface === 'grass') && Math.abs(bike.leanAngle) > 0.62 && bike.speed > 34) {
      justCrashed = triggerBikeCrash(bike);
    } else if (effectiveInput.brake > 0.85 && Math.abs(bike.leanAngle) > 0.72 && bike.speed > 40) {
      justCrashed = triggerBikeCrash(bike);
    }
  }

  // World safety cap
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

  const fwdX = Math.sin(bike.heading);
  const fwdZ = Math.cos(bike.heading);
  const dot = fwdX * proj.sample.tx + fwdZ * proj.sample.tz;
  const wrongWay = bike.speed > 5 && dot < -0.35;

  return {
    completedLap: lapState.completedLap,
    finishedRace: lapState.finishedRace,
    gearChanged: bike.gear !== prevGear,
    wrongWay,
    solidImpact,
    justCrashed,
    justRecovered,
  };
}

export interface BikeCollisionImpact {
  aId: string;
  bId: string;
  intensity: number;
  x: number;
  z: number;
  crashedIds: string[];
}

export function resolveBikeCollisions(bikes: BikeState[]): BikeCollisionImpact[] {
  const impacts: BikeCollisionImpact[] = [];
  const minDist = 1.65;

  for (let i = 0; i < bikes.length; i++) {
    for (let j = i + 1; j < bikes.length; j++) {
      const a = bikes[i];
      const b = bikes[j];
      if (a.recoveryGraceTimer > 0 || b.recoveryGraceTimer > 0) continue;
      if (a.crashed || b.crashed) continue;

      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.0001 && dist < minDist) {
        const overlap = (minDist - dist) * 0.5;
        const nx = dx / dist;
        const nz = dz / dist;

        const relSpeed = Math.abs(a.speed - b.speed);
        const severeContact =
          relSpeed > 18 ||
          (dist < 1.12 && Math.max(a.speed, b.speed) > 30 && (Math.abs(a.leanAngle) > 0.55 || Math.abs(b.leanAngle) > 0.55));

        const crashedIds: string[] = [];

        if (!a.isRemote) {
          a.x -= nx * overlap;
          a.z -= nz * overlap;
          a.speed *= 0.94;
          if (severeContact && (a.speed <= b.speed || Math.abs(a.leanAngle) > 0.55)) {
            if (triggerBikeCrash(a, a.leanAngle >= 0 ? 1 : -1)) crashedIds.push(a.id);
          }
        }
        if (!b.isRemote) {
          b.x += nx * overlap;
          b.z += nz * overlap;
          b.speed *= 0.94;
          if (severeContact && (b.speed <= a.speed || Math.abs(b.leanAngle) > 0.55)) {
            if (triggerBikeCrash(b, b.leanAngle >= 0 ? 1 : -1)) crashedIds.push(b.id);
          }
        }

        impacts.push({
          aId: a.id,
          bId: b.id,
          intensity: Math.min(1, 0.25 + relSpeed / 40),
          x: (a.x + b.x) * 0.5,
          z: (a.z + b.z) * 0.5,
          crashedIds,
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
