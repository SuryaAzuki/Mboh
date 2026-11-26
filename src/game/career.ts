import { getCircuit } from './trackMath';
import {
  BIKE_CLASSES,
  TEAM_LIVERIES,
  type BikeClassId,
  type CircuitId,
  type RaceResultEntry,
  type TeamLivery,
} from './types';

export const DEFAULT_RACE_RIDER_COUNT = 22;
export const MAX_RACE_RIDER_COUNT = 22;

export interface CareerRound {
  roundNumber: number;
  dateLabel: string;
  grandPrixName: string;
  circuitName: string;
  country: string;
  circuitId: CircuitId;
  laps: number;
  aiDifficulty: number;
  skyMood: 'sunny' | 'sunset' | 'overcast';
}

export interface CareerChampionship {
  classId: BikeClassId;
  title: string;
  pointsToAdvance: number;
  rounds: CareerRound[];
}

interface RealCalendarStop {
  dateLabel: string;
  grandPrixName: string;
  circuitName: string;
  country: string;
  circuitId: CircuitId;
  skyMood: 'sunny' | 'sunset' | 'overcast';
}

// Official 20-Round MotoGP World Championship Calendar Schedule (Mar -> Nov)
const REAL_CALENDAR_SCHEDULE: RealCalendarStop[] = [
  { dateLabel: 'Mar 02', grandPrixName: 'GP of Thailand', circuitName: 'Chang International Circuit', country: 'Thailand', circuitId: 'sepang', skyMood: 'sunny' },
  { dateLabel: 'Mar 16', grandPrixName: 'GP of Argentina', circuitName: 'Termas de Rio Hondo', country: 'Argentina', circuitId: 'mandalika', skyMood: 'sunny' },
  { dateLabel: 'Mar 30', grandPrixName: 'GP of the Americas', circuitName: 'Circuit of the Americas', country: 'USA', circuitId: 'motegi', skyMood: 'sunny' },
  { dateLabel: 'Apr 13', grandPrixName: 'GP of Qatar', circuitName: 'Lusail International Circuit', country: 'Qatar', circuitId: 'lusail', skyMood: 'sunset' },
  { dateLabel: 'Apr 27', grandPrixName: 'GP of Spain', circuitName: 'Circuito de Jerez', country: 'Spain', circuitId: 'assen', skyMood: 'sunny' },
  { dateLabel: 'May 11', grandPrixName: 'GP of France', circuitName: 'Bugatti Circuit Le Mans', country: 'France', circuitId: 'mugello', skyMood: 'overcast' },
  { dateLabel: 'May 25', grandPrixName: 'GP of Great Britain', circuitName: 'Silverstone Circuit', country: 'UK', circuitId: 'sepang', skyMood: 'overcast' },
  { dateLabel: 'Jun 08', grandPrixName: 'GP of Aragon', circuitName: 'MotorLand Aragon', country: 'Spain', circuitId: 'lusail', skyMood: 'sunny' },
  { dateLabel: 'Jun 22', grandPrixName: 'GP of Italy', circuitName: 'Autodromo del Mugello', country: 'Italy', circuitId: 'mugello', skyMood: 'sunny' },
  { dateLabel: 'Jun 29', grandPrixName: 'Dutch TT', circuitName: 'TT Circuit Assen', country: 'Netherlands', circuitId: 'assen', skyMood: 'overcast' },
  { dateLabel: 'Jul 13', grandPrixName: 'GP of Germany', circuitName: 'Sachsenring', country: 'Germany', circuitId: 'motegi', skyMood: 'sunny' },
  { dateLabel: 'Aug 17', grandPrixName: 'GP of Austria', circuitName: 'Red Bull Ring', country: 'Austria', circuitId: 'mugello', skyMood: 'sunny' },
  { dateLabel: 'Sep 07', grandPrixName: 'GP of Catalunya', circuitName: 'Circuit de Barcelona', country: 'Spain', circuitId: 'lusail', skyMood: 'sunny' },
  { dateLabel: 'Sep 14', grandPrixName: 'GP of San Marino', circuitName: 'Misano World Circuit', country: 'Italy', circuitId: 'mandalika', skyMood: 'sunset' },
  { dateLabel: 'Sep 28', grandPrixName: 'GP of Japan', circuitName: 'Mobility Resort Motegi', country: 'Japan', circuitId: 'motegi', skyMood: 'sunset' },
  { dateLabel: 'Oct 05', grandPrixName: 'GP of Indonesia', circuitName: 'Pertamina Mandalika Circuit', country: 'Indonesia', circuitId: 'mandalika', skyMood: 'sunny' },
  { dateLabel: 'Oct 19', grandPrixName: 'GP of Australia', circuitName: 'Phillip Island', country: 'Australia', circuitId: 'assen', skyMood: 'overcast' },
  { dateLabel: 'Oct 26', grandPrixName: 'GP of Malaysia', circuitName: 'Sepang International Circuit', country: 'Malaysia', circuitId: 'sepang', skyMood: 'overcast' },
  { dateLabel: 'Nov 09', grandPrixName: 'GP of Portugal', circuitName: 'Autodromo do Algarve', country: 'Portugal', circuitId: 'mugello', skyMood: 'sunset' },
  { dateLabel: 'Nov 16', grandPrixName: 'GP of Valencia', circuitName: 'Circuit Ricardo Tormo', country: 'Spain', circuitId: 'lusail', skyMood: 'sunset' },
];

function buildRoundsForClass(baseDifficulty: number, difficultySpan: number, laps: number): CareerRound[] {
  return REAL_CALENDAR_SCHEDULE.map((stop, idx) => ({
    roundNumber: idx + 1,
    dateLabel: stop.dateLabel,
    grandPrixName: stop.grandPrixName,
    circuitName: stop.circuitName,
    country: stop.country,
    circuitId: stop.circuitId,
    laps: idx >= 17 ? laps + 1 : laps,
    aiDifficulty: Number((baseDifficulty + (idx / (REAL_CALENDAR_SCHEDULE.length - 1)) * difficultySpan).toFixed(3)),
    skyMood: stop.skyMood,
  }));
}

export const CAREER_CHAMPIONSHIPS: Record<BikeClassId, CareerChampionship> = {
  moto3: {
    classId: 'moto3',
    title: 'Moto3 World Championship',
    pointsToAdvance: 180,
    rounds: buildRoundsForClass(0.9, 0.08, 2),
  },
  moto2: {
    classId: 'moto2',
    title: 'Moto2 World Championship',
    pointsToAdvance: 200,
    rounds: buildRoundsForClass(0.94, 0.07, 3),
  },
  motogp: {
    classId: 'motogp',
    title: 'MotoGP World Championship',
    pointsToAdvance: 230,
    rounds: buildRoundsForClass(0.98, 0.06, 3),
  },
};

export interface CareerProgress {
  activeClass: BikeClassId;
  unlockedClasses: BikeClassId[];
  currentRoundIndex: number; // 0-based index into 20-round calendar
  qualifyingGridPos: number | null; // 1-based earned starting slot for current round
  qualifyingLapMs: number | null;
  qualifyingOrderIds: string[]; // ordered AI livery IDs from fastest to slowest
  seasonPoints: number;
  totalPoints: number;
  wins: number;
  podiums: number;
  racesCompleted: number;
  championshipsWon: BikeClassId[];
  lastSeasonSummary: {
    classId: BikeClassId;
    points: number;
    promotedTo: BikeClassId | null;
    wonTitle: boolean;
  } | null;
}

const STORAGE_KEY = 'apexgp_career_v2';

// Official MotoGP championship points table (1st..15th)
export const POINTS_BY_RANK = [25, 20, 16, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

export function createDefaultCareerProgress(): CareerProgress {
  return {
    activeClass: 'moto3',
    unlockedClasses: ['moto3'],
    currentRoundIndex: 0,
    qualifyingGridPos: null,
    qualifyingLapMs: null,
    qualifyingOrderIds: [],
    seasonPoints: 0,
    totalPoints: 0,
    wins: 0,
    podiums: 0,
    racesCompleted: 0,
    championshipsWon: [],
    lastSeasonSummary: null,
  };
}

export function loadCareerProgress(): CareerProgress {
  if (typeof window === 'undefined') return createDefaultCareerProgress();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultCareerProgress();
    const parsed = JSON.parse(raw) as Partial<CareerProgress>;
    if (!parsed.activeClass || !Array.isArray(parsed.unlockedClasses)) {
      return createDefaultCareerProgress();
    }
    return {
      ...createDefaultCareerProgress(),
      ...parsed,
    };
  } catch {
    return createDefaultCareerProgress();
  }
}

export function saveCareerProgress(progress: CareerProgress): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // ignore storage quota errors
  }
}

export function resetCareerProgress(): CareerProgress {
  const fresh = createDefaultCareerProgress();
  saveCareerProgress(fresh);
  return fresh;
}

export function getPointsForRank(rank: number): number {
  if (rank < 1 || rank > POINTS_BY_RANK.length) return 0;
  return POINTS_BY_RANK[rank - 1];
}

export function applyCareerRaceOutcome(
  current: CareerProgress,
  playerRank: number,
): {
  updated: CareerProgress;
  pointsEarned: number;
  promotedTo: BikeClassId | null;
  seasonFinished: boolean;
  wonChampionship: boolean;
} {
  const champ = CAREER_CHAMPIONSHIPS[current.activeClass];
  const pointsEarned = getPointsForRank(playerRank);
  const newSeasonPoints = current.seasonPoints + pointsEarned;
  const newTotalPoints = current.totalPoints + pointsEarned;
  const wins = current.wins + (playerRank === 1 ? 1 : 0);
  const podiums = current.podiums + (playerRank <= 3 ? 1 : 0);
  const racesCompleted = current.racesCompleted + 1;

  const isLastRound = current.currentRoundIndex >= champ.rounds.length - 1;
  const unlocked = new Set<BikeClassId>(current.unlockedClasses);
  const champsWon = new Set<BikeClassId>(current.championshipsWon);

  let nextClass: BikeClassId = current.activeClass;
  let nextRoundIndex = current.currentRoundIndex + 1;
  let nextSeasonPoints = newSeasonPoints;
  let promotedTo: BikeClassId | null = null;
  let wonChampionship = false;
  let lastSeasonSummary = current.lastSeasonSummary;

  if (isLastRound) {
    wonChampionship = newSeasonPoints >= champ.pointsToAdvance;
    if (wonChampionship) {
      champsWon.add(current.activeClass);
      if (current.activeClass === 'moto3') {
        unlocked.add('moto2');
        nextClass = 'moto2';
        promotedTo = 'moto2';
      } else if (current.activeClass === 'moto2') {
        unlocked.add('motogp');
        nextClass = 'motogp';
        promotedTo = 'motogp';
      }
    }
    lastSeasonSummary = {
      classId: current.activeClass,
      points: newSeasonPoints,
      promotedTo,
      wonTitle: wonChampionship,
    };
    nextRoundIndex = 0;
    nextSeasonPoints = 0;
  }

  return {
    updated: {
      activeClass: nextClass,
      unlockedClasses: Array.from(unlocked),
      currentRoundIndex: nextRoundIndex,
      qualifyingGridPos: null,
      qualifyingLapMs: null,
      qualifyingOrderIds: [],
      seasonPoints: nextSeasonPoints,
      totalPoints: newTotalPoints,
      wins,
      podiums,
      racesCompleted,
      championshipsWon: Array.from(champsWon),
      lastSeasonSummary,
    },
    pointsEarned,
    promotedTo,
    seasonFinished: isLastRound,
    wonChampionship,
  };
}

export function getActiveCareerRound(progress: CareerProgress): CareerRound {
  const champ = CAREER_CHAMPIONSHIPS[progress.activeClass];
  const idx = Math.max(0, Math.min(champ.rounds.length - 1, progress.currentRoundIndex));
  return champ.rounds[idx];
}

export function findPlayerRankFromResults(results: RaceResultEntry[]): number {
  const player = results.find((r) => r.isPlayer);
  return player?.rank ?? results.length;
}

export function buildQualifyingClassification(params: {
  circuitId: CircuitId;
  bikeClass: BikeClassId;
  aiDifficulty: number;
  playerLivery: TeamLivery;
  playerName: string;
  playerLapMs: number;
  playerTopSpeedKmh: number;
  riderCount?: number;
}): {
  results: RaceResultEntry[];
  playerGridPos: number;
  orderedAiLiveryIds: string[];
} {
  const riderCount = Math.max(2, Math.min(TEAM_LIVERIES.length, params.riderCount ?? DEFAULT_RACE_RIDER_COUNT));
  const circuit = getCircuit(params.circuitId);
  const spec = BIKE_CLASSES[params.bikeClass];

  // Estimate benchmark pole lap pace from circuit length & class average speed
  const avgCornerRatio = 0.67;
  const poleAvgSpeedMs = spec.topSpeedMs * avgCornerRatio * (0.98 + (params.aiDifficulty - 0.94) * 0.25);
  const poleLapMs = Math.round((circuit.totalLength / Math.max(36, poleAvgSpeedMs)) * 1000);

  const aiPool = TEAM_LIVERIES.filter((l) => l.id !== params.playerLivery.id).slice(0, riderCount - 1);
  const entries: RaceResultEntry[] = [
    {
      id: 'local',
      name: params.playerName,
      livery: params.playerLivery,
      rank: 1,
      finishTimeMs: Math.max(10000, Math.round(params.playerLapMs)),
      bestLapMs: Math.max(10000, Math.round(params.playerLapMs)),
      topSpeedKmh: params.playerTopSpeedKmh,
      isPlayer: true,
      isAi: false,
    },
    ...aiPool.map((liv, i) => {
      // Realistic tight MotoGP qualifying spread (~0.18s to ~3.4s behind pole)
      const spreadPct = 0.002 + (i / Math.max(1, aiPool.length - 1)) * 0.042;
      const jitter = ((i * 37) % 11) * 45;
      const aiTimeMs = Math.round(poleLapMs * (1 + spreadPct) + jitter);
      return {
        id: `ai-${i + 1}`,
        name: liv.riderName,
        livery: liv,
        rank: 1,
        finishTimeMs: aiTimeMs,
        bestLapMs: aiTimeMs,
        topSpeedKmh: Math.round(spec.topSpeedMs * 3.6 - (i % 5) * 1.4),
        isPlayer: false,
        isAi: true,
      };
    }),
  ];

  entries.sort((a, b) => a.finishTimeMs - b.finishTimeMs);
  entries.forEach((entry, idx) => {
    entry.rank = idx + 1;
  });

  const playerEntry = entries.find((e) => e.isPlayer)!;
  const orderedAiLiveryIds = entries.filter((e) => e.isAi).map((e) => e.livery.id);

  return {
    results: entries,
    playerGridPos: playerEntry.rank,
    orderedAiLiveryIds,
  };
}
