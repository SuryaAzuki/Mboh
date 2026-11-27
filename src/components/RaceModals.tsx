import React from 'react';
import { CAREER_CHAMPIONSHIPS, type CareerProgress } from '../game/career';
import { buildPostRaceCommentary } from '../game/commentary';
import {
  BIKE_CLASSES,
  type BikeClassId,
  type CircuitId,
  type RaceResultEntry,
  type SessionType,
} from '../game/types';
import { formatRaceTime } from './RaceHud';
import { NationalFlag, RiderMiniFace } from './RiderAvatarBadge';

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onExitTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  onResume,
  onRestart,
  onExitTitle,
}) => {
  return (
    <div
      className="fixed inset-0 z-30 bg-black/70 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Race Paused"
    >
      <div className="w-full max-w-sm bg-[#0d131f] border border-white/15 rounded-2xl overflow-hidden shadow-2xl text-center">
        <div className="moto-stripe-bar" />
        <div className="p-6">
          <h2 className="text-2xl font-black italic uppercase tracking-wide text-white mb-1 font-display">
            Race Paused
          </h2>
          <p className="text-xs text-slate-400 mb-5">Press Esc or P to resume</p>

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onResume}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-red-600 to-amber-500 hover:brightness-110 text-white font-black uppercase tracking-wider text-sm cursor-pointer shadow-lg"
            >
              Resume Race
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 font-bold uppercase text-sm cursor-pointer"
            >
              Restart Grid
            </button>
            <button
              type="button"
              onClick={onExitTitle}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold uppercase text-sm cursor-pointer"
            >
              Exit to Paddock
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export interface CareerFinishOutcome {
  classPlayed: BikeClassId;
  pointsEarned: number;
  seasonRank: number;
  promotedTo: BikeClassId | null;
  seasonFinished: boolean;
  wonChampionship: boolean;
  updatedProgress: CareerProgress;
}

interface PodiumCeremonyOverlayProps {
  circuitId: CircuitId;
  bikeClass: BikeClassId;
  weatherHadRain: boolean;
  results: RaceResultEntry[];
  isLan: boolean;
  careerOutcome: CareerFinishOutcome | null;
  onViewClassification: () => void;
  onPlayAgain: () => void;
}

export const PodiumCeremonyOverlay: React.FC<PodiumCeremonyOverlayProps> = ({
  circuitId,
  bikeClass,
  weatherHadRain,
  results,
  isLan,
  careerOutcome,
  onViewClassification,
  onPlayAgain,
}) => {
  const podium = results.slice(0, 3);
  const playerEntry = results.find((r) => r.isPlayer) ?? results[0];
  const postCommentary = buildPostRaceCommentary({
    circuitId,
    bikeClass,
    sessionType: 'race',
    results,
    weatherHadRain,
    careerOutcome: careerOutcome
      ? {
          pointsEarned: careerOutcome.pointsEarned,
          seasonRank: careerOutcome.seasonRank,
          promotedTo: careerOutcome.promotedTo,
          wonChampionship: careerOutcome.wonChampionship,
        }
      : null,
  });

  return (
    <div
      data-testid="podium-ceremony-overlay"
      className="fixed inset-x-0 bottom-0 z-30 pointer-events-none p-3 sm:p-5 flex justify-center"
    >
      <div className="pointer-events-auto w-full max-w-2xl bg-[rgba(11,16,27,0.92)] border border-white/15 rounded-2xl overflow-hidden shadow-2xl">
        <div className="moto-stripe-bar" />
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
                Podium Ceremony · Parc Fermé
              </div>
              <h2 className="text-lg sm:text-xl font-black italic uppercase text-white leading-tight font-display">
                {playerEntry?.rank === 1
                  ? 'Grand Prix Victory!'
                  : playerEntry && playerEntry.rank <= 3
                  ? `Podium Finish · P${playerEntry.rank}!`
                  : `Finished P${playerEntry?.rank ?? 1}`}
              </h2>
            </div>

            {careerOutcome && (
              <div className="px-3 py-1 rounded-lg bg-emerald-950/90 border border-emerald-400/60 text-emerald-300 text-xs font-black tabular-nums">
                +{careerOutcome.pointsEarned} Career PTS
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
            {podium.map((entry) => (
              <div
                key={entry.id}
                className={`rounded-xl border px-2.5 py-2 flex items-center gap-2 ${
                  entry.isPlayer
                    ? 'bg-gradient-to-r from-red-950/80 to-amber-950/40 border-red-400/80 text-white'
                    : 'bg-slate-900/95 border-slate-800 text-slate-200'
                }`}
              >
                <span
                  className="w-6 h-6 rounded-md text-[11px] font-black text-white flex items-center justify-center shrink-0 tabular-nums"
                  style={{ backgroundColor: entry.livery.primaryHex }}
                >
                  P{entry.rank}
                </span>
                <RiderMiniFace livery={entry.livery} size="xs" showFlag />
                <div className="min-w-0">
                  <div className="text-xs font-black truncate">{entry.name}</div>
                  <div className="text-[10px] font-mono text-slate-400 tabular-nums">
                    {formatRaceTime(entry.finishTimeMs)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Post-Race Broadcast Commentary */}
          <div
            data-testid="postrace-commentary"
            className="mb-3.5 rounded-xl bg-slate-900/90 border border-cyan-500/30 px-3 py-2.5"
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
                {postCommentary.caster}
              </span>
              {weatherHadRain && (
                <span className="text-[9px] font-black uppercase tracking-wider text-sky-300">
                  Wet-Patch Race
                </span>
              )}
            </div>
            <div className="text-xs font-black text-amber-300 mb-0.5">{postCommentary.headline}</div>
            {postCommentary.lines.map((line, idx) => (
              <p key={idx} className="text-xs text-slate-200 leading-relaxed">
                {line}
              </p>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              data-testid="view-classification-btn"
              onClick={onViewClassification}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 font-bold uppercase text-xs cursor-pointer"
            >
              Race Classification
            </button>
            <button
              type="button"
              data-start="true"
              onClick={onPlayAgain}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-red-600 to-amber-500 hover:brightness-110 text-white font-black uppercase tracking-wider text-xs cursor-pointer shadow-lg"
            >
              {isLan ? 'Return to Lobby' : careerOutcome ? 'Next GP Round' : 'Race Again'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface FinishModalProps {
  circuitId: CircuitId;
  bikeClass: BikeClassId;
  weatherHadRain: boolean;
  sessionType: SessionType;
  results: RaceResultEntry[];
  isLan: boolean;
  careerOutcome: CareerFinishOutcome | null;
  onPlayAgain: () => void;
  onExitTitle: () => void;
}

export const FinishModal: React.FC<FinishModalProps> = ({
  circuitId,
  bikeClass,
  weatherHadRain,
  sessionType,
  results,
  isLan,
  careerOutcome,
  onPlayAgain,
  onExitTitle,
}) => {
  const playerEntry = results.find((r) => r.isPlayer) ?? results[0];
  const won = playerEntry?.rank === 1;
  const isQualifying = sessionType === 'qualifying';

  const activeChamp = careerOutcome
    ? CAREER_CHAMPIONSHIPS[careerOutcome.updatedProgress.activeClass]
    : null;
  const activeSeasonPct =
    careerOutcome && activeChamp
      ? Math.min(100, Math.round((careerOutcome.updatedProgress.seasonPoints / activeChamp.pointsToAdvance) * 100))
      : 0;

  const postCommentary = buildPostRaceCommentary({
    circuitId,
    bikeClass,
    sessionType,
    results,
    weatherHadRain,
    careerOutcome: careerOutcome
      ? {
          pointsEarned: careerOutcome.pointsEarned,
          seasonRank: careerOutcome.seasonRank,
          promotedTo: careerOutcome.promotedTo,
          wonChampionship: careerOutcome.wonChampionship,
        }
      : null,
  });

  return (
    <div
      className="fixed inset-0 z-30 bg-black/75 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={isQualifying ? 'Qualifying Classification' : 'Race Classification'}
    >
      <div className="w-full max-w-xl bg-[#0d131f] border border-white/15 rounded-2xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col">
        <div className="moto-stripe-bar shrink-0" />
        <div className="p-5 sm:p-6 overflow-y-auto">
          <div className="text-center mb-4">
            <div className="text-xs font-bold uppercase tracking-widest text-amber-400">
              {isQualifying ? 'Qualifying Complete' : 'Checkered Flag'}
            </div>
            <h2 className="text-3xl font-black italic uppercase text-white mt-0.5 font-display">
              {isQualifying
                ? won
                  ? 'Pole Position! P1'
                  : `Qualified P${playerEntry?.rank ?? 1}`
                : won
                ? 'Grand Prix Victory!'
                : `Finished P${playerEntry?.rank ?? 1}`}
            </h2>
          </div>

          {/* Post-Race Broadcast Commentary Booth */}
          <div
            data-testid="finish-commentary"
            className="mb-4 rounded-xl bg-slate-900/90 border border-cyan-500/35 px-3.5 py-2.5"
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
                {postCommentary.caster}
              </span>
              {weatherHadRain && (
                <span className="text-[9px] font-black uppercase tracking-wider text-sky-300">
                  Dynamic Rain Patches
                </span>
              )}
            </div>
            <div className="text-xs font-black text-amber-300 mb-0.5">{postCommentary.headline}</div>
            {postCommentary.lines.map((line, idx) => (
              <p key={idx} className="text-xs text-slate-200 leading-relaxed">
                {line}
              </p>
            ))}
          </div>

          {/* Career Championship Update Banner */}
          {careerOutcome && (
            <div className="mb-4 p-3.5 rounded-xl bg-slate-900 border border-slate-700">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                  {BIKE_CLASSES[careerOutcome.classPlayed].label} Standing: P{careerOutcome.seasonRank}/22
                </span>
                <span className="text-sm font-black text-emerald-400 tabular-nums">
                  +{careerOutcome.pointsEarned} PTS
                </span>
              </div>

              {careerOutcome.promotedTo ? (
                <div className="mt-2 px-3 py-2 rounded-lg bg-amber-500/20 border border-amber-400 text-amber-200 text-xs font-black uppercase tracking-wide text-center">
                  Top 3 Season Finish (P{careerOutcome.seasonRank}/22)! Promoted to{' '}
                  {BIKE_CLASSES[careerOutcome.promotedTo].label}!
                </div>
              ) : careerOutcome.wonChampionship ? (
                <div className="mt-2 px-3 py-2 rounded-lg bg-emerald-500/20 border border-emerald-400 text-emerald-200 text-xs font-black uppercase tracking-wide text-center">
                  MotoGP World Champion! Title Won!
                </div>
              ) : careerOutcome.seasonFinished ? (
                <div className="mt-1 text-xs text-slate-300">
                  Season complete (P{careerOutcome.seasonRank}/22) — finish Top 1–3 next season to earn promotion!
                </div>
              ) : (
                activeChamp && (
                  <div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-1">
                      <div
                        className="h-full bg-gradient-to-r from-amber-400 to-red-500 transition-all"
                        style={{ width: `${activeSeasonPct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>
                        Next: {activeChamp.rounds[careerOutcome.updatedProgress.currentRoundIndex]?.grandPrixName}
                      </span>
                      <span className="tabular-nums font-semibold text-slate-200">
                        {careerOutcome.updatedProgress.seasonPoints} pts · Top 3 Promote
                      </span>
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {/* Summary Metric Tiles */}
          {playerEntry && (
            <div className="grid grid-cols-3 gap-2.5 mb-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-center">
                <div className="text-[10px] font-bold uppercase text-slate-400">
                  {isQualifying ? 'Quali Time' : 'Race Time'}
                </div>
                <div className="text-base font-black text-white tabular-nums font-mono">
                  {formatRaceTime(playerEntry.finishTimeMs)}
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-center">
                <div className="text-[10px] font-bold uppercase text-slate-400">
                  {isQualifying ? 'Grid Slot' : 'Best Lap'}
                </div>
                <div className="text-base font-black text-amber-400 tabular-nums font-mono">
                  {isQualifying
                    ? `P${playerEntry.rank}/${results.length}`
                    : playerEntry.bestLapMs
                    ? formatRaceTime(playerEntry.bestLapMs)
                    : '--:--.-'}
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-center">
                <div className="text-[10px] font-bold uppercase text-slate-400">Top Speed</div>
                <div className="text-base font-black text-cyan-400 tabular-nums font-mono">
                  {playerEntry.topSpeedKmh} KM/H
                </div>
              </div>
            </div>
          )}

          {/* Classification Table with Mini Faces & National Flags */}
          <div className="space-y-1.5 mb-5 max-h-52 overflow-y-auto pr-0.5">
            {results.map((r) => (
              <div
                key={r.id}
                className={`flex items-center justify-between px-3 py-1.5 rounded-xl border text-sm ${
                  r.isPlayer
                    ? 'bg-gradient-to-r from-red-950/75 to-amber-950/35 border-red-400/75 text-white'
                    : 'bg-slate-900/75 border-slate-800 text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-7 font-black italic text-amber-400 tabular-nums font-display">
                    P{r.rank}
                  </span>
                  <RiderMiniFace livery={r.livery} size="xs" />
                  <NationalFlag code={r.livery.nationality} size="xs" />
                  <span className="font-bold truncate">
                    {r.name}
                    {r.isAi && <span className="text-[10px] text-slate-500 ml-1.5 font-normal">AI</span>}
                  </span>
                </div>
                <span className="font-mono text-xs tabular-nums text-slate-300 shrink-0 ml-2">
                  {formatRaceTime(r.finishTimeMs)}
                </span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              data-start="true"
              onClick={onPlayAgain}
              className="py-3 rounded-xl bg-gradient-to-r from-red-600 to-amber-500 hover:brightness-110 text-white font-black uppercase tracking-wider text-sm cursor-pointer shadow-lg"
            >
              {isLan
                ? 'Return to Lobby'
                : isQualifying
                ? `Start Race (P${playerEntry?.rank ?? 1})`
                : careerOutcome
                ? 'Next GP Round'
                : 'Race Again'}
            </button>
            <button
              type="button"
              onClick={onExitTitle}
              className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold uppercase text-sm cursor-pointer"
            >
              {isQualifying ? 'Career Paddock' : 'Main Menu'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
