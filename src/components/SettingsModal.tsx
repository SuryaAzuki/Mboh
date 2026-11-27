import React from 'react';

interface SettingsModalProps {
  muted: boolean;
  bgmEnabled: boolean;
  steeringSensitivity: number;
  onToggleMute: () => void;
  onToggleBgm: () => void;
  onChangeSteeringSensitivity: (value: number) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  muted,
  bgmEnabled,
  steeringSensitivity,
  onToggleMute,
  onToggleBgm,
  onChangeSteeringSensitivity,
  onClose,
}) => {
  const sensPct = Math.round(steeringSensitivity * 100);

  return (
    <div
      className="fixed inset-0 z-30 bg-black/75 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Setting"
    >
      <div className="w-full max-w-sm bg-gradient-to-b from-[#131b2e] to-[#0b101b] border border-emerald-400/40 rounded-2xl overflow-hidden shadow-2xl">
        <div className="moto-stripe-bar h-1.5 w-full" />
        <div className="p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-700/70 pb-3">
            <h2 className="text-xl font-black italic uppercase tracking-wide text-white">Setting</h2>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 text-xs font-bold uppercase cursor-pointer"
            >
              Close
            </button>
          </div>

          {/* Sound */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-bold uppercase tracking-wider text-slate-100">Sound</span>
            <button
              type="button"
              data-testid="setting-sound-btn"
              onClick={onToggleMute}
              className={`min-w-[84px] py-2 px-4 rounded-lg border text-xs font-black uppercase tracking-wider cursor-pointer ${
                !muted
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-500 border-emerald-300 text-white shadow'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              {muted ? 'Off' : 'On'}
            </button>
          </div>

          {/* BGM */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-bold uppercase tracking-wider text-slate-100">BGM</span>
            <button
              type="button"
              data-testid="setting-bgm-btn"
              onClick={onToggleBgm}
              className={`min-w-[84px] py-2 px-4 rounded-lg border text-xs font-black uppercase tracking-wider cursor-pointer ${
                bgmEnabled
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 border-cyan-300 text-white shadow'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              {bgmEnabled ? 'On' : 'Off'}
            </button>
          </div>

          {/* Right and Left Sensitivity */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-sm">
              <label htmlFor="steer-sensitivity-slider" className="font-bold uppercase tracking-wider text-slate-100">
                Right and Left Sensitivity
              </label>
              <span data-testid="setting-sensitivity-value" className="font-black text-amber-400 tabular-nums">
                {sensPct}%
              </span>
            </div>
            <input
              id="steer-sensitivity-slider"
              data-testid="setting-sensitivity-slider"
              type="range"
              min={0.25}
              max={1.2}
              step={0.05}
              value={steeringSensitivity}
              onChange={(e) => onChangeSteeringSensitivity(Number(e.target.value))}
              className="w-full accent-amber-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <span>Smooth (25%)</span>
              <span>Default (60%)</span>
              <span>Sharp (120%)</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#e10600] to-[#f97316] hover:from-[#ef4444] hover:to-[#fb923c] text-white font-black text-xs uppercase tracking-wider cursor-pointer shadow-lg"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
