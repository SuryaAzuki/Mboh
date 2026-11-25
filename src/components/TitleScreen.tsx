import React, { useState } from 'react';
import {
  CAREER_CHAMPIONSHIPS,
  getActiveCareerRound,
  type CareerProgress,
} from '../game/career';
import {
  BIKE_CLASSES,
  TEAM_LIVERIES,
  type BikeClassId,
  type TeamLivery,
} from '../game/types';

export type MainMenuTab = 'career' | 'quick';

interface TitleScreenProps {
  activeTab: MainMenuTab;
  onChangeTab: (tab: MainMenuTab) => void;
  career: CareerProgress;
  selectedLivery: TeamLivery;
  quickClass: BikeClassId;
  quickLaps: number;
  onSelectLivery: (livery: TeamLivery) => void;
  onSelectQuickClass: (bikeClass: BikeClassId) => void;
  onSelectQuickLaps: (laps: number) => void;
  onStartCareerRace: () => void;
  onStartQuickRace: () => void;
  onResetCareer: () => void;
  onOpenLan: () => void;
  onOpenAndroid: () => void;
}

const CLASS_ORDER: BikeClassId[] = ['moto3', 'moto2', 'motogp'];

export const TitleScreen: React.FC<TitleScreenProps> = ({
  activeTab,
  onChangeTab,
  career,
  selectedLivery,
  quickClass,
  quickLaps,
  onSelectLivery,
  onSelectQuickClass,
  onSelectQuickLaps,
  onStartCareerRace,
  onStartQuickRace,
  onResetCareer,
  onOpenLan,
  onOpenAndroid,
}) => {
  const [confirmReset, setConfirmReset] = useState(false);

  const careerChamp = CAREER_CHAMPIONSHIPS[career.activeClass];
  const careerRound = getActiveCareerRound(career);
  const careerClassSpec = BIKE_CLASSES[career.activeClass];
  const quickClassSpec = BIKE_CLASSES[quickClass];
  const progressPct = Math.min(100, Math.round((career.seasonPoints / careerChamp.pointsToAdvance) * 100));

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-3 sm:p-6 md:p-8">
      <div className="pointer-events-auto w-full max-w-[390px] [@media(max-height:520px)]:max-w-[610px] max-h-[calc(100vh-1.5rem)] overflow-y-auto my-auto bg-[#090d14]/88 border border-white/12 rounded-2xl p-4 sm:p-5 [@media(max-height:520px)]:p-3.5 shadow-2xl">
        {/* Clean Minimal Brand Header */}
        <div className="flex items-center justify-between gap-2 mb-3 [@media(max-height:520px)]:mb-2">
          <div className="flex items-center gap-2.5">
            <div
              className="w-2.5 h-8 rounded-xs"
              style={{ backgroundColor: selectedLivery.primaryHex }}
            />
            <div>
              <h1 className="text-2xl font-black italic tracking-tight text-white leading-none">
                APEX GP
              </h1>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 mt-1">
                10-Rider World Circuit
              </p>
            </div>
          </div>

          <span
            className="px-2.5 py-1 rounded text-[11px] font-black uppercase tracking-wider text-white"
            style={{
              backgroundColor:
                activeTab === 'career' ? careerClassSpec.badgeColor : quickClassSpec.badgeColor,
            }}
          >
            {activeTab === 'career' ? careerClassSpec.label : quickClassSpec.label}
          </span>
        </div>

        <div className="[@media(max-height:520px)]:grid [@media(max-height:520px)]:grid-cols-2 [@media(max-height:520px)]:gap-3 [@media(max-height:520px)]:items-start">
          <div>
            {/* Simple Mode Switcher */}
            <div
              className="grid grid-cols-2 gap-1 bg-slate-900/80 p-1 rounded-xl border border-white/10 mb-3"
              role="tablist"
              aria-label="Game Mode"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'career'}
                onClick={() => onChangeTab('career')}
                className={`py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-colors cursor-pointer ${
                  activeTab === 'career' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Career
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'quick'}
                onClick={() => onChangeTab('quick')}
                className={`py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-colors cursor-pointer ${
                  activeTab === 'quick' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Quick Race
              </button>
            </div>

            {activeTab === 'career' ? (
              <div className="space-y-2.5 mb-3.5 [@media(max-height:520px)]:mb-0">
                {/* Clean Moto3 -> Moto2 -> MotoGP Ladder */}
                <div className="grid grid-cols-3 gap-1.5">
                  {CLASS_ORDER.map((cid) => {
                    const spec = BIKE_CLASSES[cid];
                    const isUnlocked = career.unlockedClasses.includes(cid);
                    const isActive = career.activeClass === cid;
                    const isWon = career.championshipsWon.includes(cid);
                    return (
                      <div
                        key={cid}
                        className={`rounded-lg px-2 py-1.5 border text-center ${
                          isActive
                            ? 'bg-slate-800/90 border-amber-400 text-white'
                            : isUnlocked
                            ? 'bg-slate-900/70 border-white/10 text-slate-300'
                            : 'bg-slate-950/60 border-white/5 text-slate-500'
                        }`}
                      >
                        <div className="text-[11px] font-black uppercase flex items-center justify-center gap-1">
                          <span>{spec.label}</span>
                          {isWon && <span className="text-amber-400">★</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Round Summary */}
                <div className="bg-slate-900/70 border border-white/10 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                        Round {careerRound.roundNumber}/{careerChamp.rounds.length}
                      </div>
                      <div className="text-sm font-black text-white leading-tight mt-0.5">
                        {careerRound.grandPrixName}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {careerRound.laps} Laps · {careerClassSpec.displacement}
                      </div>
                    </div>
                    <div className="text-right tabular-nums">
                      <div className="text-[10px] font-bold uppercase text-slate-400">Pts</div>
                      <div className="text-base font-black text-white leading-none mt-0.5">
                        {career.seasonPoints}
                        <span className="text-xs text-slate-400 font-semibold">/{careerChamp.pointsToAdvance}</span>
                      </div>
                    </div>
                  </div>

                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-amber-400 transition-all duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>
                      Wins <strong className="text-slate-100">{career.wins}</strong> · Podiums{' '}
                      <strong className="text-slate-100">{career.podiums}</strong>
                    </span>
                    {!confirmReset ? (
                      <button
                        type="button"
                        onClick={() => setConfirmReset(true)}
                        className="text-slate-400 hover:text-red-400 underline cursor-pointer"
                      >
                        Reset
                      </button>
                    ) : (
                      <span className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onResetCareer();
                            setConfirmReset(false);
                          }}
                          className="text-red-400 font-bold cursor-pointer"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmReset(false)}
                          className="text-slate-400 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 mb-3.5 [@media(max-height:520px)]:mb-0">
                <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Select Engine Class">
                  {CLASS_ORDER.map((cid) => {
                    const spec = BIKE_CLASSES[cid];
                    const active = quickClass === cid;
                    return (
                      <button
                        key={cid}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => onSelectQuickClass(cid)}
                        className={`py-2 px-2 rounded-lg border text-center cursor-pointer transition-colors ${
                          active
                            ? 'bg-slate-800 border-white text-white'
                            : 'bg-slate-900/70 border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="text-xs font-black uppercase">{spec.label}</div>
                        <div className="text-[10px] opacity-80">{Math.round(spec.topSpeedMs * 3.6)} km/h</div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between bg-slate-900/70 border border-white/10 rounded-lg px-3 py-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Laps</span>
                  <div className="flex gap-1.5">
                    {[2, 3, 5].map((laps) => (
                      <button
                        key={laps}
                        type="button"
                        onClick={() => onSelectQuickLaps(laps)}
                        className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                          quickLaps === laps
                            ? 'bg-red-600 text-white'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {laps}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            {/* 10 Factory Rider Swatches */}
            <div className="mb-3.5 [@media(max-height:520px)]:mb-2.5">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                <span>Team</span>
                <span className="text-slate-100">
                  {selectedLivery.name} #{selectedLivery.number}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Select Factory Bike Livery">
                {TEAM_LIVERIES.map((liv) => {
                  const active = liv.id === selectedLivery.id;
                  return (
                    <button
                      key={liv.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-label={`${liv.name} number ${liv.number}`}
                      onClick={() => onSelectLivery(liv)}
                      className={`h-7 rounded-md border-2 transition-transform cursor-pointer flex items-center justify-center text-[11px] font-black tabular-nums ${
                        active
                          ? 'border-white scale-105 text-white shadow'
                          : 'border-white/20 text-white/90 opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: liv.primaryHex }}
                    >
                      {liv.number}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Clean Action Stack */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                data-start="true"
                onClick={(e) => {
                  e.currentTarget.blur();
                  if (activeTab === 'career') onStartCareerRace();
                  else onStartQuickRace();
                }}
                className="w-full py-3 [@media(max-height:520px)]:py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-black tracking-wider uppercase text-sm transition-colors cursor-pointer shadow-lg flex items-center justify-between"
              >
                <span>
                  {activeTab === 'career'
                    ? `Race Round ${careerRound.roundNumber}`
                    : `Start ${quickClassSpec.label} Race`}
                </span>
                <span className="text-[11px] font-semibold opacity-90">ENTER</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onOpenLan}
                  className="py-2 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-white/15 text-slate-100 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                >
                  LAN Lobby
                </button>
                <button
                  type="button"
                  onClick={onOpenAndroid}
                  className="py-2 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-emerald-500/50 text-emerald-300 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Android APK
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Single flat bottom control line */}
      <div className="text-center md:text-left [@media(max-height:520px)]:hidden">
        <p className="inline-block text-xs font-medium text-slate-100 hud-stroke tracking-wide">
          WASD / Arrows Drive · Shift KERS · C Camera · M Audio · Esc Pause
        </p>
      </div>
    </div>
  );
};
