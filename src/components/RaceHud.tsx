import React, { useMemo } from 'react';
import { getCircuit } from '../game/trackMath';
import { BIKE_CLASSES, type CameraMode, type HudSnapshot } from '../game/types';

interface RaceHudProps {
  hud: HudSnapshot;
  muted: boolean;
  cameraMode: CameraMode;
  touchEnabled: boolean;
  onToggleMute: () => void;
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
  cameraMode,
  touchEnabled,
  onToggleMute,
  onCycleCamera,
  onToggleTouch,
  onPause,
}) => {
  const minimapData = useMemo(() => {
    const circuit = getCircuit();
    const { minX, maxX, minZ, maxZ } = circuit.bounds;
    const pad = 26;
    const w = maxX - minX + pad * 2;
    const h = maxZ - minZ + pad * 2;
    const scale = 100 / Math.max(w, h);
    const offsetX = (108 - (maxX - minX) * scale) * 0.5 - minX * scale;
    const offsetY = (108 - (maxZ - minZ) * scale) * 0.5 - minZ * scale;

    const pathPoints: string[] = [];
    for (let i = 0; i < circuit.samples.length; i += 6) {
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

  const rpmSegments = 14;
  const activeRpmCount = Math.round(hud.rpmRatio * rpmSegments);
  const classSpec = BIKE_CLASSES[hud.bikeClass ?? 'motogp'];

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 md:p-6">
      {/* Top Row: Left Race Telemetry + Right Utility Buttons & Minimap */}
      <div className="flex items-start justify-between gap-4">
        {/* Top-Left Cluster */}
        <div className="bg-[#090d14]/82 border border-slate-700/70 rounded-lg px-4 py-2.5 shadow-lg flex items-center gap-4 md:gap-5">
          <div className="hidden sm:flex flex-col items-start">
            <span
              className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider text-white"
              style={{ backgroundColor: classSpec.badgeColor }}
            >
              {classSpec.label}
            </span>
            <span className="text-[10px] font-semibold text-slate-400 mt-1">
              {classSpec.displacement}
            </span>
          </div>

          <div className="hidden sm:block h-8 w-px bg-slate-700/80" />

          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">POS</div>
            <div className="text-2xl md:text-3xl font-black italic text-white tabular-nums leading-none">
              P{hud.rank}
              <span className="text-sm font-bold text-slate-400 not-italic">/{hud.totalRiders}</span>
            </div>
          </div>

          <div className="h-8 w-px bg-slate-700/80" />

          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">LAP</div>
            <div className="text-2xl md:text-3xl font-black italic text-white tabular-nums leading-none">
              {hud.lap}
              <span className="text-sm font-bold text-slate-400 not-italic">/{hud.totalLaps}</span>
            </div>
          </div>

          <div className="h-8 w-px bg-slate-700/80" />

          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">LAP TIME</div>
            <div className="text-lg md:text-xl font-extrabold text-amber-400 tabular-nums leading-tight">
              {formatRaceTime(hud.currentLapMs)}
            </div>
            <div className="text-[11px] font-semibold text-slate-400 tabular-nums">
              BEST {hud.bestLapMs !== null ? formatRaceTime(hud.bestLapMs) : '--:--.-'}
            </div>
          </div>
        </div>

        {/* Top-Right Cluster: Square Utility Buttons + Track Minimap */}
        <div className="flex flex-col items-end gap-2">
          <div className="pointer-events-auto flex items-center gap-1.5">
            <button
              type="button"
              tabIndex={-1}
              aria-label={muted ? 'Unmute audio [M]' : 'Mute audio [M]'}
              title="Mute [M]"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              className="w-10 h-10 rounded-lg bg-[#090d14]/85 hover:bg-slate-800 border border-slate-700 text-slate-100 flex items-center justify-center cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                {muted ? (
                  <path d="M22 9l-6 6M16 9l6 6" stroke="#ef4444" />
                ) : (
                  <path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" />
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
              className="h-10 px-2.5 rounded-lg bg-[#090d14]/85 hover:bg-slate-800 border border-slate-700 text-slate-100 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 7l-7 5 7 5V7z" />
                <rect x="1" y="5" width="15" height="14" rx="2" />
              </svg>
              <span>{cameraMode}</span>
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label={touchEnabled ? 'Hide touch controls' : 'Show touch controls'}
              title="Toggle Touch Controls"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleTouch();
              }}
              className={`w-10 h-10 rounded-lg border flex items-center justify-center cursor-pointer ${
                touchEnabled
                  ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300'
                  : 'bg-[#090d14]/85 hover:bg-slate-800 border-slate-700 text-slate-300'
              }`}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
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
              className="w-10 h-10 rounded-lg bg-[#090d14]/85 hover:bg-slate-800 border border-slate-700 text-slate-100 flex items-center justify-center cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            </button>
          </div>

          {/* Real Circuit Spline Minimap */}
          <div className="hidden sm:block bg-[#090d14]/80 border border-slate-700/70 rounded-lg p-1.5 shadow-lg">
            <svg viewBox="0 0 108 108" className="w-24 h-24">
              <path
                d={minimapData.pathD}
                fill="none"
                stroke="#475569"
                strokeWidth="5"
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
                    r={r.isPlayer ? 4.4 : 3.1}
                    fill={r.color}
                    stroke="#ffffff"
                    strokeWidth={r.isPlayer ? 1.5 : 0.8}
                  />
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      {/* Center Transient Start Lights / Wrong-Way Alert */}
      <div className="flex flex-col items-center justify-center -translate-y-16">
        {hud.countdownStage >= 0 && (
          <div className="bg-[#090d14]/90 border border-slate-600 rounded-xl px-8 py-4 shadow-2xl text-center">
            <div className="flex items-center gap-3 justify-center mb-2">
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
                    className="w-5 h-5 rounded-full border border-slate-600"
                    style={{
                      backgroundColor: isGo ? '#22c55e' : lit ? '#ef4444' : '#1e293b',
                    }}
                  />
                );
              })}
            </div>
            <div className="text-4xl font-black italic tracking-wider text-white hud-stroke tabular-nums">
              {hud.countdownStage === 0 ? 'GO!' : hud.countdownStage}
            </div>
          </div>
        )}

        {hud.wrongWay && (
          <div className="mt-2 bg-red-900/90 border border-red-400 rounded-lg px-5 py-2 text-white font-black uppercase tracking-widest text-sm">
            Wrong Way — Turn Around
          </div>
        )}
      </div>

      {/* Bottom / Side Speedometer: Above left touch buttons on mobile so bike & touch pads are 100% clear; bottom-right on desktop */}
      <div
        className={`flex ${
          touchEnabled ? 'items-end justify-start mb-20' : 'items-end justify-center sm:justify-end'
        }`}
      >
        <div
          className={`bg-[#090d14]/86 border border-slate-700/80 shadow-xl ${
            touchEnabled
              ? 'rounded-lg px-3.5 py-2 min-w-[165px]'
              : 'rounded-xl px-5 py-3 min-w-[210px]'
          }`}
        >
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <span
                data-testid="hud-speed"
                className={`${
                  touchEnabled ? 'text-2xl sm:text-3xl' : 'text-4xl md:text-5xl'
                } font-black italic text-white tabular-nums leading-none`}
              >
                {hud.speedKmh}
              </span>
              <span className="ml-1 text-[10px] font-bold uppercase text-slate-400">KM/H</span>
            </div>

            <div className="text-right">
              <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">GEAR</div>
              <div
                data-testid="hud-gear"
                className={`${
                  touchEnabled ? 'text-lg' : 'text-2xl'
                } font-black text-amber-400 tabular-nums leading-none`}
              >
                {hud.gear}
              </div>
            </div>
          </div>

          {/* Segmented RPM Tachometer */}
          <div className={`flex gap-1 ${touchEnabled ? 'mt-1' : 'mt-2.5'}`} aria-label="Engine RPM">
            {Array.from({ length: rpmSegments }).map((_, idx) => {
              const active = idx < activeRpmCount;
              const color =
                idx >= 11 ? '#ef4444' : idx >= 8 ? '#f59e0b' : '#38bdf8';
              return (
                <div
                  key={idx}
                  className={`${touchEnabled ? 'h-1' : 'h-2'} flex-1 rounded-xs`}
                  style={{ backgroundColor: active ? color : '#1e293b' }}
                />
              );
            })}
          </div>

          {/* KERS Slipstream Boost Bar */}
          <div className={`${touchEnabled ? 'mt-1' : 'mt-2'} flex items-center gap-2`}>
            <span className="text-[9px] font-bold uppercase tracking-wider text-cyan-400">KERS</span>
            <div className={`flex-1 ${touchEnabled ? 'h-1.5' : 'h-2'} bg-slate-800 rounded-full overflow-hidden`}>
              <div
                className="h-full bg-cyan-400 transition-all duration-75"
                style={{ width: `${hud.boostFuel}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
