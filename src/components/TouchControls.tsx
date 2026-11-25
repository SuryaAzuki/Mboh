import React, { useRef } from 'react';
import type { RiderInput } from '../game/types';

interface TouchControlsProps {
  onChange: (partial: Partial<RiderInput>) => void;
}

export const TouchControls: React.FC<TouchControlsProps> = ({ onChange }) => {
  const leftHeld = useRef(false);
  const rightHeld = useRef(false);

  const updateSteer = () => {
    const steer = (rightHeld.current ? 1 : 0) - (leftHeld.current ? 1 : 0);
    onChange({ steer });
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 pointer-events-none flex items-end justify-between p-4 pb-6">
      {/* Left Thumb: Steer Left / Right */}
      <div className="pointer-events-auto flex items-center gap-3">
        <button
          type="button"
          aria-label="Steer Left"
          onPointerDown={(e) => {
            e.preventDefault();
            leftHeld.current = true;
            updateSteer();
          }}
          onPointerUp={() => {
            leftHeld.current = false;
            updateSteer();
          }}
          onPointerCancel={() => {
            leftHeld.current = false;
            updateSteer();
          }}
          onPointerLeave={() => {
            leftHeld.current = false;
            updateSteer();
          }}
          className="w-16 h-16 rounded-2xl bg-[#090d14]/80 active:bg-slate-700 border-2 border-slate-500/80 text-white font-black text-2xl flex items-center justify-center"
        >
          ◀
        </button>
        <button
          type="button"
          aria-label="Steer Right"
          onPointerDown={(e) => {
            e.preventDefault();
            rightHeld.current = true;
            updateSteer();
          }}
          onPointerUp={() => {
            rightHeld.current = false;
            updateSteer();
          }}
          onPointerCancel={() => {
            rightHeld.current = false;
            updateSteer();
          }}
          onPointerLeave={() => {
            rightHeld.current = false;
            updateSteer();
          }}
          className="w-16 h-16 rounded-2xl bg-[#090d14]/80 active:bg-slate-700 border-2 border-slate-500/80 text-white font-black text-2xl flex items-center justify-center"
        >
          ▶
        </button>
      </div>

      {/* Right Thumb: Brake, Boost, Throttle */}
      <div className="pointer-events-auto flex items-end gap-2.5">
        <button
          type="button"
          aria-label="Brake"
          onPointerDown={(e) => {
            e.preventDefault();
            onChange({ brake: 1 });
          }}
          onPointerUp={() => onChange({ brake: 0 })}
          onPointerCancel={() => onChange({ brake: 0 })}
          onPointerLeave={() => onChange({ brake: 0 })}
          className="w-14 h-14 rounded-2xl bg-red-950/85 active:bg-red-700 border-2 border-red-500 text-red-200 font-extrabold text-xs uppercase tracking-wider"
        >
          BRK
        </button>

        <button
          type="button"
          aria-label="KERS Boost"
          onPointerDown={(e) => {
            e.preventDefault();
            onChange({ boost: true });
          }}
          onPointerUp={() => onChange({ boost: false })}
          onPointerCancel={() => onChange({ boost: false })}
          onPointerLeave={() => onChange({ boost: false })}
          className="w-14 h-14 rounded-2xl bg-cyan-950/85 active:bg-cyan-700 border-2 border-cyan-400 text-cyan-200 font-extrabold text-xs uppercase tracking-wider"
        >
          KERS
        </button>

        <button
          type="button"
          aria-label="Throttle"
          onPointerDown={(e) => {
            e.preventDefault();
            onChange({ throttle: 1 });
          }}
          onPointerUp={() => onChange({ throttle: 0 })}
          onPointerCancel={() => onChange({ throttle: 0 })}
          onPointerLeave={() => onChange({ throttle: 0 })}
          className="w-16 h-20 rounded-2xl bg-emerald-900/85 active:bg-emerald-600 border-2 border-emerald-400 text-white font-black text-xs uppercase tracking-wider"
        >
          GAS
        </button>
      </div>
    </div>
  );
};
