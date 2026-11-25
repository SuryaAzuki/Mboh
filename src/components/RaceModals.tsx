import React from 'react';
import { CAREER_CHAMPIONSHIPS, type CareerProgress } from '../game/career';
import { BIKE_CLASSES, type BikeClassId, type RaceResultEntry } from '../game/types';
import { formatRaceTime } from './RaceHud';

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
      <div className="w-full max-w-sm bg-[#0d131f] border border-slate-700 rounded-xl p-6 shadow-2xl text-center">
        <h2 className="text-2xl font-black italic uppercase tracking-wide text-white mb-1">
          Race Paused
        </h2>
        <p className="text-xs text-slate-400 mb-5">Press Esc or P to resume</p>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full py-3 rounded-lg bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-wider text-sm cursor-pointer"
          >
            Resume Race
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 font-bold uppercase text-sm cursor-pointer"
          >
            Restart Grid
          </button>
          <button
            type="button"
            onClick={onExitTitle}
            className="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold uppercase text-sm cursor-pointer"
          >
            Exit to Paddock
          </button>
        </div>
      </div>
    </div>
  );
};

export interface CareerFinishOutcome {
  classPlayed: BikeClassId;
  pointsEarned: number;
  promotedTo: BikeClassId | null;
  seasonFinished: boolean;
  wonChampionship: boolean;
  updatedProgress: CareerProgress;
}

interface FinishModalProps {
  results: RaceResultEntry[];
  isLan: boolean;
  careerOutcome: CareerFinishOutcome | null;
  onPlayAgain: () => void;
  onExitTitle: () => void;
}

export const FinishModal: React.FC<FinishModalProps> = ({
  results,
  isLan,
  careerOutcome,
  onPlayAgain,
  onExitTitle,
}) => {
  const playerEntry = results.find((r) => r.isPlayer) ?? results[0];
  const won = playerEntry?.rank === 1;

  const activeChamp = careerOutcome
    ? CAREER_CHAMPIONSHIPS[careerOutcome.updatedProgress.activeClass]
    : null;
  const activeSeasonPct =
    careerOutcome && activeChamp
      ? Math.min(100, Math.round((careerOutcome.updatedProgress.seasonPoints / activeChamp.pointsToAdvance) * 100))
      : 0;

  return (
    <div
      className="fixed inset-0 z-30 bg-black/75 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Race Classification"
    >
      <div className="w-full max-w-lg bg-[#0d131f] border border-slate-700 rounded-xl p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="text-center mb-4">
          <div className="text-xs font-bold uppercase tracking-widest text-amber-400">
            Checkered Flag
          </div>
          <h2 className="text-3xl font-black italic uppercase text-white mt-0.5">
            {won ? 'Grand Prix Victory!' : `Finished P${playerEntry?.rank ?? 1}`}
          </h2>
        </div>

        {/* Career Championship Update Banner */}
        {careerOutcome && (
          <div className="mb-4 p-3.5 rounded-xl bg-slate-900 border border-slate-700">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                {BIKE_CLASSES[careerOutcome.classPlayed].label} Career Points
              </span>
              <span className="text-sm font-black text-emerald-400 tabular-nums">
                +{careerOutcome.pointsEarned} PTS
              </span>
            </div>

            {careerOutcome.promotedTo ? (
              <div className="mt-2 px-3 py-2 rounded-lg bg-amber-500/20 border border-amber-400 text-amber-200 text-xs font-black uppercase tracking-wide text-center">
                Championship Won! Contract Signed: Promoted to {BIKE_CLASSES[careerOutcome.promotedTo].label}!
              </div>
            ) : careerOutcome.wonChampionship ? (
              <div className="mt-2 px-3 py-2 rounded-lg bg-emerald-500/20 border border-emerald-400 text-emerald-200 text-xs font-black uppercase tracking-wide text-center">
                MotoGP World Champion! Title Defended!
              </div>
            ) : careerOutcome.seasonFinished ? (
              <div className="mt-1 text-xs text-slate-300">
                Season complete — finish with more points next season to earn promotion!
              </div>
            ) : (
              activeChamp && (
                <div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-1">
                    <div
                      className="h-full bg-amber-400 transition-all"
                      style={{ width: `${activeSeasonPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>
                      Next: {activeChamp.rounds[careerOutcome.updatedProgress.currentRoundIndex]?.grandPrixName}
                    </span>
                    <span className="tabular-nums font-semibold text-slate-200">
                      {careerOutcome.updatedProgress.seasonPoints}/{activeChamp.pointsToAdvance} pts
                    </span>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {/* Summary Metric Tiles */}
        {playerEntry && (
          <div className="grid grid-cols-3 gap-2.5 mb-5">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-center">
              <div className="text-[10px] font-bold uppercase text-slate-400">Race Time</div>
              <div className="text-base font-black text-white tabular-nums">
                {formatRaceTime(playerEntry.finishTimeMs)}
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-center">
              <div className="text-[10px] font-bold uppercase text-slate-400">Best Lap</div>
              <div className="text-base font-black text-amber-400 tabular-nums">
                {playerEntry.bestLapMs ? formatRaceTime(playerEntry.bestLapMs) : '--:--.-'}
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-center">
              <div className="text-[10px] font-bold uppercase text-slate-400">Top Speed</div>
              <div className="text-base font-black text-cyan-400 tabular-nums">
                {playerEntry.topSpeedKmh} KM/H
              </div>
            </div>
          </div>
        )}

        {/* Classification Table */}
        <div className="space-y-1.5 mb-5 max-h-48 overflow-y-auto">
          {results.map((r) => (
            <div
              key={r.id}
              className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm ${
                r.isPlayer
                  ? 'bg-red-950/50 border-red-500/60 text-white'
                  : 'bg-slate-900/70 border-slate-800 text-slate-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="w-6 font-black italic text-amber-400 tabular-nums">
                  P{r.rank}
                </span>
                <span
                  className="w-3 h-3 rounded-xs"
                  style={{ backgroundColor: r.livery.primaryHex }}
                />
                <span className="font-bold">
                  {r.name}
                  {r.isAi && <span className="text-xs text-slate-500 ml-1.5">AI</span>}
                </span>
              </div>
              <span className="font-mono text-xs tabular-nums text-slate-300">
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
            className="py-3 rounded-lg bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-wider text-sm cursor-pointer"
          >
            {isLan
              ? 'Return to Lobby'
              : careerOutcome
              ? 'Next GP Round'
              : 'Race Again'}
          </button>
          <button
            type="button"
            onClick={onExitTitle}
            className="py-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold uppercase text-sm cursor-pointer"
          >
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
};
