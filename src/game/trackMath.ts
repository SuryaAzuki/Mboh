import type { CircuitId, SurfaceType } from './types';

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
  nx: number; // unit right normal x
  nz: number; // unit right normal z
  curvature: number; // signed curvature (rad/m)
}

export const TRACK_HALF_WIDTH = 8.5; // 17m wide MotoGP asphalt
export const CURB_WIDTH = 1.6;
export const GRAVEL_WIDTH = 9.0;
export const WORLD_BOUNDARY_RADIUS = 1150;

export interface CircuitSpec {
  id: CircuitId;
  name: string;
  country: string;
  difficulty: 'Medium' | 'Hard' | 'Pro';
  skyMood: 'sunny' | 'sunset' | 'overcast';
  corners: number;
  description: string;
  controlPoints: Vec2[];
}

// All circuits share a clean straight along x = 0 heading +Z (z = -240 -> +260) for start/finish & pit lane,
// then branch into longer (3.7km - 4.8km), technically demanding loops with hairpins, chicanes, and fast sweepers.
export const CIRCUIT_SPECS: Record<CircuitId, CircuitSpec> = {
  lusail: {
    id: 'lusail',
    name: 'Lusail International Circuit',
    country: 'Qatar',
    difficulty: 'Hard',
    skyMood: 'sunset',
    corners: 20,
    description: 'High-speed main straight into tight hairpins, triple-apex sweepers, and technical Sector 2 chicanes.',
    controlPoints: [
      { x: 0, z: -260 },
      { x: 0, z: -40 },
      { x: 0, z: 220 },
      { x: 16, z: 440 }, // Long straight into heavy T1 braking
      { x: 150, z: 520 }, // T1 hairpin apex
      { x: 220, z: 360 }, // T2 sharp left switchback
      { x: 345, z: 445 }, // T3-T4 fast right
      { x: 490, z: 395 }, // Sweeper entry
      { x: 440, z: 260 }, // Sector 2 chicane left
      { x: 615, z: 225 }, // Sector 2 chicane right
      { x: 630, z: 85 }, // Heavy braking into hairpin
      { x: 430, z: 70 }, // Mid-sector tight hairpin
      { x: 470, z: -65 }, // Fast S-bend
      { x: 660, z: -135 }, // Triple-apex right entry
      { x: 710, z: -340 }, // Outer back straight
      { x: 545, z: -490 }, // T16 braking zone
      { x: 405, z: -365 }, // Technical S-chicane
      { x: 275, z: -510 }, // T18 hairpin
      { x: 155, z: -395 }, // T19 flick
      { x: 55, z: -485 }, // Final corner onto main straight
    ],
  },
  mugello: {
    id: 'mugello',
    name: 'Autodromo del Mugello',
    country: 'Italy',
    difficulty: 'Pro',
    skyMood: 'sunny',
    corners: 19,
    description: 'Relentless Tuscan hill circuit with San Donato hairpin, Materassi esses, and Arrabbiata plunge.',
    controlPoints: [
      { x: 0, z: -260 },
      { x: 0, z: -20 },
      { x: 0, z: 240 },
      { x: 12, z: 470 }, // Ultra-fast straight crest into San Donato
      { x: 145, z: 560 }, // San Donato heavy hairpin
      { x: 210, z: 395 }, // Luco left
      { x: 330, z: 480 }, // Poggio Secco right
      { x: 455, z: 375 }, // Materassi chicane entry
      { x: 370, z: 250 }, // Borgo San Lorenzo left
      { x: 545, z: 210 }, // Casanova right
      { x: 495, z: 70 }, // Savelli sharp left
      { x: 685, z: 25 }, // Arrabbiata 1 high-speed climb
      { x: 655, z: -145 }, // Arrabbiata 2 crest
      { x: 460, z: -110 }, // Scarperia hairpin
      { x: 395, z: -240 }, // Palagio-Correntaio switchback
      { x: 565, z: -335 }, // Correntaio sweeping right
      { x: 415, z: -495 }, // Biondetti S-bend
      { x: 245, z: -405 }, // Biondetti exit
      { x: 135, z: -525 }, // Bucine final braking hairpin
      { x: 38, z: -425 },
    ],
  },
  assen: {
    id: 'assen',
    name: 'TT Circuit Assen',
    country: 'Netherlands',
    difficulty: 'Pro',
    skyMood: 'overcast',
    corners: 22,
    description: 'The Cathedral of Speed — rapid flip-flop chicanes, tight Strubben hairpin, and fierce GT braking.',
    controlPoints: [
      { x: 0, z: -260 },
      { x: 0, z: -30 },
      { x: 0, z: 215 },
      { x: 28, z: 415 }, // Haarbocht right
      { x: 185, z: 490 }, // Madijk sweeper
      { x: 245, z: 335 }, // Ossebroeken tight right
      { x: 135, z: 235 }, // Strubben slow hairpin
      { x: 280, z: 175 }, // Veenslang kink
      { x: 365, z: 285 }, // Ruskenhoek chicane
      { x: 545, z: 240 }, // Stekkenwal right
      { x: 695, z: 130 }, // De Bult heavy turn
      { x: 545, z: 40 }, // Mandeveen switchback
      { x: 665, z: -80 }, // Duikersloot right
      { x: 750, z: -255 }, // Meeuwenmeer fast arc
      { x: 620, z: -455 }, // Hoge Heide braking
      { x: 470, z: -355 }, // Ramshoek S1
      { x: 375, z: -510 }, // Ramshoek S2
      { x: 225, z: -390 }, // GT Chicane entry
      { x: 135, z: -510 }, // GT Final hairpin
      { x: 42, z: -415 },
    ],
  },
  motegi: {
    id: 'motegi',
    name: 'Mobility Resort Motegi',
    country: 'Japan',
    difficulty: 'Pro',
    skyMood: 'sunset',
    corners: 19,
    description: 'Brutal stop-and-go heavy braking zones, 90-degree corners, and Downhill Straight hairpin.',
    controlPoints: [
      { x: 0, z: -260 },
      { x: 0, z: -40 },
      { x: 0, z: 225 },
      { x: 36, z: 445 }, // Turn 1 tight right
      { x: 215, z: 480 }, // Turn 2
      { x: 255, z: 295 }, // Turn 3-4 sharp switchback
      { x: 425, z: 365 }, // Turn 5 heavy hairpin
      { x: 555, z: 255 }, // Turn 6 right
      { x: 425, z: 135 }, // Underpass hairpin
      { x: 575, z: 45 }, // S-curve exit
      { x: 415, z: -60 }, // V-Corner entry
      { x: 605, z: -155 }, // V-Corner hairpin
      { x: 765, z: -320 }, // Downhill Straight entry
      { x: 630, z: -540 }, // Hairpin Turn 11 (hardest braking)
      { x: 465, z: -420 }, // Tunnel chicane
      { x: 375, z: -560 }, // 90-degree Corner Turn 12
      { x: 220, z: -430 }, // Victory chicane left
      { x: 120, z: -520 }, // Victory final hairpin
      { x: 34, z: -415 },
    ],
  },
  mandalika: {
    id: 'mandalika',
    name: 'Pertamina Mandalika Circuit',
    country: 'Indonesia',
    difficulty: 'Hard',
    skyMood: 'sunny',
    corners: 21,
    description: 'Technical coastal esses with non-stop direction changes, Turn 10 hairpin, and stadium finale.',
    controlPoints: [
      { x: 0, z: -260 },
      { x: 0, z: -30 },
      { x: 0, z: 235 },
      { x: 30, z: 455 }, // Turn 1 coastal braking
      { x: 190, z: 525 }, // Turn 2 right
      { x: 275, z: 375 }, // Turn 3 sharp switchback
      { x: 420, z: 465 }, // Turn 4-5 double right
      { x: 575, z: 385 }, // Turn 6 coastal arc
      { x: 685, z: 225 }, // High speed coastal sector
      { x: 505, z: 165 }, // Turn 8-9 technical chicane
      { x: 365, z: 70 }, // Turn 10 slow hairpin
      { x: 525, z: -15 }, // Turn 11 right
      { x: 705, z: -105 }, // Turn 12 sweeper
      { x: 685, z: -305 }, // Turn 13 braking
      { x: 530, z: -280 }, // Turn 14 flip-flop
      { x: 545, z: -485 }, // Turn 15 stadium entry
      { x: 360, z: -545 }, // Stadium hairpin
      { x: 235, z: -405 }, // Turn 16 tight S
      { x: 105, z: -505 }, // Turn 17 final corner
      { x: 28, z: -415 },
    ],
  },
  sepang: {
    id: 'sepang',
    name: 'Sepang International Circuit',
    country: 'Malaysia',
    difficulty: 'Pro',
    skyMood: 'overcast',
    corners: 20,
    description: 'Demanding twin-straight circuit with ultra-tight T1-T2 switchback, sweeping esses, and T15 hairpin.',
    controlPoints: [
      { x: 0, z: -260 },
      { x: 0, z: 0 },
      { x: 0, z: 285 },
      { x: 15, z: 525 }, // Long straight into T1 braking
      { x: 145, z: 600 }, // Turn 1 tight hairpin
      { x: 190, z: 420 }, // Turn 2 sharp left
      { x: 330, z: 495 }, // Turn 3-4 fast sweeper
      { x: 485, z: 445 }, // Turn 5 ultra-fast S
      { x: 635, z: 315 }, // Turn 6-7 technical right
      { x: 500, z: 210 }, // Turn 8 tight switchback
      { x: 655, z: 115 }, // Turn 9 right
      { x: 485, z: 40 }, // Turn 10 slow hairpin
      { x: 585, z: -90 }, // Turn 11 climbing bend
      { x: 710, z: -235 }, // Turn 12 fast bend
      { x: 555, z: -395 }, // Back straight entry
      { x: 400, z: -330 }, // Turn 13 technical chicane
      { x: 315, z: -515 }, // Turn 14 heavy braking
      { x: 185, z: -400 }, // Back straight sprint
      { x: 90, z: -525 }, // Turn 15 final hairpin onto main straight
      { x: 26, z: -420 },
    ],
  },
};

export const CIRCUIT_LIST: CircuitSpec[] = [
  CIRCUIT_SPECS.lusail,
  CIRCUIT_SPECS.mugello,
  CIRCUIT_SPECS.assen,
  CIRCUIT_SPECS.motegi,
  CIRCUIT_SPECS.mandalika,
  CIRCUIT_SPECS.sepang,
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
  id: CircuitId;
  name: string;
  samples: TrackSample[];
  totalLength: number;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  centroid: Vec2;
}

const cachedCircuits = new Map<CircuitId, CircuitData>();

export function buildCircuitData(sampleCount = 1000, circuitId: CircuitId = 'lusail'): CircuitData {
  const spec = CIRCUIT_SPECS[circuitId] ?? CIRCUIT_SPECS.lusail;
  const cps = spec.controlPoints;
  const n = cps.length;
  const rawPoints: Vec2[] = [];

  for (let i = 0; i < sampleCount; i++) {
    const u = (i / sampleCount) * n;
    const seg = Math.floor(u) % n;
    const t = u - Math.floor(u);

    const p0 = cps[(seg - 1 + n) % n];
    const p1 = cps[seg];
    const p2 = cps[(seg + 1) % n];
    const p3 = cps[(seg + 2) % n];

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
  let sumX = 0;
  let sumZ = 0;

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
    sumX += curr.x;
    sumZ += curr.z;

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
    id: spec.id,
    name: spec.name,
    samples,
    totalLength,
    bounds: { minX, maxX, minZ, maxZ },
    centroid: { x: sumX / sampleCount, z: sumZ / sampleCount },
  };
}

export function getCircuit(circuitId: CircuitId = 'lusail'): CircuitData {
  let cached = cachedCircuits.get(circuitId);
  if (!cached) {
    cached = buildCircuitData(1000, circuitId);
    cachedCircuits.set(circuitId, cached);
  }
  return cached;
}

export function sampleTrackAtS(circuit: CircuitData, s: number): TrackSample {
  const { samples, totalLength } = circuit;
  const safeS = Number.isFinite(s) ? s : 0;
  const wrapped = ((safeS % totalLength) + totalLength) % totalLength;
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
    const centerIdx = Math.floor((((hintS % totalLength) + totalLength) % totalLength) / totalLength * n);
    const windowRadius = 48;
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

  if (bestDistSq > 48 * 48) {
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

// Point-in-polygon check against circuit centerline so scenery never spawns in the circuit infield
export function isInsideCircuitLoop(circuit: CircuitData, x: number, z: number): boolean {
  const pts = circuit.samples;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x;
    const zi = pts[i].z;
    const xj = pts[j].x;
    const zj = pts[j].z;
    const intersect = zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Start line sits at s = 180m along the long main straight (facing +Z toward Turn 1)
export const START_LINE_S = 180;

export function getLapProgressS(rawS: number, totalLength: number): number {
  return ((rawS - START_LINE_S) % totalLength + totalLength) % totalLength;
}

export function getGridSlotTransform(
  circuit: CircuitData,
  slotIndex: number,
): { x: number; z: number; heading: number; trackS: number; offset: number } {
  // Authentic MotoGP 3-wide staggered starting grid (fits up to 22+ bikes cleanly on main straight)
  const row = Math.floor(slotIndex / 3);
  const col = slotIndex % 3;
  const sBack = START_LINE_S - 10 - row * 6.5 - col * 1.1;
  const lateral = (col - 1) * 3.8; // -3.8m, 0m, +3.8m
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
  if (sector === 0) mask |= 1;
  else if (sector === 1 && (mask & 1)) mask |= 2;
  else if (sector === 2 && (mask & 2)) mask |= 4;
  else if (sector === 3 && (mask & 4)) mask |= 8;

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
      checkpointMask: 1,
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

export interface MinimapGeometry {
  size: number;
  pathD: string;
  scale: number;
  offsetX: number;
  offsetY: number;
  startLine: { x1: number; y1: number; x2: number; y2: number };
}

export function projectPointToMinimap(
  x: number,
  z: number,
  layout: Pick<MinimapGeometry, 'scale' | 'offsetX' | 'offsetY'>,
): { x: number; y: number } {
  return {
    x: x * layout.scale + layout.offsetX,
    y: z * layout.scale + layout.offsetY,
  };
}

export function buildMinimapGeometry(
  circuitId: CircuitId,
  size = 100,
  padding = 12,
): MinimapGeometry {
  const circuit = getCircuit(circuitId);
  const { minX, maxX, minZ, maxZ } = circuit.bounds;
  const spanX = Math.max(1, maxX - minX);
  const spanZ = Math.max(1, maxZ - minZ);
  const drawable = Math.max(10, size - padding * 2);
  const scale = drawable / Math.max(spanX, spanZ);
  const offsetX = (size - spanX * scale) * 0.5 - minX * scale;
  const offsetY = (size - spanZ * scale) * 0.5 - minZ * scale;

  const pathPoints: string[] = [];
  for (let i = 0; i < circuit.samples.length; i += 6) {
    const s = circuit.samples[i];
    const pt = projectPointToMinimap(s.x, s.z, { scale, offsetX, offsetY });
    pathPoints.push(`${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`);
  }
  pathPoints.push('Z');

  const startSample = sampleTrackAtS(circuit, START_LINE_S);
  const startCenter = projectPointToMinimap(startSample.x, startSample.z, {
    scale,
    offsetX,
    offsetY,
  });
  const halfTick = 4.8;
  const startLine = {
    x1: Number((startCenter.x - startSample.nx * halfTick).toFixed(1)),
    y1: Number((startCenter.y - startSample.nz * halfTick).toFixed(1)),
    x2: Number((startCenter.x + startSample.nx * halfTick).toFixed(1)),
    y2: Number((startCenter.y + startSample.nz * halfTick).toFixed(1)),
  };

  return {
    size,
    pathD: pathPoints.join(' '),
    scale,
    offsetX,
    offsetY,
    startLine,
  };
}

