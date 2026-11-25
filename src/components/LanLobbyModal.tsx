import React, { useEffect, useState } from 'react';
import {
  BIKE_CLASSES,
  TEAM_LIVERIES,
  type BikeClassId,
  type LanRoomState,
  type TeamLivery,
} from '../game/types';
import type { OpenRoomSummary } from '../net/lanClient';

interface LanInfoResponse {
  port: number;
  interfaces: Array<{
    interfaceName: string;
    address: string;
    httpUrl: string;
    wsUrl: string;
  }>;
}

interface LanLobbyModalProps {
  connected: boolean;
  clientId: string | null;
  wsUrl: string;
  room: LanRoomState | null;
  openRooms: OpenRoomSummary[];
  errorMsg: string | null;
  riderName: string;
  selectedLivery: TeamLivery;
  preferredClass: BikeClassId;
  onChangeName: (name: string) => void;
  onSelectLivery: (livery: TeamLivery) => void;
  onChangeWsUrl: (url: string) => void;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onLeaveRoom: () => void;
  onToggleReady: () => void;
  onUpdateSettings: (patch: { totalLaps?: number; fillWithAi?: boolean; bikeClass?: BikeClassId }) => void;
  onStartRace: () => void;
  onRefreshRooms: () => void;
  onClose: () => void;
}

export const LanLobbyModal: React.FC<LanLobbyModalProps> = ({
  connected,
  clientId,
  wsUrl,
  room,
  openRooms,
  errorMsg,
  riderName,
  selectedLivery,
  preferredClass,
  onChangeName,
  onSelectLivery,
  onChangeWsUrl,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onToggleReady,
  onUpdateSettings,
  onStartRace,
  onRefreshRooms,
  onClose,
}) => {
  const [joinCode, setJoinCode] = useState('');
  const [lanIpList, setLanIpList] = useState<LanInfoResponse['interfaces']>([]);
  const [customUrlInput, setCustomUrlInput] = useState(wsUrl);
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);

  useEffect(() => {
    setCustomUrlInput(wsUrl);
  }, [wsUrl]);

  useEffect(() => {
    fetch('/api/lan-info')
      .then((r) => r.json())
      .then((data: LanInfoResponse) => {
        if (Array.isArray(data.interfaces)) setLanIpList(data.interfaces);
      })
      .catch(() => {});
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedAddr(text);
    window.setTimeout(() => setCopiedAddr((cur) => (cur === text ? null : cur)), 1600);
  };

  const isHost = Boolean(room && clientId && room.hostId === clientId);
  const localPlayer = room?.players.find((p) => p.id === clientId);
  const activeRoomClass = room ? BIKE_CLASSES[room.bikeClass ?? 'motogp'] : BIKE_CLASSES[preferredClass];

  return (
    <div
      className="fixed inset-0 z-30 bg-black/78 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="LAN Multiplayer Lobby"
    >
      <div className="w-full max-w-3xl bg-[#0b101b] border border-slate-700 rounded-2xl p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-black italic uppercase tracking-wide text-white">
                LAN Multiplayer Paddock
              </h2>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                  connected
                    ? 'bg-emerald-950 border border-emerald-500/60 text-emerald-300'
                    : 'bg-amber-950 border border-amber-500/60 text-amber-300'
                }`}
              >
                {connected ? 'Online' : 'Connecting'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">{wsUrl}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close LAN Lobby"
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold uppercase cursor-pointer"
          >
            Close
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 px-4 py-2.5 rounded-lg bg-red-950/80 border border-red-500/70 text-red-200 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {/* Discovered Wi-Fi LAN IP Addresses with 1-Click Copy */}
        {lanIpList.length > 0 && (
          <div className="mb-5 p-3.5 rounded-xl bg-slate-900/90 border border-slate-700/80">
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-2">
              Same-WiFi LAN Addresses (Tap to Copy for Android / PC Peers)
            </div>
            <div className="flex flex-wrap gap-2">
              {lanIpList.map((iface) => (
                <button
                  key={iface.address}
                  type="button"
                  onClick={() => handleCopy(iface.httpUrl)}
                  className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-600 text-slate-100 font-mono cursor-pointer flex items-center gap-2"
                >
                  <span>{iface.httpUrl}</span>
                  <span className="text-[10px] text-slate-400">({iface.interfaceName})</span>
                  <span className="text-[10px] font-sans font-bold text-emerald-400 uppercase">
                    {copiedAddr === iface.httpUrl ? 'Copied' : 'Copy'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 2-Column Paddock Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Left Column: Rider Setup & Server Connection */}
          <div className="md:col-span-5 space-y-4 bg-slate-900/55 border border-slate-800 rounded-xl p-4">
            <div>
              <label
                htmlFor="lan-rider-name"
                className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1"
              >
                Rider Name
              </label>
              <input
                id="lan-rider-name"
                type="text"
                maxLength={18}
                value={riderName}
                onChange={(e) => onChangeName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-sm"
                placeholder="Your rider name"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                <span>Factory Bike</span>
                <span className="text-slate-200">{selectedLivery.name}</span>
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {TEAM_LIVERIES.map((liv) => (
                  <button
                    key={liv.id}
                    type="button"
                    onClick={() => onSelectLivery(liv)}
                    className={`h-8 rounded border-2 text-[11px] font-bold text-white cursor-pointer ${
                      selectedLivery.id === liv.id
                        ? 'border-white scale-105'
                        : 'border-slate-700 opacity-75 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: liv.primaryHex }}
                    title={liv.name}
                  >
                    {liv.number}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="lan-ws-url"
                className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1"
              >
                LAN Server WebSocket URL
              </label>
              <div className="flex gap-1.5">
                <input
                  id="lan-ws-url"
                  type="text"
                  value={customUrlInput}
                  onChange={(e) => setCustomUrlInput(e.target.value)}
                  className="flex-1 min-w-0 px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                  placeholder="ws://192.168.1.50:3000/ws"
                />
                <button
                  type="button"
                  onClick={() => onChangeWsUrl(customUrlInput)}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200 cursor-pointer"
                >
                  Link
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 text-xs text-slate-400">
              <div className="font-bold text-slate-200 mb-0.5">
                Class Spec: {activeRoomClass.label} ({activeRoomClass.displacement})
              </div>
              <p className="text-[11px] leading-relaxed">{activeRoomClass.description}</p>
            </div>
          </div>

          {/* Right Column: Room Browser or Active Room Grid */}
          <div className="md:col-span-7">
            {!room ? (
              <div className="space-y-4">
                <button
                  type="button"
                  disabled={!connected}
                  onClick={onCreateRoom}
                  className="w-full py-3.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-black uppercase tracking-wider text-sm cursor-pointer shadow-lg"
                >
                  Create {BIKE_CLASSES[preferredClass].label} LAN Room
                </button>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (joinCode.trim()) onJoinRoom(joinCode.trim());
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    aria-label="Room Code"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="Enter Room Code (e.g. GP42)"
                    maxLength={8}
                    className="flex-1 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm font-mono uppercase"
                  />
                  <button
                    type="submit"
                    disabled={!connected || !joinCode.trim()}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-sm uppercase cursor-pointer"
                  >
                    Join
                  </button>
                </form>

                {/* Open LAN Races */}
                <div className="border border-slate-800 rounded-xl p-3.5 bg-slate-900/50">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Open LAN Rooms ({openRooms.length})
                    </span>
                    <button
                      type="button"
                      onClick={onRefreshRooms}
                      className="text-xs text-sky-400 hover:text-sky-300 font-semibold cursor-pointer"
                    >
                      Refresh
                    </button>
                  </div>
                  {openRooms.length === 0 ? (
                    <p className="text-xs text-slate-500 py-3">
                      No active rooms on this network yet. Create a room or connect peers to the same Wi-Fi IP above.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {openRooms.map((r) => (
                        <div
                          key={r.code}
                          className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700"
                        >
                          <div>
                            <span className="font-mono font-bold text-amber-400 mr-2">{r.code}</span>
                            <span className="text-sm text-white font-semibold">{r.hostName}</span>
                            <span className="text-xs text-slate-400 ml-2">
                              {BIKE_CLASSES[r.bikeClass ?? 'motogp'].label} · {r.playerCount}/6
                            </span>
                          </div>
                          <button
                            type="button"
                            disabled={r.status !== 'lobby'}
                            onClick={() => onJoinRoom(r.code)}
                            className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold uppercase cursor-pointer"
                          >
                            Join
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Active Room Paddock */
              <div className="space-y-4">
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Room Code
                      </div>
                      <div className="text-2xl font-black font-mono tracking-widest text-amber-400 leading-none">
                        {room.code}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <label className="text-xs text-slate-300 flex items-center gap-1.5">
                        <span>Class:</span>
                        <select
                          aria-label="Room Bike Class"
                          disabled={!isHost}
                          value={room.bikeClass ?? 'motogp'}
                          onChange={(e) =>
                            onUpdateSettings({ bikeClass: e.target.value as BikeClassId })
                          }
                          className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-xs font-bold"
                        >
                          <option value="moto3">Moto3</option>
                          <option value="moto2">Moto2</option>
                          <option value="motogp">MotoGP</option>
                        </select>
                      </label>

                      <label className="text-xs text-slate-300 flex items-center gap-1.5">
                        <span>Laps:</span>
                        <select
                          aria-label="Race Laps"
                          disabled={!isHost}
                          value={room.totalLaps}
                          onChange={(e) => onUpdateSettings({ totalLaps: Number(e.target.value) })}
                          className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-xs"
                        >
                          <option value={2}>2 Laps</option>
                          <option value={3}>3 Laps</option>
                          <option value={5}>5 Laps</option>
                        </select>
                      </label>

                      <label className="text-xs text-slate-300 flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          disabled={!isHost}
                          checked={room.fillWithAi}
                          onChange={(e) => onUpdateSettings({ fillWithAi: e.target.checked })}
                        />
                        <span>Fill AI</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Rider Roster */}
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {room.players.map((p) => {
                    const liv = TEAM_LIVERIES.find((l) => l.id === p.liveryId) ?? TEAM_LIVERIES[0];
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="w-7 h-7 rounded-md text-xs font-black text-white flex items-center justify-center"
                            style={{ backgroundColor: liv.primaryHex }}
                          >
                            {liv.number}
                          </span>
                          <div>
                            <div className="font-bold text-sm text-white leading-tight">
                              {p.name}
                              {p.id === clientId && (
                                <span className="text-xs text-sky-400 ml-1.5">(You)</span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400">{liv.name}</div>
                          </div>
                          {p.isHost && (
                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              Host
                            </span>
                          )}
                        </div>

                        <span
                          className={`text-xs font-bold uppercase ${
                            p.ready ? 'text-emerald-400' : 'text-slate-400'
                          }`}
                        >
                          {p.ready ? 'Ready' : 'Waiting'}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={onLeaveRoom}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold uppercase cursor-pointer"
                  >
                    Leave Room
                  </button>

                  <div className="flex items-center gap-2.5">
                    {!isHost && (
                      <button
                        type="button"
                        onClick={onToggleReady}
                        className={`px-5 py-2.5 rounded-xl font-bold text-sm uppercase cursor-pointer ${
                          localPlayer?.ready
                            ? 'bg-emerald-700 text-white'
                            : 'bg-blue-600 hover:bg-blue-500 text-white'
                        }`}
                      >
                        {localPlayer?.ready ? 'Ready!' : 'Mark Ready'}
                      </button>
                    )}

                    {isHost && (
                      <button
                        type="button"
                        onClick={onStartRace}
                        className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-sm uppercase tracking-wider cursor-pointer shadow-lg"
                      >
                        Start LAN Race
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
