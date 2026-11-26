import React, { useMemo } from 'react';
import { buildMinimapGeometry, projectPointToMinimap } from '../game/trackMath';
import { type CameraMode, type CircuitId, type HudSnapshot } from '../game/types';

interface RaceHudProps {
  hud: HudSnapshot;
  circuitId: CircuitId;
  muted: boolean;
  bgmEnabled: boolean;
  cameraMode: CameraMode;
  touchEnabled: boolean;
  onToggleMute: () => void;
  onToggleBgm: () => void;
  onCycleCamera: () => void;
  onToggleTouch: () => void;
  onResetBike: () => void;
  onPause: () => void;
}

export function formatRaceTime(ms: number): string {
  const safe = Math.max(0, Math.round(ms));
  const mins = Math.floor(safe / 60000);
  const secs = Math.floor((safe % 60000) / 1000);
  const tenths = Math.floor((safe % 1000) / 100);
  return `${mins}:${secs.toString().padStart(2, '0')}.${tenths}`;
}

export const RaceHud: React.FC<RaceHudProps> = ({
  hud,
  circuitId,
  muted,
  bgmEnabled,
  cameraMode,
  touchEnabled,
  onToggleMute,
  onToggleBgm,
  onCycleCamera,
  onToggleTouch,
  onResetBike,
  onPause,
}) => {
  const minimapData = useMemo(() => buildMinimapGeometry(circuitId, 100, 12), [circuitId]);

  const orderedMinimapRiders = useMemo(() => {
    const ai: typeof hud.minimapRiders = [];
    const players: typeof hud.minimapRiders = [];
    for (const r of hud.minimapRiders) {
      if (r.isPlayer) players.push(r);
      else ai.push(r);
    }
    return [...ai, ...players];
  }, [hud.minimapRiders]);

  const mobileStandings = useMemo(() => {
    if (hud.leaderboard.length <= 5) return hud.leaderboard;
    const top = hud.leaderboard.slice(0, 4);
    if (top.some((r) => r.isPlayer)) {
      return hud.leaderboard.slice(0, 5);
    }
    const playerEntry = hud.leaderboard.find((r) => r.isPlayer);
    return playerEntry ? [...top, playerEntry] : hud.leaderboard.slice(0, 5);
  }, [hud.leaderboard]);

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-2.5 sm:p-5">
      {/* Top Row: Minimal Position/Lap/Time + Live Leaderboard & Utility Buttons + Minimap */}
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        {/* Left Column: Position/Lap/Time + Simple Live Leaderboard */}
        <div className="flex flex-col items-start gap-1.5 sm:gap-2 min-w-0">
          <div className="bg-[#090d14]/65 border border-white/12 rounded-lg px-2.5 py-1.5 sm:px-3.5 sm:py-2 flex items-center gap-2 sm:gap-3.5 shadow-md">
            {hud.sessionType === 'qualifying' ? (
              <div className="text-sm sm:text-xl font-black italic text-amber-400 uppercase tracking-wider leading-none">
                QUALI
              </div>
            ) : (
              <div className="text-base sm:text-2xl font-black italic text-white tabular-nums leading-none">
                P{hud.rank}
                <span className="hidden sm:inline text-xs font-bold text-slate-400 not-italic">/{hud.totalRiders}</span>
              </div>
            )}

            <div className="h-4 sm:h-5 w-px bg-white/15" />

            <div className="text-base sm:text-2xl font-black italic text-white tabular-nums leading-none">
              <span className="text-[9px] sm:text-[10px] font-bold uppercase not-italic text-slate-400 mr-0.5 sm:mr-1">L</span>
              {hud.lap}
              <span className="text-[10px] sm:text-xs font-bold text-slate-400 not-italic">/{hud.totalLaps}</span>
            </div>

            <div className="h-4 sm:h-5 w-px bg-white/15" />

            <div className="text-xs sm:text-base font-extrabold text-amber-400 tabular-nums leading-none">
              {formatRaceTime(hud.currentLapMs)}
            </div>
          </div>

          {hud.sessionType === 'race' && hud.leaderboard.length > 0 && (
            <div
              data-testid="live-leaderboard"
              className="bg-[#090d14]/58 border border-white/10 rounded-lg px-2 py-1 sm:py-1.5 shadow-md w-[144px] sm:w-[176px]"
            >
              {/* Full 10-rider standings on desktop */}
              <div className="hidden sm:flex flex-col gap-0.5">
                {hud.leaderboard.map((entry) => (
                  <div
                    key={entry.id}
                    className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[11px] leading-tight ${
                      entry.isPlayer
                        ? 'bg-red-600/35 text-white font-black'
                        : 'text-slate-200 font-semibold'
                    }`}
                  >
                    <span className="w-4 text-right tabular-nums text-slate-400 font-bold">{entry.rank}</span>
                    <span
                      className="w-1 h-3 rounded-xs shrink-0"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="truncate flex-1">{entry.name}</span>
                    {entry.crashed && (
                      <span className="text-[9px] font-black text-orange-400 uppercase">OUT</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Compact 5-row standings on phone so bottom-left touch steer pad stays open */}
              <div className="flex sm:hidden flex-col gap-0.5">
                {mobileStandings.map((entry) => (
                  <div
                    key={entry.id}
                    className={`flex items-center gap-1.5 px-1 py-0.5 rounded text-[10px] leading-tight ${
                      entry.isPlayer
                        ? 'bg-red-600/35 text-white font-black'
                        : 'text-slate-200 font-semibold'
                    }`}
                  >
                    <span className="w-3.5 text-right tabular-nums text-slate-400 font-bold">{entry.rank}</span>
                    <span
                      className="w-1 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="truncate flex-1">{entry.name}</span>
                    {entry.crashed && (
                      <span className="text-[8px] font-black text-orange-400 uppercase">OUT</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Minimalist Top-Right Controls & Small Minimap */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-1 sm:gap-1.5 max-w-[196px] sm:max-w-none">
            <button
              type="button"
              tabIndex={-1}
              data-testid="reset-bike-btn"
              aria-label="Reset bike position [R]"
              title="Reset Bike [R]"
              onClick={(e) => {
                e.currentTarget.blur();
                onResetBike();
              }}
              className="h-8 px-2 sm:h-9 sm:px-2.5 rounded-lg bg-[#090d14]/68 hover:bg-slate-800 border border-white/15 text-amber-300 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              <span className="hidden sm:inline">Reset</span>
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label={bgmEnabled ? 'Mute BGM' : 'Unmute BGM'}
              title={bgmEnabled ? 'BGM On' : 'BGM Off'}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleBgm();
              }}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg border flex items-center justify-center cursor-pointer ${
                bgmEnabled && !muted
                  ? 'bg-[#090d14]/68 border-white/15 text-amber-300 hover:bg-slate-800'
                  : 'bg-[#090d14]/68 border-white/10 text-slate-500 hover:bg-slate-800'
              }`}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label={muted ? 'Unmute audio [M]' : 'Mute audio [M]'}
              title="Audio [M]"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-[#090d14]/68 hover:bg-slate-800 border border-white/15 text-slate-100 flex items-center justify-center cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                {muted ? (
                  <path d="M22 9l-6 6M16 9l6 6" stroke="#ef4444" />
                ) : (
                  <path d="M15.5 8.5a5 5 0 010 7" />
                )}
              </svg>
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label={`Switch camera mode (${cameraMode}) [C]`}
              title={`Camera: ${cameraMode.toUpperCase()} [C]`}
              onClick={(e) => {
                e.currentTarget.blur();
                onCycleCamera();
              }}
              className="h-8 px-2 sm:h-9 sm:px-2.5 rounded-lg bg-[#090d14]/68 hover:bg-slate-800 border border-white/15 text-slate-100 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider cursor-pointer"
            >
              {cameraMode}
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label={touchEnabled ? 'Hide touch controls' : 'Show touch controls'}
              title="Touch Controls"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleTouch();
              }}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg border flex items-center justify-center cursor-pointer ${
                touchEnabled
                  ? 'bg-emerald-950/85 border-emerald-500 text-emerald-300'
                  : 'bg-[#090d14]/68 hover:bg-slate-800 border-white/15 text-slate-300'
              }`}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="6" y="2" width="12" height="20" rx="2" />
                <line x1="10" y1="18" x2="14" y2="18" />
              </svg>
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label="Pause race [P]"
              title="Pause [Esc / P]"
              onClick={(e) => {
                e.currentTarget.blur();
                onPause();
              }}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-[#090d14]/68 hover:bg-slate-800 border border-white/15 text-slate-100 flex items-center justify-center cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            </button>
          </div>

          <div
            data-testid="race-minimap"
            aria-label="Circuit mini map"
            className="bg-[#090d14]/75 border border-white/15 rounded-lg p-1.5 shadow-lg"
          >
            <svg viewBox={`0 0 ${minimapData.size} ${minimapData.size}`} className="w-20 h-20 sm:w-24 sm:h-24">
              {/* Outer dark casing for high contrast against sky/grandstands */}
              <path
                d={minimapData.pathD}
                fill="none"
                stroke="#0f172a"
                strokeWidth="7.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {/* Crisp track layout ribbon */}
              <path
                d={minimapData.pathD}
                fill="none"
                stroke="#cbd5e1"
                strokeWidth="3.6"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {/* Start/Finish line marker */}
              <line
                x1={minimapData.startLine.x1}
                y1={minimapData.startLine.y1}
                x2={minimapData.startLine.x2}
                y2={minimapData.startLine.y2}
                stroke="#ef4444"
                strokeWidth="3.4"
                strokeLinecap="round"
              />
              <line
                x1={minimapData.startLine.x1}
                y1={minimapData.startLine.y1}
                x2={minimapData.startLine.x2}
                y2={minimapData.startLine.y2}
                stroke="#ffffff"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              {/* Rider dots: AI underneath, player cleanly on top */}
              {orderedMinimapRiders.map((r) => {
                const pt = projectPointToMinimap(r.x, r.z, minimapData);
                if (r.isPlayer) {
                  return (
                    <g key={r.id} data-testid="minimap-player-dot">
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={6.4}
                        fill="none"
                        stroke="#facc15"
                        strokeOpacity="0.9"
                        strokeWidth="1.2"
                      />
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={4.1}
                        fill={r.color}
                        stroke="#ffffff"
                        strokeWidth="1.6"
                      />
                    </g>
                  );
                }
                return (
                  <circle
                    key={r.id}
                    cx={pt.x}
                    cy={pt.y}
                    r={2.2}
                    fill={r.color}
                    stroke="#090d14"
                    strokeWidth="0.7"
                  />
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      {/* Transient Start Lights / Crashed Alert / Wrong Way */}
      <div className="flex flex-col items-center justify-center -translate-y-14">
        {hud.countdownStage >= 0 && (
          <div className="bg-[#090d14]/82 border border-white/15 rounded-xl px-6 py-3 shadow-xl text-center">
            <div className="flex items-center gap-2.5 justify-center mb-1.5">
              {[0, 1, 2, 3, 4].map((idx) => {
                const isGo = hud.countdownStage === 0;
                const lit =
                  isGo ||
                  (hud.countdownStage === 3 && idx < 2) ||
                  (hud.countdownStage === 2 && idx < 4) ||
                  hud.countdownStage === 1;
                return (
                  <span
                    key={idx}
                    className="w-4 h-4 rounded-full border border-slate-600"
                    style={{
                      backgroundColor: isGo ? '#22c55e' : lit ? '#ef4444' : '#1e293b',
                    }}
                  />
                );
              })}
            </div>
            <div className="text-3xl font-black italic tracking-wider text-white hud-stroke tabular-nums">
              {hud.countdownStage === 0 ? 'GO!' : hud.countdownStage}
            </div>
          </div>
        )}

        {hud.crashed && (
          <div className="pointer-events-auto mt-2 bg-orange-950/90 border border-orange-400/75 rounded-lg px-4 py-2 text-center shadow-lg">
            <div className="text-sm font-black uppercase tracking-widest text-orange-300">
              CRASHED
            </div>
            <div className="mt-1 flex items-center justify-center gap-2.5 text-xs font-bold text-white tabular-nums">
              <span>Recovering in {hud.crashRecoverSec.toFixed(1)}s</span>
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onResetBike();
                }}
                className="px-2 py-0.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-black uppercase text-[10px] tracking-wider cursor-pointer"
              >
                Reset Now [R]
              </button>
            </div>
          </div>
        )}

        {hud.wrongWay && !hud.crashed && (
          <div className="mt-2 bg-red-900/85 border border-red-400 rounded-lg px-4 py-1.5 text-white font-black uppercase tracking-widest text-xs">
            Wrong Way
          </div>
        )}
      </div>

      {/* Minimalist Bottom Speed + Gear + Slim RPM & KERS Bars */}
      <div
        className={`flex ${
          touchEnabled ? 'items-end justify-start mb-20' : 'items-end justify-center sm:justify-end'
        }`}
      >
        <div
          className={`bg-[#090d14]/65 border border-white/12 shadow-lg ${
            touchEnabled ? 'rounded-lg px-3 py-1.5 min-w-[140px]' : 'rounded-xl px-4 py-2.5 min-w-[175px]'
          }`}
        >
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <span
                data-testid="hud-speed"
                className={`${
                  touchEnabled ? 'text-2xl' : 'text-3xl sm:text-4xl'
                } font-black italic text-white tabular-nums leading-none`}
              >
                {hud.speedKmh}
              </span>
              <span className="ml-1 text-[10px] font-bold uppercase text-slate-400">KM/H</span>
            </div>

            <div className="text-right font-black text-amber-400 tabular-nums leading-none">
              <span className="text-[10px] text-slate-400 mr-0.5">G</span>
              <span data-testid="hud-gear" className={touchEnabled ? 'text-lg' : 'text-xl'}>
                {hud.gear}
              </span>
            </div>
          </div>

          <div className="mt-1.5 h-1.5 bg-slate-800/90 rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-75"
              style={{
                width: `${Math.round(hud.rpmRatio * 100)}%`,
                backgroundColor: hud.rpmRatio > 0.85 ? '#ef4444' : hud.rpmRatio > 0.65 ? '#f59e0b' : '#38bdf8',
              }}
            />
          </div>

          <div className="mt-1 h-1 bg-slate-800/90 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-400 transition-all duration-75"
              style={{ width: `${hud.boostFuel}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
