import React from 'react';

interface TitleScreenProps {
  accentHex: string;
  onQuickRace: () => void;
  onCareer: () => void;
  onMultiplayer: () => void;
  onSetting: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  accentHex,
  onQuickRace,
  onCareer,
  onMultiplayer,
  onSetting,
}) => {
  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-6 sm:p-10 [@media(max-height:520px)]:p-4">
      <div className="pointer-events-auto my-auto w-full max-w-[290px]">
        {/* Crisp MotoGP Championship Broadcast Wordmark */}
        <div className="mb-6 [@media(max-height:520px)]:mb-3.5">
          <div className="flex items-center gap-3">
            <svg
              width="38"
              height="32"
              viewBox="0 0 28 24"
              fill="none"
              aria-hidden="true"
              className="shrink-0 drop-shadow-md"
            >
              <path d="M2 20L13.5 2L22 20H16.5L13.5 11.2L8.5 20H2Z" fill={accentHex} />
              <path d="M10.5 20L13.5 14.2L16.5 20H10.5Z" fill="#facc15" />
              <path d="M21 20L24.5 9L27 20H21Z" fill="#38bdf8" />
            </svg>
            <div>
              <h1 className="text-3xl sm:text-4xl font-black italic tracking-tight text-white leading-none hud-stroke">
                APEX GP
              </h1>
              <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-amber-300 hud-stroke mt-1">
                Moto3 · Moto2 · MotoGP
              </p>
            </div>
          </div>
          <div className="moto-stripe-bar h-1 w-44 rounded-full mt-2.5 shadow-sm" />
        </div>

        {/* Vibrant Broadcast 4-Item Main Menu */}
        <nav aria-label="Main Menu" className="flex flex-col gap-2.5 [@media(max-height:520px)]:gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onQuickRace();
            }}
            className="group w-full flex items-center justify-between px-5 py-3.5 [@media(max-height:520px)]:py-2.5 rounded-xl bg-gradient-to-r from-[#e10600] to-[#f97316] hover:from-[#ef4444] hover:to-[#fb923c] active:brightness-95 border border-white/30 text-white font-black italic uppercase tracking-wider text-base sm:text-lg shadow-xl transition-all cursor-pointer"
          >
            <span>Quick Race</span>
            <span className="text-amber-200 text-sm group-hover:translate-x-1 transition-transform">▸</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onCareer();
            }}
            className="group w-full flex items-center justify-between px-5 py-3.5 [@media(max-height:520px)]:py-2.5 rounded-xl bg-gradient-to-r from-[#0f172a]/92 via-[#1e293b]/92 to-[#b45309]/85 hover:from-[#1e293b] hover:to-[#d97706] border border-amber-400/50 hover:border-amber-300 text-white font-black italic uppercase tracking-wider text-base sm:text-lg shadow-lg transition-all cursor-pointer"
          >
            <span>Career</span>
            <span className="text-amber-300 text-sm group-hover:translate-x-1 transition-transform">▸</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onMultiplayer();
            }}
            className="group w-full flex items-center justify-between px-5 py-3.5 [@media(max-height:520px)]:py-2.5 rounded-xl bg-gradient-to-r from-[#0f172a]/92 via-[#172554]/90 to-[#0284c7]/80 hover:from-[#1e3a8a] hover:to-[#0ea5e9] border border-cyan-400/45 hover:border-cyan-300 text-white font-black italic uppercase tracking-wider text-base sm:text-lg shadow-lg transition-all cursor-pointer"
          >
            <span>Multiplayer</span>
            <span className="text-cyan-300 text-sm group-hover:translate-x-1 transition-transform">▸</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onSetting();
            }}
            className="group w-full flex items-center justify-between px-5 py-3.5 [@media(max-height:520px)]:py-2.5 rounded-xl bg-gradient-to-r from-[#0f172a]/90 to-[#1e293b]/90 hover:from-[#1e293b] hover:to-[#334155] border border-emerald-400/40 hover:border-emerald-300 text-slate-100 hover:text-white font-black italic uppercase tracking-wider text-base sm:text-lg shadow-lg transition-all cursor-pointer"
          >
            <span>Setting</span>
            <span className="text-emerald-300 text-sm group-hover:translate-x-1 transition-transform">▸</span>
          </button>
        </nav>
      </div>

      {/* Single flat bottom control line */}
      <div className="[@media(max-height:520px)]:hidden">
        <p className="inline-block text-xs font-semibold text-slate-100 hud-stroke tracking-wide">
          WASD / Arrows Drive · Shift KERS · C Camera · M Audio · Esc Pause
        </p>
      </div>
    </div>
  );
};
