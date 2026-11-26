import React from 'react';
import {
  CAREER_CHAMPIONSHIPS,
  getActiveCareerRound,
  type CareerProgress,
} from '../game/career';
import {
  BIKE_CLASSES,
  TEAM_LIVERIES,
  type TeamLivery,
} from '../game/types';

import { formatRaceTime } from './RaceHud';

interface CareerModalProps {
  career: CareerProgress;
  selectedLivery: TeamLivery;
  onSelectLivery: (livery: TeamLivery) => void;
  onStartQualifying: () => void;
  onStartNextRound: () => void;
  onResetCareer: () => void;
  onClose: () => void;
}

export const CareerModal: React.FC<CareerModalProps> = ({
  career,
  selectedLivery,
  onSelectLivery,
  onStartQualifying,
  onStartNextRound,
  onResetCareer,
  onClose,
}) => {
  const champ = CAREER_CHAMPIONSHIPS[career.activeClass];
  const activeRound = getActiveCareerRound(career);
  const classSpec = BIKE_CLASSES[career.activeClass];
  const progressPct = Math.min(100, Math.round((career.seasonPoints / champ.pointsToAdvance) * 100));

  return (
    <div
      className="fixed inset-0 z-30 bg-black/78 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="MotoGP Career Calendar"
    >
      <div className="w-full max-w-3xl bg-[#0b101b] border border-slate-700 rounded-2xl p-5 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
          <div>
            <div className="text-[11px] font-black uppercase tracking-widest text-amber-400">
              {classSpec.label} World Championship · 20-Round Calendar
            </div>
            <h2 className="text-xl sm:text-2xl font-black italic uppercase text-white mt-0.5">
              Career Paddock
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold uppercase cursor-pointer"
          >
            Back
          </button>
        </div>

        {/* Season Standing Bar + Active Rider Picker */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300">
                Round {activeRound.roundNumber} / {champ.rounds.length}
              </span>
              <span className="font-black text-amber-400 tabular-nums">
                {career.seasonPoints} / {champ.pointsToAdvance} pts
              </span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-amber-400 transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
              <span>
                Wins: <strong className="text-white">{career.wins}</strong> · Podiums:{' '}
                <strong className="text-white">{career.podiums}</strong>
              </span>
              <button
                type="button"
                onClick={onResetCareer}
                className="text-slate-400 hover:text-red-400 underline cursor-pointer"
              >
                Reset Season
              </button>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold uppercase tracking-wider text-slate-400">Your Rider (22 Grid)</span>
              <span className="font-bold text-white">
                #{selectedLivery.number} {selectedLivery.riderName}
              </span>
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-11 gap-1">
              {TEAM_LIVERIES.map((liv) => {
                const active = liv.id === selectedLivery.id;
                return (
                  <button
                    key={liv.id}
                    type="button"
                    onClick={() => onSelectLivery(liv)}
                    title={`${liv.riderName} (${liv.name})`}
                    className={`h-7 rounded border-2 text-[10px] font-black text-white cursor-pointer ${
                      active ? 'border-white scale-105' : 'border-white/20 opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: liv.primaryHex }}
                  >
                    #{liv.number}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Full 20-Round Official Calendar Grid */}
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Official Race Calendar ({champ.rounds.length} Rounds)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-64 overflow-y-auto pr-1">
            {champ.rounds.map((r, idx) => {
              const isCompleted = idx < career.currentRoundIndex;
              const isCurrent = idx === career.currentRoundIndex;
              return (
                <div
                  key={r.roundNumber}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs ${
                    isCurrent
                      ? 'bg-red-950/60 border-red-500 text-white'
                      : isCompleted
                      ? 'bg-slate-900/50 border-emerald-500/30 text-slate-400'
                      : 'bg-slate-900/75 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold text-amber-400">
                        R{r.roundNumber.toString().padStart(2, '0')} · {r.dateLabel}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] font-black uppercase text-red-300">Next</span>
                      )}
                      {isCompleted && (
                        <span className="text-[10px] font-bold uppercase text-emerald-400">Done</span>
                      )}
                    </div>
                    <div className="font-bold truncate">{r.grandPrixName}</div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {r.circuitName} · {r.country}
                    </div>
                  </div>
                  <div className="text-[11px] font-bold text-slate-300 shrink-0 ml-2">
                    {r.laps} Laps
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Next Round Weekend Session Controls (Qualifying -> Race) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800">
          <div className="text-xs text-slate-300 space-y-0.5">
            <div>
              Round {activeRound.roundNumber}: <strong className="text-white">{activeRound.grandPrixName}</strong> ({activeRound.circuitName})
            </div>
            {career.qualifyingGridPos ? (
              <div className="text-[11px] font-bold text-emerald-400">
                Qualified P{career.qualifyingGridPos} / 22
                {career.qualifyingLapMs ? ` · ${formatRaceTime(career.qualifyingLapMs)}` : ''}
              </div>
            ) : (
              <div className="text-[11px] text-amber-300">
                Qualifying (1 Timed Lap) sets your 22-rider GP starting grid
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onStartQualifying}
              className={`px-4 py-2.5 rounded-xl font-black uppercase tracking-wider text-xs cursor-pointer border ${
                career.qualifyingGridPos
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-200'
                  : 'bg-amber-500 hover:bg-amber-400 border-amber-300 text-slate-950 shadow-lg'
              }`}
            >
              {career.qualifyingGridPos ? 'Re-Qualify' : 'Start Qualifying'}
            </button>

            <button
              type="button"
              onClick={onStartNextRound}
              className={`px-5 py-2.5 rounded-xl font-black uppercase tracking-wider text-xs sm:text-sm cursor-pointer shadow-lg ${
                career.qualifyingGridPos
                  ? 'bg-red-600 hover:bg-red-500 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600'
              }`}
            >
              {career.qualifyingGridPos ? `Start Race (P${career.qualifyingGridPos})` : 'Race (Start P22)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
