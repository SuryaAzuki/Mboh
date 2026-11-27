import React from 'react';
import { CIRCUIT_LIST, getCircuit } from '../game/trackMath';
import {
  BIKE_CLASSES,
  COUNTRY_NAMES,
  getClassLiveries,
  type BikeClassId,
  type CircuitId,
  type TeamLivery,
} from '../game/types';
import { NationalFlag, RiderMiniFace } from './RiderAvatarBadge';

interface QuickRaceModalProps {
  selectedLivery: TeamLivery;
  selectedCircuit: CircuitId;
  quickClass: BikeClassId;
  quickLaps: number;
  quickRiderCount: number;
  onSelectLivery: (livery: TeamLivery) => void;
  onSelectCircuit: (circuitId: CircuitId) => void;
  onSelectClass: (bikeClass: BikeClassId) => void;
  onSelectLaps: (laps: number) => void;
  onSelectRiderCount: (count: number) => void;
  onStartRace: () => void;
  onClose: () => void;
}

const CLASS_ORDER: BikeClassId[] = ['moto3', 'moto2', 'motogp'];

export const QuickRaceModal: React.FC<QuickRaceModalProps> = ({
  selectedLivery,
  selectedCircuit,
  quickClass,
  quickLaps,
  quickRiderCount,
  onSelectLivery,
  onSelectCircuit,
  onSelectClass,
  onSelectLaps,
  onSelectRiderCount,
  onStartRace,
  onClose,
}) => {
  const activeCircuitMeta = CIRCUIT_LIST.find((c) => c.id === selectedCircuit) ?? CIRCUIT_LIST[0];
  const activeCircuitData = getCircuit(selectedCircuit);
  const classLiveries = getClassLiveries(quickClass);

  return (
    <div
      className="fixed inset-0 z-30 bg-black/78 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Quick Race Setup"
    >
      <div className="w-full max-w-3xl bg-gradient-to-b from-[#121a2d] to-[#0a0f1b] border border-cyan-500/35 rounded-2xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col">
        <div className="moto-stripe-bar h-1.5 w-full shrink-0" />
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-700/70 pb-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <RiderMiniFace livery={selectedLivery} size="md" showFlag />
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl font-black italic uppercase tracking-wide text-white truncate">
                  Quick Race Setup
                </h2>
                <p className="text-xs text-cyan-300/90 font-medium truncate">
                  #{selectedLivery.number} {selectedLivery.riderName} ({COUNTRY_NAMES[selectedLivery.nationality]}) ·{' '}
                  {selectedLivery.name}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-xs font-bold uppercase cursor-pointer shrink-0"
            >
              Back
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Left: Rider & Class Selection */}
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold uppercase tracking-wider text-amber-300">
                    Select {BIKE_CLASSES[quickClass].label} Rider
                  </span>
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <NationalFlag code={selectedLivery.nationality} size="xs" />
                    <span>
                      #{selectedLivery.number} {selectedLivery.riderName}
                    </span>
                  </span>
                </div>
                <div data-testid="quick-rider-list" className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-1">
                  {classLiveries.map((liv) => {
                    const active = liv.id === selectedLivery.id;
                    return (
                      <button
                        key={liv.id}
                        type="button"
                        onClick={() => onSelectLivery(liv)}
                        className={`flex items-center gap-2 px-2 py-2 rounded-lg border text-left cursor-pointer transition-all ${
                          active
                            ? 'bg-gradient-to-r from-red-950/85 to-slate-800 border-amber-400 text-white shadow-md'
                            : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800/85 hover:border-slate-600'
                        }`}
                      >
                        <RiderMiniFace livery={liv} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <NationalFlag code={liv.nationality} size="xs" />
                            <span className="text-[11px] font-extrabold leading-tight truncate">{liv.riderName}</span>
                          </div>
                          <div className="flex items-center gap-1 mt-0.5 text-[10px] text-slate-400 truncate">
                            <span
                              className="px-1 rounded text-[9px] font-black text-white tabular-nums"
                              style={{ backgroundColor: liv.primaryHex }}
                            >
                              #{liv.number}
                            </span>
                            <span className="truncate">{liv.name}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bike Class, Laps & Grid Size */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-cyan-300 mb-1.5">Class</div>
                  <div className="grid grid-cols-3 gap-1">
                    {CLASS_ORDER.map((cid) => (
                      <button
                        key={cid}
                        type="button"
                        onClick={() => onSelectClass(cid)}
                        className={`py-2 rounded-lg text-[11px] font-black uppercase cursor-pointer border transition-colors ${
                          quickClass === cid
                            ? 'bg-gradient-to-r from-red-600 to-orange-500 border-amber-300 text-white shadow'
                            : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {BIKE_CLASSES[cid].label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-cyan-300 mb-1.5">Race Laps</div>
                  <div className="grid grid-cols-3 gap-1">
                    {[2, 3, 5].map((laps) => (
                      <button
                        key={laps}
                        type="button"
                        onClick={() => onSelectLaps(laps)}
                        className={`py-2 rounded-lg text-xs font-black cursor-pointer border transition-colors ${
                          quickLaps === laps
                            ? 'bg-gradient-to-r from-cyan-600 to-blue-600 border-cyan-300 text-white shadow'
                            : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {laps}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-bold uppercase tracking-wider text-amber-300">Grid Riders</span>
                  <span className="text-[11px] font-bold text-slate-200">{quickRiderCount} Riders</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[10, 16, 20, 22].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => onSelectRiderCount(count)}
                      className={`py-1.5 rounded-lg text-xs font-black cursor-pointer border transition-colors ${
                        quickRiderCount === count
                          ? 'bg-amber-400 border-amber-200 text-slate-950 shadow'
                          : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Circuit Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold uppercase tracking-wider text-amber-300">Select Circuit</span>
                <span className="font-bold text-cyan-300 tabular-nums">
                  {(activeCircuitData.totalLength / 1000).toFixed(2)} km · {activeCircuitMeta.corners} Turns
                </span>
              </div>

              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {CIRCUIT_LIST.map((c) => {
                  const active = c.id === selectedCircuit;
                  const lenKm = (getCircuit(c.id).totalLength / 1000).toFixed(2);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onSelectCircuit(c.id)}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        active
                          ? 'bg-gradient-to-r from-amber-950/60 to-slate-800 border-amber-400 text-white shadow'
                          : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800/85'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-black leading-tight truncate">{c.name}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {c.country} · {lenKm} km · {c.corners} Corners
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase shrink-0 ${
                          c.difficulty === 'Pro'
                            ? 'bg-red-950 text-red-300 border border-red-500/50'
                            : c.difficulty === 'Hard'
                            ? 'bg-amber-950 text-amber-300 border border-amber-500/50'
                            : 'bg-sky-950 text-sky-300 border border-sky-500/50'
                        }`}
                      >
                        {c.difficulty}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900/95 border border-cyan-500/25 text-[11px] text-slate-200 leading-relaxed">
                <div>{activeCircuitMeta.description}</div>
                <div className="mt-1 text-cyan-300 font-semibold">
                  Weather Forecast: Starts Clear Skies · Random Rain Patches Possible
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Start Button */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-700/70">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              data-start="true"
              onClick={onStartRace}
              className="px-7 py-3 rounded-xl bg-gradient-to-r from-[#e10600] to-[#f97316] hover:from-[#ef4444] hover:to-[#fb923c] border border-amber-300/60 text-white font-black uppercase tracking-wider text-sm cursor-pointer shadow-lg"
            >
              Start Race
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
