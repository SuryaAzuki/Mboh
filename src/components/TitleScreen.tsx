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
      <div className="pointer-events-auto my-auto w-full max-w-[270px]">
        {/* Clean Brand Wordmark */}
        <div className="flex items-center gap-3 mb-7 [@media(max-height:520px)]:mb-4">
          <svg
            width="34"
            height="28"
            viewBox="0 0 28 24"
            fill="none"
            aria-hidden="true"
            className="shrink-0"
          >
            <path d="M4 20L14 3L24 20H18.5L14 11.8L9.5 20H4Z" fill={accentHex} />
            <path d="M11.5 20L14 15.2L16.5 20H11.5Z" fill="#f8fafc" />
          </svg>
          <div>
            <h1 className="text-3xl sm:text-4xl font-black italic tracking-tight text-white leading-none hud-stroke">
              APEX GP
            </h1>
            <p className="text-xs font-semibold tracking-wider text-slate-200 hud-stroke mt-1">
              Moto3 · Moto2 · MotoGP
            </p>
          </div>
        </div>

        {/* Classic 4-Item Main Menu */}
        <nav aria-label="Main Menu" className="flex flex-col gap-2.5 [@media(max-height:520px)]:gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onQuickRace();
            }}
            className="group w-full text-left px-5 py-3.5 [@media(max-height:520px)]:py-2.5 rounded-lg bg-red-600/95 hover:bg-red-500 active:bg-red-700 border-l-4 border-white text-white font-black italic uppercase tracking-wider text-base sm:text-lg shadow-xl transition-all cursor-pointer"
          >
            Quick Race
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onCareer();
            }}
            className="w-full text-left px-5 py-3.5 [@media(max-height:520px)]:py-2.5 rounded-lg bg-[#0b111c]/85 hover:bg-slate-800/95 border border-white/15 hover:border-white/40 text-white font-black italic uppercase tracking-wider text-base sm:text-lg shadow-lg transition-all cursor-pointer"
          >
            Career
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onMultiplayer();
            }}
            className="w-full text-left px-5 py-3.5 [@media(max-height:520px)]:py-2.5 rounded-lg bg-[#0b111c]/85 hover:bg-slate-800/95 border border-white/15 hover:border-white/40 text-white font-black italic uppercase tracking-wider text-base sm:text-lg shadow-lg transition-all cursor-pointer"
          >
            Multiplayer
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onSetting();
            }}
            className="w-full text-left px-5 py-3.5 [@media(max-height:520px)]:py-2.5 rounded-lg bg-[#0b111c]/85 hover:bg-slate-800/95 border border-white/15 hover:border-white/40 text-slate-200 hover:text-white font-black italic uppercase tracking-wider text-base sm:text-lg shadow-lg transition-all cursor-pointer"
          >
            Setting
          </button>
        </nav>
      </div>

      {/* Single flat bottom control line */}
      <div className="[@media(max-height:520px)]:hidden">
        <p className="inline-block text-xs font-medium text-slate-100 hud-stroke tracking-wide">
          WASD / Arrows Drive · Shift KERS · C Camera · M Audio · Esc Pause
        </p>
      </div>
    </div>
  );
};
