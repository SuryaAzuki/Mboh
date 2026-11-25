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
      {/* Left-side Paddock Menu Card (switches to compact 2-col on short mobile landscape so CTA fits without scrolling) */}
      <div className="pointer-events-auto w-full max-w-[430px] [@media(max-height:520px)]:max-w-[640px] max-h-[calc(100vh-1.5rem)] overflow-y-auto my-auto bg-[#090d14]/92 border border-slate-700/80 rounded-2xl p-4 sm:p-5 [@media(max-height:520px)]:p-3.5 shadow-2xl">
        {/* Bespoke Brand Header */}
        <div className="flex items-center justify-between gap-2 mb-3 [@media(max-height:520px)]:mb-2">
          <svg
            viewBox="0 0 320 68"
            className="w-48 sm:w-56 [@media(max-height:520px)]:w-44 h-auto"
            role="img"
            aria-label="APEX GP World Championship"
          >
            <polygon points="4,8 44,8 30,58 0,58" fill={selectedLivery.primaryHex} />
            <polygon points="36,8 52,8 38,58 22,58" fill="#f8fafc" />
            <text
              x="64"
              y="36"
              fill="#f8fafc"
              fontFamily="system-ui, -apple-system, sans-serif"
              fontWeight="900"
              fontStyle="italic"
              fontSize="31"
              letterSpacing="-1"
            >
              APEX GP
            </text>
            <text
              x="66"
              y="55"
              fill="#94a3b8"
              fontFamily="system-ui, -apple-system, sans-serif"
              fontWeight="700"
              fontSize="11"
              letterSpacing="2.8"
            >
              MOTO3 · MOTO2 · MOTOGP
            </text>
          </svg>

          <div className="text-right">
            <span
              className="inline-block px-2.5 py-1 rounded text-[11px] font-black uppercase tracking-wider text-white"
              style={{
                backgroundColor:
                  activeTab === 'career' ? careerClassSpec.badgeColor : quickClassSpec.badgeColor,
              }}
            >
              {activeTab === 'career' ? careerClassSpec.label : quickClassSpec.label}
            </span>
          </div>
        </div>

        <div className="[@media(max-height:520px)]:grid [@media(max-height:520px)]:grid-cols-2 [@media(max-height:520px)]:gap-3 [@media(max-height:520px)]:items-start">
          <div>
            {/* Mode Switcher */}
            <div
              className="grid grid-cols-2 gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800 mb-3"
              role="tablist"
              aria-label="Game Mode"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'career'}
                onClick={() => onChangeTab('career')}
                className={`py-2 [@media(max-height:520px)]:py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-colors cursor-pointer ${
                  activeTab === 'career'
                    ? 'bg-red-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Career Mode
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'quick'}
                onClick={() => onChangeTab('quick')}
                className={`py-2 [@media(max-height:520px)]:py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-colors cursor-pointer ${
                  activeTab === 'quick'
                    ? 'bg-red-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Quick Race
              </button>
            </div>

            {activeTab === 'career' ? (
              <div className="space-y-3 [@media(max-height:520px)]:space-y-2 mb-4 [@media(max-height:520px)]:mb-0">
                {/* Moto3 -> Moto2 -> MotoGP Progression Ladder */}
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
                            ? 'bg-slate-800 border-amber-400 text-white'
                            : isUnlocked
                            ? 'bg-slate-900/80 border-slate-700 text-slate-300'
                            : 'bg-slate-950/70 border-slate-800/80 text-slate-500'
                        }`}
                      >
                        <div className="text-[11px] font-black uppercase tracking-wide flex items-center justify-center gap-1">
                          <span>{spec.label}</span>
                          {isWon && <span className="text-amber-400">★</span>}
                        </div>
                        <div className="text-[10px] font-semibold opacity-80">
                          {isWon ? 'Champion' : isActive ? 'Active' : isUnlocked ? 'Unlocked' : 'Locked'}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Active GP Round Card */}
                <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                        {careerChamp.title} · Round {careerRound.roundNumber}/{careerChamp.rounds.length}
                      </div>
                      <div className="text-sm sm:text-base font-black text-white leading-tight mt-0.5">
                        {careerRound.grandPrixName}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {careerRound.country} · {careerRound.laps} Laps · {careerClassSpec.displacement}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold uppercase text-slate-400">Season Pts</div>
                      <div className="text-base sm:text-lg font-black text-white tabular-nums leading-none mt-0.5">
                        {career.seasonPoints}
                        <span className="text-xs text-slate-400 font-semibold">/{careerChamp.pointsToAdvance}</span>
                      </div>
                    </div>
                  </div>

                  {/* Promotion Progress Bar */}
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-amber-400 transition-all duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>
                      Wins <strong className="text-slate-100">{career.wins}</strong> · Podiums{' '}
                      <strong className="text-slate-100">{career.podiums}</strong> · Pts{' '}
                      <strong className="text-slate-100">{career.totalPoints}</strong>
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
              /* Quick Race Configuration */
              <div className="space-y-3 [@media(max-height:520px)]:space-y-2 mb-4 [@media(max-height:520px)]:mb-0">
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    <span>Engine Class</span>
                    <span className="text-slate-200">{quickClassSpec.displacement}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Select Engine Class">
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
                              ? 'bg-slate-800 border-white text-white shadow'
                              : 'bg-slate-900/80 border-slate-700/80 text-slate-400 hover:text-white'
                          }`}
                        >
                          <div className="text-xs font-black uppercase">{spec.label}</div>
                          <div className="text-[10px] font-semibold opacity-80">
                            {Math.round(spec.topSpeedMs * 3.6)} km/h
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Race Distance</span>
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
                        {laps} Laps
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            {/* Team Livery Selector (Shared across Career & Quick Race) */}
            <div className="mb-4 [@media(max-height:520px)]:mb-3">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                <span>Factory Team</span>
                <span className="text-slate-200">
                  {selectedLivery.name} #{selectedLivery.number}
                </span>
              </div>
              <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label="Select Factory Bike Livery">
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
                      className={`h-8 rounded-md border-2 transition-transform cursor-pointer flex items-center justify-center text-xs font-bold tabular-nums ${
                        active
                          ? 'border-white scale-105 text-white shadow-md'
                          : 'border-slate-700/80 text-slate-200 opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: liv.primaryHex }}
                    >
                      {liv.number}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Primary CTA + LAN & Android APK Actions */}
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                data-start="true"
                onClick={(e) => {
                  e.currentTarget.blur();
                  if (activeTab === 'career') onStartCareerRace();
                  else onStartQuickRace();
                }}
                className="w-full py-3.5 [@media(max-height:520px)]:py-2.5 px-5 rounded-xl bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-black tracking-wider uppercase text-sm transition-colors cursor-pointer shadow-lg flex items-center justify-between"
              >
                <span>
                  {activeTab === 'career'
                    ? `Start ${careerClassSpec.label} Round ${careerRound.roundNumber}`
                    : `Race ${quickClassSpec.label} (${quickLaps} Laps)`}
                </span>
                <span className="text-[11px] font-semibold opacity-90">ENTER</span>
              </button>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={onOpenLan}
                  className="py-2.5 [@media(max-height:520px)]:py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                >
                  LAN Lobby
                </button>
                <button
                  type="button"
                  onClick={onOpenAndroid}
                  className="py-2.5 [@media(max-height:520px)]:py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-emerald-500/60 text-emerald-300 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Android APK
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Single flat control-hint line in bottom safe margin (hidden on compact phone landscape) */}
      <div className="text-center md:text-left [@media(max-height:520px)]:hidden">
        <p className="inline-block text-xs md:text-sm font-medium text-slate-100 hud-stroke tracking-wide">
          W/↑ Throttle · S/↓ Brake · A/D Steer · Shift Boost · C Camera · Esc Pause
        </p>
      </div>
    </div>
  );
};
