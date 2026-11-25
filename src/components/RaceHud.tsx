import React, { useMemo } from 'react';
import { getCircuit } from '../game/trackMath';
import { type CameraMode, type HudSnapshot } from '../game/types';

interface RaceHudProps {
  hud: HudSnapshot;
  muted: boolean;
  bgmEnabled: boolean;
  cameraMode: CameraMode;
  touchEnabled: boolean;
  onToggleMute: () => void;
  onToggleBgm: () => void;
  onCycleCamera: () => void;
  onToggleTouch: () => void;
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
  muted,
  bgmEnabled,
  cameraMode,
  touchEnabled,
  onToggleMute,
  onToggleBgm,
  onCycleCamera,
  onToggleTouch,
  onPause,
}) => {
  const minimapData = useMemo(() => {
    const circuit = getCircuit();
    const { minX, maxX, minZ, maxZ } = circuit.bounds;
    const pad = 28;
    const w = maxX - minX + pad * 2;
    const h = maxZ - minZ + pad * 2;
    const scale = 86 / Math.max(w, h);
    const offsetX = (92 - (maxX - minX) * scale) * 0.5 - minX * scale;
    const offsetY = (92 - (maxZ - minZ) * scale) * 0.5 - minZ * scale;

    const pathPoints: string[] = [];
    for (let i = 0; i < circuit.samples.length; i += 8) {
      const s = circuit.samples[i];
      const px = (s.x * scale + offsetX).toFixed(1);
      const py = (s.z * scale + offsetY).toFixed(1);
      pathPoints.push(`${i === 0 ? 'M' : 'L'}${px},${py}`);
    }
    pathPoints.push('Z');

    return {
      pathD: pathPoints.join(' '),
      scale,
      offsetX,
      offsetY,
    };
  }, []);

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 sm:p-5">
      {/* Top Row: Minimal Position/Lap/Time Pill + Compact Utility Buttons & Minimap */}
      <div className="flex items-start justify-between gap-3">
        {/* Minimalist Top-Left Telemetry */}
        <div className="bg-[#090d14]/65 border border-white/12 rounded-lg px-3.5 py-2 flex items-center gap-3.5 shadow-md">
          <div className="text-xl sm:text-2xl font-black italic text-white tabular-nums leading-none">
            P{hud.rank}
            <span className="text-xs font-bold text-slate-400 not-italic">/{hud.totalRiders}</span>
          </div>

          <div className="h-5 w-px bg-white/15" />

          <div className="text-xl sm:text-2xl font-black italic text-white tabular-nums leading-none">
            <span className="text-[10px] font-bold uppercase not-italic text-slate-400 mr-1">LAP</span>
            {hud.lap}
            <span className="text-xs font-bold text-slate-400 not-italic">/{hud.totalLaps}</span>
          </div>

          <div className="h-5 w-px bg-white/15" />

          <div className="text-sm sm:text-base font-extrabold text-amber-400 tabular-nums leading-none">
            {formatRaceTime(hud.currentLapMs)}
          </div>
        </div>

        {/* Minimalist Top-Right Controls & Small Minimap */}
        <div className="flex flex-col items-end gap-2">
          <div className="pointer-events-auto flex items-center gap-1.5">
            <button
              type="button"
              tabIndex={-1}
              aria-label={bgmEnabled ? 'Mute BGM' : 'Unmute BGM'}
              title={bgmEnabled ? 'BGM On' : 'BGM Off'}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleBgm();
              }}
              className={`w-9 h-9 rounded-lg border flex items-center justify-center cursor-pointer ${
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
              className="w-9 h-9 rounded-lg bg-[#090d14]/68 hover:bg-slate-800 border border-white/15 text-slate-100 flex items-center justify-center cursor-pointer"
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
              className="h-9 px-2.5 rounded-lg bg-[#090d14]/68 hover:bg-slate-800 border border-white/15 text-slate-100 text-[11px] font-bold uppercase tracking-wider cursor-pointer"
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
              className={`w-9 h-9 rounded-lg border flex items-center justify-center cursor-pointer ${
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
              className="w-9 h-9 rounded-lg bg-[#090d14]/68 hover:bg-slate-800 border border-white/15 text-slate-100 flex items-center justify-center cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            </button>
          </div>

          <div className="hidden sm:block bg-[#090d14]/55 border border-white/10 rounded-lg p-1 shadow-md">
            <svg viewBox="0 0 92 92" className="w-20 h-20">
              <path
                d={minimapData.pathD}
                fill="none"
                stroke="#64748b"
                strokeWidth="4.2"
                strokeLinejoin="round"
              />
              {hud.minimapRiders.map((r) => {
                const cx = r.x * minimapData.scale + minimapData.offsetX;
                const cy = r.z * minimapData.scale + minimapData.offsetY;
                return (
                  <circle
                    key={r.id}
                    cx={cx}
                    cy={cy}
                    r={r.isPlayer ? 3.8 : 2.4}
                    fill={r.color}
                    stroke="#ffffff"
                    strokeWidth={r.isPlayer ? 1.3 : 0.6}
                  />
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      {/* Transient Start Lights / Wrong Way */}
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

        {hud.wrongWay && (
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
