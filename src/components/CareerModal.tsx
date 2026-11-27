import React, { useMemo, useState } from 'react';
import {
  CAREER_CHAMPIONSHIPS,
  getActiveCareerRound,
  getCareerSeasonStandings,
  type CareerProgress,
} from '../game/career';
import { BIKE_CLASSES, COUNTRY_NAMES, getClassLiveries, type TeamLivery } from '../game/types';
import { formatRaceTime } from './RaceHud';
import { NationalFlag, RiderMiniFace } from './RiderAvatarBadge';

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
  const [activeTab, setActiveTab] = useState<'calendar' | 'standings'>('calendar');
  const champ = CAREER_CHAMPIONSHIPS[career.activeClass];
  const activeRound = getActiveCareerRound(career);
  const classSpec = BIKE_CLASSES[career.activeClass];
  const classLiveries = getClassLiveries(career.activeClass);

  const standings = useMemo(
    () => getCareerSeasonStandings(career, selectedLivery.riderName, selectedLivery),
    [career, selectedLivery],
  );
  const playerStanding = standings.find((s) => s.isPlayer) ?? standings[0];
  const nextClassLabel =
    career.activeClass === 'moto3' ? 'Moto2' : career.activeClass === 'moto2' ? 'MotoGP' : null;
  const seasonProgressPct = Math.round((career.currentRoundIndex / champ.rounds.length) * 100);

  return (
    <div
      className="fixed inset-0 z-30 bg-black/78 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="MotoGP Career Calendar"
    >
      <div className="w-full max-w-3xl bg-gradient-to-b from-[#131b2e] to-[#0a0f1b] border border-amber-400/40 rounded-2xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col">
        <div className="moto-stripe-bar h-1.5 w-full shrink-0" />
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-700/70 pb-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <RiderMiniFace livery={selectedLivery} size="md" showFlag />
              <div className="min-w-0">
                <div className="text-[11px] font-black uppercase tracking-widest text-amber-400 truncate">
                  {classSpec.label} World Championship · 20-Round Calendar
                </div>
                <h2 className="text-xl sm:text-2xl font-black italic uppercase text-white mt-0.5 truncate">
                  Career Paddock · {selectedLivery.riderName} ({COUNTRY_NAMES[selectedLivery.nationality]})
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-xs font-bold uppercase cursor-pointer shrink-0"
            >
              Back
            </button>
          </div>

          {/* Last Season Promotion Banner */}
          {career.lastSeasonSummary && career.currentRoundIndex === 0 && (
            <div
              className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold ${
                career.lastSeasonSummary.promotedTo
                  ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200'
                  : 'bg-slate-900 border-slate-700 text-slate-200'
              }`}
            >
              {career.lastSeasonSummary.promotedTo ? (
                <>
                  Last Season ({BIKE_CLASSES[career.lastSeasonSummary.classId].label}): Finished{' '}
                  <strong className="text-amber-300">P{career.lastSeasonSummary.finalSeasonRank}/22</strong> — Top 3
                  Promotion Signed to{' '}
                  <strong className="text-white">{BIKE_CLASSES[career.lastSeasonSummary.promotedTo].label}</strong>!
                </>
              ) : (
                <>
                  Last Season ({BIKE_CLASSES[career.lastSeasonSummary.classId].label}): Finished{' '}
                  <strong className="text-amber-300">P{career.lastSeasonSummary.finalSeasonRank}/22</strong> (
                  {career.lastSeasonSummary.points} pts). Finish Top 3 to earn promotion.
                </>
              )}
            </div>
          )}

          {/* Season Standing Bar + Active Rider Picker */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-amber-500/30 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-cyan-300">
                  Round {activeRound.roundNumber} / {champ.rounds.length}
                </span>
                <span className="font-black text-amber-400 tabular-nums">
                  Standing P{playerStanding.rank}/22 · {career.seasonPoints} pts
                </span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-500 via-amber-400 to-cyan-400 transition-all"
                  style={{ width: `${seasonProgressPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                <span>
                  {nextClassLabel ? (
                    <>
                      Top <strong className="text-emerald-400">1–3</strong> promote to{' '}
                      <strong className="text-white">{nextClassLabel}</strong>
                    </>
                  ) : (
                    <>
                      Wins: <strong className="text-white">{career.wins}</strong> · Podiums:{' '}
                      <strong className="text-white">{career.podiums}</strong>
                    </>
                  )}
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

            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-700/80">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-bold uppercase tracking-wider text-amber-300">
                  {classSpec.label} Rider (22 Grid)
                </span>
                <span className="font-bold text-white flex items-center gap-1.5">
                  <NationalFlag code={selectedLivery.nationality} size="xs" />
                  <span>
                    #{selectedLivery.number} {selectedLivery.riderName}
                  </span>
                </span>
              </div>
              <div className="grid grid-cols-6 sm:grid-cols-11 gap-1">
                {classLiveries.map((liv) => {
                  const active = liv.id === selectedLivery.id;
                  return (
                    <button
                      key={liv.id}
                      type="button"
                      onClick={() => onSelectLivery(liv)}
                      title={`${liv.riderName} (${COUNTRY_NAMES[liv.nationality]})`}
                      className={`h-7 rounded border-2 text-[10px] font-black text-white cursor-pointer transition-transform ${
                        active ? 'border-amber-300 scale-105 shadow' : 'border-white/20 opacity-85 hover:opacity-100'
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

          {/* Tab Switcher: Calendar vs 22-Rider Season Standings */}
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex rounded-lg bg-slate-900 border border-slate-700 p-1 gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('calendar')}
                className={`px-3 py-1.5 rounded-md text-xs font-black uppercase tracking-wider cursor-pointer ${
                  activeTab === 'calendar'
                    ? 'bg-gradient-to-r from-red-600 to-orange-500 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Calendar ({champ.rounds.length} Rounds)
              </button>
              <button
                type="button"
                data-testid="career-standings-tab"
                onClick={() => setActiveTab('standings')}
                className={`px-3 py-1.5 rounded-md text-xs font-black uppercase tracking-wider cursor-pointer ${
                  activeTab === 'standings'
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Standings (22 Riders)
              </button>
            </div>
            {nextClassLabel && activeTab === 'standings' && (
              <span className="text-[11px] font-bold text-emerald-400">
                End-of-Season Top 1–3 → {nextClassLabel}
              </span>
            )}
          </div>

          {activeTab === 'calendar' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-64 overflow-y-auto pr-1">
              {champ.rounds.map((r, idx) => {
                const isCompleted = idx < career.currentRoundIndex;
                const isCurrent = idx === career.currentRoundIndex;
                return (
                  <div
                    key={r.roundNumber}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs ${
                      isCurrent
                        ? 'bg-gradient-to-r from-red-950/75 to-slate-900 border-amber-400 text-white'
                        : isCompleted
                        ? 'bg-slate-900/50 border-emerald-500/35 text-slate-400'
                        : 'bg-slate-900/75 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold text-amber-400">
                          R{r.roundNumber.toString().padStart(2, '0')} · {r.dateLabel}
                        </span>
                        {isCurrent && <span className="text-[10px] font-black uppercase text-red-300">Next</span>}
                        {isCompleted && <span className="text-[10px] font-bold uppercase text-emerald-400">Done</span>}
                      </div>
                      <div className="font-bold truncate">{r.grandPrixName}</div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {r.circuitName} · {r.country}
                      </div>
                    </div>
                    <div className="text-[11px] font-bold text-cyan-300 shrink-0 ml-2">{r.laps} Laps</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div data-testid="career-standings-table" className="space-y-1 max-h-64 overflow-y-auto pr-1">
              {standings.map((row) => (
                <React.Fragment key={row.id}>
                  <div
                    className={`flex items-center justify-between px-3 py-1.5 rounded-lg border text-xs ${
                      row.isPlayer
                        ? 'bg-red-950/55 border-amber-400 text-white'
                        : row.inPromotionZone
                        ? 'bg-emerald-950/35 border-emerald-500/40 text-slate-100'
                        : 'bg-slate-900/75 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-6 font-black italic tabular-nums ${
                          row.rank <= 3 ? 'text-amber-400' : 'text-slate-400'
                        }`}
                      >
                        P{row.rank}
                      </span>
                      <RiderMiniFace livery={row.livery} size="xs" />
                      <NationalFlag code={row.livery.nationality} size="xs" />
                      <span className="font-bold truncate">
                        {row.name}
                        {row.isPlayer && (
                          <span className="ml-1.5 text-[10px] font-black uppercase text-amber-300">YOU</span>
                        )}
                      </span>
                      <span className="hidden sm:inline text-[10px] text-slate-400 truncate">{row.livery.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {row.inPromotionZone && nextClassLabel && (
                        <span className="text-[9px] font-black uppercase text-emerald-300 tracking-wider">
                          PROMOTE
                        </span>
                      )}
                      <span className="font-black text-white tabular-nums w-12 text-right">{row.points} pts</span>
                    </div>
                  </div>
                  {row.rank === 3 && (
                    <div className="flex items-center gap-2 py-0.5 px-2">
                      <div className="h-px flex-1 bg-emerald-500/40" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">
                        {nextClassLabel ? `Top 1–3 Promotion Cutoff (${nextClassLabel})` : 'Championship Podium Cutoff'}
                      </span>
                      <div className="h-px flex-1 bg-emerald-500/40" />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          )}

          {/* Next Round Weekend Session Controls (Qualifying -> Race) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-700/70">
            <div className="text-xs text-slate-300 space-y-0.5">
              <div>
                Round {activeRound.roundNumber}: <strong className="text-white">{activeRound.grandPrixName}</strong> (
                {activeRound.circuitName})
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
                    : 'bg-amber-400 hover:bg-amber-300 border-amber-200 text-slate-950 shadow-lg'
                }`}
              >
                {career.qualifyingGridPos ? 'Re-Qualify' : 'Start Qualifying'}
              </button>

              <button
                type="button"
                onClick={onStartNextRound}
                className={`px-5 py-2.5 rounded-xl font-black uppercase tracking-wider text-xs sm:text-sm cursor-pointer shadow-lg ${
                  career.qualifyingGridPos
                    ? 'bg-gradient-to-r from-[#e10600] to-[#f97316] hover:from-[#ef4444] hover:to-[#fb923c] text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600'
                }`}
              >
                {career.qualifyingGridPos ? `Start Race (P${career.qualifyingGridPos})` : 'Race (Start P22)'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
