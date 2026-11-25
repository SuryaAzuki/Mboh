export type GameScreenState = 'title' | 'playing' | 'paused' | 'gameover';

export type CameraMode = 'chase' | 'helmet' | 'tv';

export type BikeClassId = 'moto3' | 'moto2' | 'motogp';

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
    shortCode: 'BGR',
    primaryHex: '#dc2626',
    secondaryHex: '#18181b',
    accentHex: '#f8fafc',
    number: 1,
  },
  {
    id: 'yamaha',
    name: 'Iwata Blue',
    shortCode: 'IWT',
    primaryHex: '#2563eb',
    secondaryHex: '#0f172a',
    accentHex: '#38bdf8',
    number: 20,
  },
  {
    id: 'kawasaki',
    name: 'Akashi Lime',
    shortCode: 'AKS',
    primaryHex: '#16a34a',
    secondaryHex: '#111827',
    accentHex: '#a3e635',
    number: 65,
  },
  {
    id: 'aprilia',
    name: 'Noale Gold',
    shortCode: 'NOL',
    primaryHex: '#d97706',
    secondaryHex: '#1e1b4b',
    accentHex: '#fbbf24',
    number: 41,
  },
  {
    id: 'suzuki',
    name: 'Hamamatsu Cyan',
    shortCode: 'HMT',
    primaryHex: '#0891b2',
    secondaryHex: '#0f172a',
    accentHex: '#fde047',
    number: 36,
  },
  {
    id: 'ktm',
    name: 'Mattighofen Orange',
    shortCode: 'MGF',
    primaryHex: '#ea580c',
    secondaryHex: '#18181b',
    accentHex: '#f8fafc',
    number: 33,
  },
];

export type SurfaceType = 'asphalt' | 'curb' | 'gravel' | 'grass';

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

  // AI parameters
  aiTargetOffset: number;
  aiPaceFactor: number;

  // Network interpolation targets for remote riders
  netTargetX?: number;
  netTargetZ?: number;
  netTargetHeading?: number;
  netTargetLean?: number;
  netTargetSpeed?: number;
}

export interface HudSnapshot {
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
  bikeClass: BikeClassId;
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
}
