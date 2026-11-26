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

interface SettingsModalProps {
  riderName: string;
  selectedLivery: TeamLivery;
  quickClass: BikeClassId;
  quickLaps: number;
  career: CareerProgress;
  muted: boolean;
  bgmEnabled: boolean;
  touchEnabled: boolean;
  onChangeRiderName: (name: string) => void;
  onSelectLivery: (livery: TeamLivery) => void;
  onSelectQuickClass: (bikeClass: BikeClassId) => void;
  onSelectQuickLaps: (laps: number) => void;
  onToggleMute: () => void;
  onToggleBgm: () => void;
  onToggleTouch: () => void;
  onResetCareer: () => void;
  onOpenAndroid: () => void;
  onClose: () => void;
}

const CLASS_ORDER: BikeClassId[] = ['moto3', 'moto2', 'motogp'];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  riderName,
  selectedLivery,
  quickClass,
  quickLaps,
  career,
  muted,
  bgmEnabled,
  touchEnabled,
  onChangeRiderName,
  onSelectLivery,
  onSelectQuickClass,
  onSelectQuickLaps,
  onToggleMute,
  onToggleBgm,
  onToggleTouch,
  onResetCareer,
  onOpenAndroid,
  onClose,
}) => {
  const [confirmReset, setConfirmReset] = useState(false);

  const careerChamp = CAREER_CHAMPIONSHIPS[career.activeClass];
  const careerRound = getActiveCareerRound(career);
  const careerClassSpec = BIKE_CLASSES[career.activeClass];

  return (
    <div
      className="fixed inset-0 z-30 bg-black/75 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div className="w-full max-w-md bg-[#0d131f] border border-slate-700 rounded-xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-xl font-black italic uppercase tracking-wide text-white">
            Setting
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* Rider Name */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Rider Name
          </label>
          <input
            type="text"
            maxLength={16}
            value={riderName}
            onChange={(e) => onChangeRiderName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white font-semibold focus:outline-none focus:border-red-500"
          />
        </div>

        {/* Team Bike Livery */}
        <div>
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-bold uppercase tracking-wider text-slate-400">Team Bike</span>
            <span className="font-bold text-white">
              {selectedLivery.name} #{selectedLivery.number}
            </span>
          </div>
          <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5">
            {TEAM_LIVERIES.map((liv) => {
              const active = liv.id === selectedLivery.id;
              return (
                <button
                  key={liv.id}
                  type="button"
                  onClick={() => onSelectLivery(liv)}
                  title={`${liv.riderName} (${liv.name})`}
                  className={`h-7 rounded-lg border-2 text-[11px] font-black tabular-nums cursor-pointer transition-transform ${
                    active
                      ? 'border-white scale-105 text-white shadow'
                      : 'border-white/20 text-white/90 opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: liv.primaryHex }}
                >
                  #{liv.number}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Race Class & Laps */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Quick Class
            </div>
            <div className="grid grid-cols-3 gap-1">
              {CLASS_ORDER.map((cid) => (
                <button
                  key={cid}
                  type="button"
                  onClick={() => onSelectQuickClass(cid)}
                  className={`py-1.5 rounded text-[11px] font-black uppercase cursor-pointer border ${
                    quickClass === cid
                      ? 'bg-red-600 border-red-400 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {BIKE_CLASSES[cid].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Quick Laps
            </div>
            <div className="grid grid-cols-3 gap-1">
              {[2, 3, 5].map((laps) => (
                <button
                  key={laps}
                  type="button"
                  onClick={() => onSelectQuickLaps(laps)}
                  className={`py-1.5 rounded text-xs font-black cursor-pointer border ${
                    quickLaps === laps
                      ? 'bg-red-600 border-red-400 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {laps}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Audio & Touch */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={onToggleMute}
            className={`py-2 px-2 rounded-lg border text-xs font-bold cursor-pointer ${
              !muted
                ? 'bg-slate-800 border-slate-600 text-white'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
          >
            SFX: {muted ? 'Off' : 'On'}
          </button>
          <button
            type="button"
            onClick={onToggleBgm}
            className={`py-2 px-2 rounded-lg border text-xs font-bold cursor-pointer ${
              bgmEnabled
                ? 'bg-slate-800 border-slate-600 text-white'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
          >
            BGM: {bgmEnabled ? 'On' : 'Off'}
          </button>
          <button
            type="button"
            onClick={onToggleTouch}
            className={`py-2 px-2 rounded-lg border text-xs font-bold cursor-pointer ${
              touchEnabled
                ? 'bg-slate-800 border-slate-600 text-white'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            Touch: {touchEnabled ? 'On' : 'Off'}
          </button>
        </div>

        {/* Career Summary & Reset */}
        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between gap-2 text-xs">
          <div>
            <div className="font-bold text-amber-400">
              Career: {careerClassSpec.label} · Round {careerRound.roundNumber}/{careerChamp.rounds.length}
            </div>
            <div className="text-slate-400">
              {careerRound.grandPrixName} · {career.seasonPoints}/{careerChamp.pointsToAdvance} pts
            </div>
          </div>
          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
            >
              Reset
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  onResetCareer();
                  setConfirmReset(false);
                }}
                className="px-2 py-1 rounded bg-red-600 text-white font-bold cursor-pointer"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-2 py-1 rounded bg-slate-800 text-slate-300 font-semibold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Android APK & Save */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenAndroid();
            }}
            className="py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-emerald-500/40 text-emerald-300 font-bold text-xs uppercase tracking-wider cursor-pointer"
          >
            Android APK
          </button>
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
