import type { BikeClassId, RaceResultEntry } from './types';

export interface CareerRound {
  roundNumber: number;
  grandPrixName: string;
  country: string;
  laps: number;
  aiDifficulty: number; // pace multiplier
  skyMood: 'sunny' | 'sunset' | 'overcast';
}

export interface CareerChampionship {
  classId: BikeClassId;
  title: string;
  pointsToAdvance: number;
  rounds: CareerRound[];
}

export const CAREER_CHAMPIONSHIPS: Record<BikeClassId, CareerChampionship> = {
  moto3: {
    classId: 'moto3',
    title: 'Moto3 World Championship',
    pointsToAdvance: 40, // e.g., 2 wins or consistent podiums across 3 rounds
    rounds: [
      { roundNumber: 1, grandPrixName: 'GP of Qatar', country: 'Lusail', laps: 2, aiDifficulty: 0.8, skyMood: 'sunset' },
      { roundNumber: 2, grandPrixName: 'GP of Italy', country: 'Mugello', laps: 2, aiDifficulty: 0.85, skyMood: 'sunny' },
      { roundNumber: 3, grandPrixName: 'GP of Spain', country: 'Jerez', laps: 3, aiDifficulty: 0.89, skyMood: 'sunny' },
    ],
  },
  moto2: {
    classId: 'moto2',
    title: 'Moto2 World Championship',
    pointsToAdvance: 45,
    rounds: [
      { roundNumber: 1, grandPrixName: 'GP of Catalunya', country: 'Barcelona', laps: 3, aiDifficulty: 0.88, skyMood: 'sunny' },
      { roundNumber: 2, grandPrixName: 'Dutch TT', country: 'Assen', laps: 3, aiDifficulty: 0.92, skyMood: 'overcast' },
      { roundNumber: 3, grandPrixName: 'GP of Japan', country: 'Motegi', laps: 3, aiDifficulty: 0.95, skyMood: 'sunset' },
    ],
  },
  motogp: {
    classId: 'motogp',
    title: 'MotoGP Premier Championship',
    pointsToAdvance: 75,
    rounds: [
      { roundNumber: 1, grandPrixName: 'GP of Austria', country: 'Spielberg', laps: 3, aiDifficulty: 0.93, skyMood: 'sunny' },
      { roundNumber: 2, grandPrixName: 'GP of Indonesia', country: 'Mandalika', laps: 3, aiDifficulty: 0.96, skyMood: 'sunset' },
      { roundNumber: 3, grandPrixName: 'GP of Malaysia', country: 'Sepang', laps: 4, aiDifficulty: 0.99, skyMood: 'overcast' },
      { roundNumber: 4, grandPrixName: 'GP of Valencia', country: 'Cheste', laps: 4, aiDifficulty: 1.02, skyMood: 'sunset' },
    ],
  },
};

export interface CareerProgress {
  activeClass: BikeClassId;
  unlockedClasses: BikeClassId[];
  currentRoundIndex: number; // 0-based index into activeClass rounds
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

const STORAGE_KEY = 'apexgp_career_v1';

// Official MotoGP points table (1st..6th)
export const POINTS_BY_RANK = [25, 20, 16, 13, 11, 10];

export function createDefaultCareerProgress(): CareerProgress {
  return {
    activeClass: 'moto3',
    unlockedClasses: ['moto3'],
    currentRoundIndex: 0,
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
  if (rank < 1) return 0;
  return POINTS_BY_RANK[rank - 1] ?? 5;
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
