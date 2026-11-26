export type GameScreenState = 'title' | 'playing' | 'paused' | 'gameover';

export type SessionType = 'race' | 'qualifying';

export type CameraMode = 'chase' | 'helmet' | 'tv';

export type BikeClassId = 'moto3' | 'moto2' | 'motogp';

export type CircuitId =
  | 'lusail'
  | 'mugello'
  | 'assen'
  | 'motegi'
  | 'mandalika'
  | 'sepang';

export interface BikeClassSpec {
  id: BikeClassId;
  label: string;
  displacement: string;
  topSpeedMs: number;
  boostTopSpeedMs: number;
  accelMultiplier: number;
  handlingMultiplier: number;
  maxRpm: number;
  badgeColor: string;
  description: string;
}

export const BIKE_CLASSES: Record<BikeClassId, BikeClassSpec> = {
  moto3: {
    id: 'moto3',
    label: 'Moto3',
    displacement: '250cc Single',
    topSpeedMs: 65, // ~234 km/h
    boostTopSpeedMs: 72, // ~259 km/h
    accelMultiplier: 0.76,
    handlingMultiplier: 1.16,
    maxRpm: 14000,
    badgeColor: '#0ea5e9',
    description: 'Lightweight agile 250cc entry class — sharp cornering & slipstream battles.',
  },
  moto2: {
    id: 'moto2',
    label: 'Moto2',
    displacement: '765cc Triple',
    topSpeedMs: 76, // ~274 km/h
    boostTopSpeedMs: 84, // ~302 km/h
    accelMultiplier: 0.9,
    handlingMultiplier: 1.07,
    maxRpm: 15000,
    badgeColor: '#f59e0b',
    description: 'Intermediate 765cc prototype — balanced mid-corner grip & strong drive.',
  },
  motogp: {
    id: 'motogp',
    label: 'MotoGP',
    displacement: '1000cc V4',
    topSpeedMs: 88, // ~317 km/h
    boostTopSpeedMs: 97, // ~349 km/h
    accelMultiplier: 1.04,
    handlingMultiplier: 1.0,
    maxRpm: 16500,
    badgeColor: '#dc2626',
    description: 'Premier 1000cc aero prototype — extreme top speed & bi-plane downforce.',
  },
};

export interface TeamLivery {
  id: string;
  name: string;
  riderName: string;
  shortCode: string;
  primaryHex: string;
  secondaryHex: string;
  accentHex: string;
  number: number;
}

export const TEAM_LIVERIES: TeamLivery[] = [
  {
    id: 'ducati',
    name: 'Borgo Rosso',
    riderName: 'F. Bagnaia',
    shortCode: 'BGR',
    primaryHex: '#dc2626',
    secondaryHex: '#18181b',
    accentHex: '#f8fafc',
    number: 1,
  },
  {
    id: 'ducati-2',
    name: 'Borgo Rosso',
    riderName: 'E. Bastianini',
    shortCode: 'BGR',
    primaryHex: '#b91c1c',
    secondaryHex: '#18181b',
    accentHex: '#fca5a5',
    number: 23,
  },
  {
    id: 'yamaha',
    name: 'Iwata Blue',
    riderName: 'F. Quartararo',
    shortCode: 'IWT',
    primaryHex: '#2563eb',
    secondaryHex: '#0f172a',
    accentHex: '#38bdf8',
    number: 20,
  },
  {
    id: 'kawasaki',
    name: 'Iwata Blue',
    riderName: 'A. Rins',
    shortCode: 'IWT',
    primaryHex: '#1d4ed8',
    secondaryHex: '#0f172a',
    accentHex: '#93c5fd',
    number: 42,
  },
  {
    id: 'honda',
    name: 'Gresini Crimson',
    riderName: 'M. Marquez',
    shortCode: 'GRS',
    primaryHex: '#0284c7',
    secondaryHex: '#1e293b',
    accentHex: '#ef4444',
    number: 93,
  },
  {
    id: 'gresini-2',
    name: 'Gresini Sky',
    riderName: 'A. Marquez',
    shortCode: 'GRS',
    primaryHex: '#0ea5e9',
    secondaryHex: '#1e293b',
    accentHex: '#f8fafc',
    number: 73,
  },
  {
    id: 'pramac',
    name: 'Pramac Violet',
    riderName: 'J. Martin',
    shortCode: 'PRM',
    primaryHex: '#7c3aed',
    secondaryHex: '#111827',
    accentHex: '#f43f5e',
    number: 89,
  },
  {
    id: 'pramac-2',
    name: 'Pramac Violet',
    riderName: 'F. Morbidelli',
    shortCode: 'PRM',
    primaryHex: '#6d28d9',
    secondaryHex: '#111827',
    accentHex: '#e879f9',
    number: 21,
  },
  {
    id: 'aprilia',
    name: 'Noale Factory',
    riderName: 'A. Espargaro',
    shortCode: 'NOL',
    primaryHex: '#4f46e5',
    secondaryHex: '#09090b',
    accentHex: '#f43f5e',
    number: 41,
  },
  {
    id: 'aprilia-2',
    name: 'Noale Factory',
    riderName: 'M. Vinales',
    shortCode: 'NOL',
    primaryHex: '#4338ca',
    secondaryHex: '#09090b',
    accentHex: '#fb7185',
    number: 12,
  },
  {
    id: 'suzuki',
    name: 'HRC Repsol',
    riderName: 'J. Mir',
    shortCode: 'HRC',
    primaryHex: '#ea580c',
    secondaryHex: '#1e293b',
    accentHex: '#facc15',
    number: 36,
  },
  {
    id: 'honda-2',
    name: 'HRC Repsol',
    riderName: 'L. Marini',
    shortCode: 'HRC',
    primaryHex: '#c2410c',
    secondaryHex: '#0f172a',
    accentHex: '#fde047',
    number: 10,
  },
  {
    id: 'ktm',
    name: 'Mattighofen Orange',
    riderName: 'B. Binder',
    shortCode: 'MGF',
    primaryHex: '#f97316',
    secondaryHex: '#18181b',
    accentHex: '#f8fafc',
    number: 33,
  },
  {
    id: 'ktm-2',
    name: 'Mattighofen Orange',
    riderName: 'J. Miller',
    shortCode: 'MGF',
    primaryHex: '#d97706',
    secondaryHex: '#18181b',
    accentHex: '#f8fafc',
    number: 43,
  },
  {
    id: 'vr46',
    name: 'Tavullia Neon',
    riderName: 'M. Bezzecchi',
    shortCode: 'TVL',
    primaryHex: '#ca8a04',
    secondaryHex: '#09090b',
    accentHex: '#bef264',
    number: 72,
  },
  {
    id: 'vr46-2',
    name: 'Tavullia Neon',
    riderName: 'F. Di Giannantonio',
    shortCode: 'TVL',
    primaryHex: '#eab308',
    secondaryHex: '#09090b',
    accentHex: '#f8fafc',
    number: 49,
  },
  {
    id: 'gresini',
    name: 'Tech3 Crimson',
    riderName: 'P. Acosta',
    shortCode: 'TC3',
    primaryHex: '#e11d48',
    secondaryHex: '#18181b',
    accentHex: '#f8fafc',
    number: 31,
  },
  {
    id: 'tech3-2',
    name: 'Tech3 Crimson',
    riderName: 'A. Fernandez',
    shortCode: 'TC3',
    primaryHex: '#be123c',
    secondaryHex: '#18181b',
    accentHex: '#fda4af',
    number: 37,
  },
  {
    id: 'trackhouse-1',
    name: 'Trackhouse USA',
    riderName: 'M. Oliveira',
    shortCode: 'TRK',
    primaryHex: '#0891b2',
    secondaryHex: '#0f172a',
    accentHex: '#fb7185',
    number: 88,
  },
  {
    id: 'trackhouse-2',
    name: 'Trackhouse USA',
    riderName: 'R. Fernandez',
    shortCode: 'TRK',
    primaryHex: '#0e7490',
    secondaryHex: '#0f172a',
    accentHex: '#38bdf8',
    number: 25,
  },
  {
    id: 'lcr-1',
    name: 'LCR Castrol',
    riderName: 'J. Zarco',
    shortCode: 'LCR',
    primaryHex: '#16a34a',
    secondaryHex: '#111827',
    accentHex: '#ef4444',
    number: 5,
  },
  {
    id: 'lcr-2',
    name: 'LCR Idemitsu',
    riderName: 'T. Nakagami',
    shortCode: 'LCR',
    primaryHex: '#15803d',
    secondaryHex: '#111827',
    accentHex: '#f8fafc',
    number: 30,
  },
];

export type SurfaceType = 'asphalt' | 'curb' | 'gravel' | 'grass';

export interface SolidCollider {
  id: string;
  kind: 'tribun' | 'building' | 'wall' | 'pillar';
  x: number;
  z: number;
  halfX: number;
  halfZ: number;
  cosH: number;
  sinH: number;
}

export interface RiderInput {
  throttle: number; // 0..1
  brake: number; // 0..1
  steer: number; // -1..1 (negative = left, positive = right)
  boost: boolean;
}

export interface BikeState {
  id: string;
  name: string;
  livery: TeamLivery;
  bikeClass: BikeClassId;
  isPlayer: boolean;
  isRemote: boolean;
  isAi: boolean;

  // World kinematics
  x: number;
  z: number;
  heading: number; // radians, 0 = +Z, PI/2 = +X
  speed: number; // m/s
  leanAngle: number; // radians (-maxLean .. +maxLean)
  steerVisual: number; // radians
  wheelSpin: number; // radians

  // Powertrain & KERS
  gear: number; // 1..6
  rpm: number; // 3000..16500
  boostFuel: number; // 0..100
  isBoosting: boolean;
  inSlipstream: boolean;
  surface: SurfaceType;

  // Race progress
  trackS: number; // 0..trackLength
  trackOffset: number; // lateral offset from centerline
  lap: number; // 1..totalLaps
  checkpointMask: number; // bitmask of passed sectors 0..3
  totalProgress: number; // (lap - 1) * trackLength + trackS
  finished: boolean;
  finishTimeMs: number;
  currentLapStartMs: number;
  bestLapMs: number | null;
  topSpeedKmh: number;
  rank: number; // 1..N

  // Crash & Recovery state
  crashed: boolean;
  crashTimer: number; // seconds remaining before auto-recovery
  crashSlideYaw: number; // spin offset while sliding
  crashDirSign: 1 | -1; // tip-over side
  recoveryGraceTimer: number; // post-reset invulnerability window

  // AI parameters
  aiTargetOffset: number;
  aiPassOffset: number;
  aiPaceFactor: number;
  aiAggression: number;

  // Network interpolation targets for remote riders
  netTargetX?: number;
  netTargetZ?: number;
  netTargetHeading?: number;
  netTargetLean?: number;
  netTargetSpeed?: number;
}

export interface LeaderboardEntry {
  id: string;
  rank: number;
  name: string;
  color: string;
  isPlayer: boolean;
  crashed: boolean;
}

export interface HudSnapshot {
  sessionType: SessionType;
  speedKmh: number;
  gear: number;
  rpmRatio: number;
  boostFuel: number;
  isBoosting: boolean;
  lap: number;
  totalLaps: number;
  rank: number;
  totalRiders: number;
  raceTimeMs: number;
  currentLapMs: number;
  bestLapMs: number | null;
  countdownStage: number; // 3, 2, 1, 0 (GO), -1 (active)
  surface: SurfaceType;
  wrongWay: boolean;
  crashed: boolean;
  crashRecoverSec: number;
  bikeClass: BikeClassId;
  leaderboard: LeaderboardEntry[];
  minimapRiders: Array<{
    id: string;
    x: number;
    z: number;
    color: string;
    isPlayer: boolean;
  }>;
}

export interface RaceResultEntry {
  id: string;
  name: string;
  livery: TeamLivery;
  rank: number;
  finishTimeMs: number;
  bestLapMs: number | null;
  topSpeedKmh: number;
  isPlayer: boolean;
  isAi: boolean;
}

export interface LanPlayerInfo {
  id: string;
  name: string;
  liveryId: string;
  ready: boolean;
  isHost: boolean;
}

export interface LanRoomState {
  code: string;
  hostId: string;
  status: 'lobby' | 'racing' | 'finished';
  totalLaps: number;
  bikeClass: BikeClassId;
  circuitId: CircuitId;
  fillWithAi: boolean;
  players: LanPlayerInfo[];
}

export interface RiderNetState {
  id: string;
  x: number;
  z: number;
  heading: number;
  speed: number;
  leanAngle: number;
  gear: number;
  rpm: number;
  lap: number;
  totalProgress: number;
  finished: boolean;
  finishTimeMs: number;
  bestLapMs: number | null;
  topSpeedKmh: number;
  isBoosting: boolean;
  crashed?: boolean;
}
