import type { LeaderboardEntry } from './types';

export const LEADERBOARD_PAGE_SIZE = 5;
export const LEADERBOARD_MAX_SHOWN_RANK = 15;
export const LEADERBOARD_CYCLE_MS = 3000;

export interface LeaderboardSliceResult {
  pageIndex: number;
  totalPages: number;
  rangeLabel: string;
  rows: LeaderboardEntry[];
  pinnedPlayer: LeaderboardEntry | null;
}

export function getLeaderboardPageSlice(
  leaderboard: LeaderboardEntry[],
  rawPageIndex: number,
): LeaderboardSliceResult {
  const maxShown = Math.min(leaderboard.length, LEADERBOARD_MAX_SHOWN_RANK);
  const totalPages = Math.max(1, Math.ceil(maxShown / LEADERBOARD_PAGE_SIZE));
  const pageIndex = ((rawPageIndex % totalPages) + totalPages) % totalPages;
  const start = pageIndex * LEADERBOARD_PAGE_SIZE;
  const end = Math.min(maxShown, start + LEADERBOARD_PAGE_SIZE);
  const rows = leaderboard.slice(start, end);
  const rangeLabel = rows.length > 0 ? `${start + 1}-${end}` : '1-5';

  const playerInSlice = rows.some((r) => r.isPlayer);
  const playerEntry = leaderboard.find((r) => r.isPlayer) ?? null;

  return {
    pageIndex,
    totalPages,
    rangeLabel,
    rows,
    pinnedPlayer: playerInSlice ? null : playerEntry,
  };
}
