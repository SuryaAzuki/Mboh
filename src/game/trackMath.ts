import type { SurfaceType } from './types';

export interface Vec2 {
  x: number;
  z: number;
}

export interface TrackSample {
  s: number; // distance from start line in meters
  x: number;
  z: number;
  tx: number; // unit tangent x
  tz: number; // unit tangent z
  nx: number; // unit right normal x (pointing right of travel direction)
  nz: number; // unit right normal z
  curvature: number; // signed curvature (rad/m)
}

export const TRACK_HALF_WIDTH = 8.0; // 16m wide MotoGP asphalt
export const CURB_WIDTH = 1.6;
export const GRAVEL_WIDTH = 9.0;
export const WORLD_BOUNDARY_RADIUS = 310;

// Control points for a flowing MotoGP Grand Prix circuit (~1180m loop)
// Main straight runs along x = 0, from z = -120 toward z = +130 (heading = 0, +Z)
const CIRCUIT_CONTROL_POINTS: Vec2[] = [
  { x: 0, z: -120 },
  { x: 0, z: -20 },
  { x: 0, z: 90 }, // Start/Finish straight & Turn 1 braking zone
  { x: 24, z: 165 }, // Turn 1 fast right-hander
  { x: 96, z: 185 }, // Turn 2 exit
  { x: 158, z: 145 }, // Turn 3 sweeping right
  { x: 175, z: 75 },
  { x: 120, z: 25 }, // Turn 4 chicane entry (left)
  { x: 145, z: -45 }, // Turn 5 chicane exit (right)
  { x: 195, z: -115 },
  { x: 155, z: -185 }, // Turn 6 Hairpin
  { x: 65, z: -190 },
  { x: -15, z: -165 }, // Final parabolic corner onto main straight
];

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

export interface CircuitData {
  samples: TrackSample[];
  totalLength: number;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

let cachedCircuit: CircuitData | null = null;

export function buildCircuitData(sampleCount = 480): CircuitData {
  const n = CIRCUIT_CONTROL_POINTS.length;
  const rawPoints: Vec2[] = [];

  for (let i = 0; i < sampleCount; i++) {
    const u = (i / sampleCount) * n;
    const seg = Math.floor(u) % n;
    const t = u - Math.floor(u);

    const p0 = CIRCUIT_CONTROL_POINTS[(seg - 1 + n) % n];
    const p1 = CIRCUIT_CONTROL_POINTS[seg];
    const p2 = CIRCUIT_CONTROL_POINTS[(seg + 1) % n];
    const p3 = CIRCUIT_CONTROL_POINTS[(seg + 2) % n];

    rawPoints.push({
      x: catmullRom(p0.x, p1.x, p2.x, p3.x, t),
      z: catmullRom(p0.z, p1.z, p2.z, p3.z, t),
    });
  }

  // Compute cumulative arc length
  const cumLen = new Float64Array(sampleCount);
  let totalLength = 0;
  for (let i = 1; i < sampleCount; i++) {
    const dx = rawPoints[i].x - rawPoints[i - 1].x;
    const dz = rawPoints[i].z - rawPoints[i - 1].z;
    totalLength += Math.hypot(dx, dz);
    cumLen[i] = totalLength;
  }
  const closingDx = rawPoints[0].x - rawPoints[sampleCount - 1].x;
  const closingDz = rawPoints[0].z - rawPoints[sampleCount - 1].z;
  totalLength += Math.hypot(closingDx, closingDz);

  // Resample uniformly by arc length for stable lookups and curb tiling
  const uniformPoints: Vec2[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const targetS = (i / sampleCount) * totalLength;
    let idx = 0;
    while (idx < sampleCount - 1 && cumLen[idx + 1] < targetS) {
      idx++;
    }
    const nextIdx = (idx + 1) % sampleCount;
    const segStart = cumLen[idx];
    const segEnd = nextIdx === 0 ? totalLength : cumLen[nextIdx];
    const segLen = Math.max(1e-6, segEnd - segStart);
    const alpha = Math.max(0, Math.min(1, (targetS - segStart) / segLen));

    uniformPoints.push({
      x: rawPoints[idx].x + (rawPoints[nextIdx].x - rawPoints[idx].x) * alpha,
      z: rawPoints[idx].z + (rawPoints[nextIdx].z - rawPoints[idx].z) * alpha,
    });
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  const samples: TrackSample[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const prev = uniformPoints[(i - 1 + sampleCount) % sampleCount];
    const curr = uniformPoints[i];
    const next = uniformPoints[(i + 1) % sampleCount];

    const dx = next.x - prev.x;
    const dz = next.z - prev.z;
    const len = Math.max(1e-6, Math.hypot(dx, dz));
    const tx = dx / len;
    const tz = dz / len;
    // Heading = atan2(tx, tz); right vector in (x, z) when +Y is up:
    // Forward = (tx, tz), Right = (-tz, tx)
    const nx = -tz;
    const nz = tx;

    const dx1 = curr.x - prev.x;
    const dz1 = curr.z - prev.z;
    const dx2 = next.x - curr.x;
    const dz2 = next.z - curr.z;
    const cross = dx1 * dz2 - dz1 * dx2;
    const d1 = Math.hypot(dx1, dz1);
    const d2 = Math.hypot(dx2, dz2);
    const curvature = d1 > 1e-4 && d2 > 1e-4 ? cross / (d1 * d2 * ((d1 + d2) * 0.5)) : 0;

    if (curr.x < minX) minX = curr.x;
    if (curr.x > maxX) maxX = curr.x;
    if (curr.z < minZ) minZ = curr.z;
    if (curr.z > maxZ) maxZ = curr.z;

    samples.push({
      s: (i / sampleCount) * totalLength,
      x: curr.x,
      z: curr.z,
      tx,
      tz,
      nx,
      nz,
      curvature,
    });
  }

  return {
    samples,
    totalLength,
    bounds: { minX, maxX, minZ, maxZ },
  };
}

export function getCircuit(): CircuitData {
  if (!cachedCircuit) {
    cachedCircuit = buildCircuitData(480);
  }
  return cachedCircuit;
}

export function sampleTrackAtS(circuit: CircuitData, s: number): TrackSample {
  const { samples, totalLength } = circuit;
  const wrapped = ((s % totalLength) + totalLength) % totalLength;
  const fIdx = (wrapped / totalLength) * samples.length;
  const i0 = Math.floor(fIdx) % samples.length;
  const i1 = (i0 + 1) % samples.length;
  const t = fIdx - Math.floor(fIdx);

  const a = samples[i0];
  const b = samples[i1];
  const tx = a.tx + (b.tx - a.tx) * t;
  const tz = a.tz + (b.tz - a.tz) * t;
  const len = Math.max(1e-6, Math.hypot(tx, tz));
  const utx = tx / len;
  const utz = tz / len;

  return {
    s: wrapped,
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
    tx: utx,
    tz: utz,
    nx: -utz,
    nz: utx,
    curvature: a.curvature + (b.curvature - a.curvature) * t,
  };
}

export interface TrackProjection {
  s: number;
  offset: number; // signed lateral distance along right normal
  absOffset: number;
  sample: TrackSample;
  surface: SurfaceType;
}

export function classifySurface(absOffset: number): SurfaceType {
  if (absOffset <= TRACK_HALF_WIDTH) return 'asphalt';
  if (absOffset <= TRACK_HALF_WIDTH + CURB_WIDTH) return 'curb';
  if (absOffset <= TRACK_HALF_WIDTH + CURB_WIDTH + GRAVEL_WIDTH) return 'gravel';
  return 'grass';
}

export function projectToTrack(
  circuit: CircuitData,
  x: number,
  z: number,
  hintS?: number,
): TrackProjection {
  const { samples, totalLength } = circuit;
  const n = samples.length;

  let bestIdx = 0;
  let bestDistSq = Infinity;

  if (hintS !== undefined) {
    // Search local window around hintS first (~160m window)
    const centerIdx = Math.floor((((hintS % totalLength) + totalLength) % totalLength) / totalLength * n);
    const windowRadius = 36;
    for (let k = -windowRadius; k <= windowRadius; k++) {
      const idx = (centerIdx + k + n) % n;
      const smp = samples[idx];
      const dx = x - smp.x;
      const dz = z - smp.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestDistSq) {
        bestDistSq = d2;
        bestIdx = idx;
      }
    }
  }

  // Fallback global search if hint was missing or too far (> 45m)
  if (bestDistSq > 45 * 45) {
    bestDistSq = Infinity;
    for (let i = 0; i < n; i++) {
      const smp = samples[i];
      const dx = x - smp.x;
      const dz = z - smp.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestDistSq) {
        bestDistSq = d2;
        bestIdx = i;
      }
    }
  }

  const base = samples[bestIdx];
  const dx = x - base.x;
  const dz = z - base.z;
  // Project along tangent to refine s smoothly
  const tangentProj = dx * base.tx + dz * base.tz;
  const refinedS = ((base.s + tangentProj) % totalLength + totalLength) % totalLength;
  const refinedSample = sampleTrackAtS(circuit, refinedS);
  const rdx = x - refinedSample.x;
  const rdz = z - refinedSample.z;
  const offset = rdx * refinedSample.nx + rdz * refinedSample.nz;
  const absOffset = Math.abs(offset);

  return {
    s: refinedS,
    offset,
    absOffset,
    sample: refinedSample,
    surface: classifySurface(absOffset),
  };
}

// Start line sits at s = 110m along the straight (near z = -10, facing +Z toward Turn 1)
export const START_LINE_S = 110;

export function getLapProgressS(rawS: number, totalLength: number): number {
  return ((rawS - START_LINE_S) % totalLength + totalLength) % totalLength;
}

export function getGridSlotTransform(
  circuit: CircuitData,
  slotIndex: number,
): { x: number; z: number; heading: number; trackS: number; offset: number } {
  const row = Math.floor(slotIndex / 2);
  const col = slotIndex % 2;
  const sBack = START_LINE_S - 10 - row * 7.5;
  const lateral = col === 0 ? -2.6 : 2.6;
  const smp = sampleTrackAtS(circuit, sBack);
  return {
    x: smp.x + smp.nx * lateral,
    z: smp.z + smp.nz * lateral,
    heading: Math.atan2(smp.tx, smp.tz),
    trackS: smp.s,
    offset: lateral,
  };
}

export function updateLapAndCheckpoints(
  prevLapProgress: number,
  newLapProgress: number,
  checkpointMask: number,
  currentLap: number,
  totalLaps: number,
  totalLength: number,
): {
  lap: number;
  checkpointMask: number;
  completedLap: boolean;
  finishedRace: boolean;
} {
  let mask = checkpointMask;
  const sector = Math.min(3, Math.floor((newLapProgress / totalLength) * 4));
  // Require sequential sector progression or mark sectors 0..3 when passed
  if (sector === 0) mask |= 1;
  else if (sector === 1 && (mask & 1)) mask |= 2;
  else if (sector === 2 && (mask & 2)) mask |= 4;
  else if (sector === 3 && (mask & 4)) mask |= 8;

  // Crossed start/finish line forward (from final quarter > 75% to first quarter < 25%)
  const crossedForward =
    prevLapProgress > totalLength * 0.75 && newLapProgress < totalLength * 0.25;

  if (crossedForward && (mask & 0b1111) === 0b1111) {
    if (currentLap >= totalLaps) {
      return {
        lap: totalLaps,
        checkpointMask: 0b1111,
        completedLap: true,
        finishedRace: true,
      };
    }
    return {
      lap: currentLap + 1,
      checkpointMask: 1, // already in sector 0 of next lap
      completedLap: true,
      finishedRace: false,
    };
  }

  return {
    lap: currentLap,
    checkpointMask: mask,
    completedLap: false,
    finishedRace: false,
  };
}
