import { useCallback, useEffect, useRef, useState } from 'react';
import { AndroidApkModal } from './components/AndroidApkModal';
import { CareerModal } from './components/CareerModal';
import { LanLobbyModal } from './components/LanLobbyModal';
import { QuickRaceModal } from './components/QuickRaceModal';
import { RaceHud } from './components/RaceHud';
import { FinishModal, PauseModal, type CareerFinishOutcome } from './components/RaceModals';
import { SettingsModal } from './components/SettingsModal';
import { TitleScreen } from './components/TitleScreen';
import { TouchControls } from './components/TouchControls';
import {
  applyCareerRaceOutcome,
  buildQualifyingClassification,
  DEFAULT_RACE_RIDER_COUNT,
  findPlayerRankFromResults,
  getActiveCareerRound,
  loadCareerProgress,
  resetCareerProgress,
  saveCareerProgress,
  type CareerProgress,
} from './game/career';
import { MotoGPScene, type RaceStartConfig } from './game/MotoGPScene';
import { CIRCUIT_SPECS } from './game/trackMath';
import {
  TEAM_LIVERIES,
  type BikeClassId,
  type CameraMode,
  type CircuitId,
  type GameScreenState,
  type HudSnapshot,
  type LanRoomState,
  type RaceResultEntry,
  type RiderInput,
  type SessionType,
  type TeamLivery,
} from './game/types';
import { getDefaultWsUrl, LanMultiplayerClient, type OpenRoomSummary } from './net/lanClient';

const INITIAL_HUD: HudSnapshot = {
  sessionType: 'race',
  speedKmh: 0,
  gear: 1,
  rpmRatio: 0.1,
  boostFuel: 100,
  isBoosting: false,
  lap: 1,
  totalLaps: 3,
  rank: 1,
  totalRiders: DEFAULT_RACE_RIDER_COUNT,
  raceTimeMs: 0,
  currentLapMs: 0,
  bestLapMs: null,
  countdownStage: 3,
  surface: 'asphalt',
  wrongWay: false,
  crashed: false,
  crashRecoverSec: 0,
  bikeClass: 'motogp',
  leaderboard: [],
  minimapRiders: [],
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<MotoGPScene | null>(null);
  const lanRef = useRef<LanMultiplayerClient | null>(null);

  const [gameState, setGameState] = useState<GameScreenState>('title');
  const [careerProgress, setCareerProgress] = useState<CareerProgress>(() => loadCareerProgress());
  const [quickClass, setQuickClass] = useState<BikeClassId>('motogp');
  const [quickLaps, setQuickLaps] = useState<number>(3);
  const [quickRiderCount, setQuickRiderCount] = useState<number>(DEFAULT_RACE_RIDER_COUNT);
  const [selectedCircuit, setSelectedCircuit] = useState<CircuitId>('lusail');
  const [activeCircuitId, setActiveCircuitId] = useState<CircuitId>('lusail');
  const [selectedLivery, setSelectedLivery] = useState<TeamLivery>(TEAM_LIVERIES[0]);
  const [riderName, setRiderName] = useState('Rider 1');
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [muted, setMuted] = useState(false);
  const [bgmEnabled, setBgmEnabled] = useState(true);
  const [cameraMode, setCameraMode] = useState<CameraMode>('chase');
  const [touchEnabled, setTouchEnabled] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768
      : false,
  );
  const [results, setResults] = useState<RaceResultEntry[]>([]);
  const [activeRaceIsCareer, setActiveRaceIsCareer] = useState(false);
  const [activeSessionType, setActiveSessionType] = useState<SessionType>('race');
  const [careerOutcome, setCareerOutcome] = useState<CareerFinishOutcome | null>(null);

  // Modal state
  const [quickRaceOpen, setQuickRaceOpen] = useState(false);
  const [careerOpen, setCareerOpen] = useState(false);
  const [lanOpen, setLanOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [androidOpen, setAndroidOpen] = useState(false);

  // LAN state
  const [lanConnected, setLanConnected] = useState(false);
  const [lanClientId, setLanClientId] = useState<string | null>(null);
  const [wsUrl, setWsUrl] = useState(() => getDefaultWsUrl());
  const [lanRoom, setLanRoom] = useState<LanRoomState | null>(null);
  const [openRooms, setOpenRooms] = useState<OpenRoomSummary[]>([]);
  const [lanError, setLanError] = useState<string | null>(null);
  const [isLanRace, setIsLanRace] = useState(false);

  // Mirror game state to document.body.dataset.state
  useEffect(() => {
    document.body.dataset.state = gameState;
    sceneRef.current?.setGameState(gameState);
  }, [gameState]);

  // Keep 3D Title showcase bike & circuit synced with selected livery, class & circuit
  useEffect(() => {
    if (gameState !== 'title') return;
    sceneRef.current?.updateShowcaseBike(selectedLivery, quickClass, selectedCircuit);
    sceneRef.current?.applySkyMood(CIRCUIT_SPECS[selectedCircuit].skyMood);
  }, [gameState, quickClass, selectedLivery, selectedCircuit]);

  const launchSinglePlayerRace = useCallback(
    (opts: {
      mode: 'career' | 'solo';
      sessionType?: SessionType;
      bikeClass: BikeClassId;
      circuitId: CircuitId;
      totalLaps: number;
      aiDifficulty: number;
      skyMood: 'sunny' | 'sunset' | 'overcast';
      riderCount?: number;
      playerGridPos?: number;
      orderedAiLiveryIds?: string[];
    }) => {
      const sessionType: SessionType = opts.sessionType ?? 'race';
      const riderCount = Math.max(2, Math.min(TEAM_LIVERIES.length, opts.riderCount ?? DEFAULT_RACE_RIDER_COUNT));
      const localDisplayName = selectedLivery.riderName || riderName || 'You';
      const playerParticipant = {
        id: 'local',
        name: localDisplayName,
        livery: selectedLivery,
        bikeClass: opts.bikeClass,
        isPlayer: true,
        isRemote: false,
        isAi: false,
      };

      let participants: RaceStartConfig['participants'];
      if (sessionType === 'qualifying') {
        participants = [playerParticipant];
      } else {
        const defaultAiPool = TEAM_LIVERIES.filter((l) => l.id !== selectedLivery.id);
        const orderedAi: TeamLivery[] = [];
        if (opts.orderedAiLiveryIds && opts.orderedAiLiveryIds.length > 0) {
          const seen = new Set<string>([selectedLivery.id]);
          for (const lid of opts.orderedAiLiveryIds) {
            const found = TEAM_LIVERIES.find((l) => l.id === lid);
            if (found && !seen.has(found.id)) {
              seen.add(found.id);
              orderedAi.push(found);
            }
          }
          for (const fallback of defaultAiPool) {
            if (!seen.has(fallback.id)) {
              seen.add(fallback.id);
              orderedAi.push(fallback);
            }
          }
        } else {
          orderedAi.push(...defaultAiPool);
        }

        const aiParticipants = orderedAi.slice(0, riderCount - 1).map((liv, i) => ({
          id: `ai-${i + 1}`,
          name: liv.riderName,
          livery: liv,
          bikeClass: opts.bikeClass,
          aiPaceFactor: Math.max(0.95, Math.min(1.04, opts.aiDifficulty + (0.045 - (i / Math.max(1, riderCount - 2)) * 0.085))),
          isPlayer: false,
          isRemote: false,
          isAi: true,
        }));

        const playerSlotIdx = Math.max(0, Math.min(aiParticipants.length, (opts.playerGridPos ?? 1) - 1));
        participants = [
          ...aiParticipants.slice(0, playerSlotIdx),
          playerParticipant,
          ...aiParticipants.slice(playerSlotIdx),
        ];
      }

      const config: RaceStartConfig = {
        mode: opts.mode,
        sessionType,
        bikeClass: opts.bikeClass,
        circuitId: opts.circuitId,
        totalLaps: opts.totalLaps,
        skyMood: opts.skyMood,
        localRiderId: 'local',
        localRiderName: localDisplayName,
        localLivery: selectedLivery,
        participants,
      };

      setIsLanRace(false);
      setActiveCircuitId(opts.circuitId);
      setActiveRaceIsCareer(opts.mode === 'career');
      setActiveSessionType(sessionType);
      setCareerOutcome(null);
      setQuickRaceOpen(false);
      setCareerOpen(false);
      setLanOpen(false);
      setSettingsOpen(false);
      setAndroidOpen(false);
      document.body.dataset.state = 'playing';
      setGameState('playing');
      sceneRef.current?.startRace(config);
    },
    [riderName, selectedLivery],
  );

  const startCareerQualifying = useCallback(() => {
    const round = getActiveCareerRound(careerProgress);
    launchSinglePlayerRace({
      mode: 'career',
      sessionType: 'qualifying',
      bikeClass: careerProgress.activeClass,
      circuitId: round.circuitId,
      totalLaps: 1,
      aiDifficulty: round.aiDifficulty,
      skyMood: round.skyMood,
      riderCount: DEFAULT_RACE_RIDER_COUNT,
    });
  }, [careerProgress, launchSinglePlayerRace]);

  const startCareerRace = useCallback(
    (progressOverride?: CareerProgress) => {
      const prog = progressOverride ?? careerProgress;
      const round = getActiveCareerRound(prog);
      launchSinglePlayerRace({
        mode: 'career',
        sessionType: 'race',
        bikeClass: prog.activeClass,
        circuitId: round.circuitId,
        totalLaps: round.laps,
        aiDifficulty: round.aiDifficulty,
        skyMood: round.skyMood,
        riderCount: DEFAULT_RACE_RIDER_COUNT,
        playerGridPos: prog.qualifyingGridPos ?? DEFAULT_RACE_RIDER_COUNT,
        orderedAiLiveryIds: prog.qualifyingOrderIds,
      });
    },
    [careerProgress, launchSinglePlayerRace],
  );

  const startQuickRace = useCallback(() => {
    const spec = CIRCUIT_SPECS[selectedCircuit];
    launchSinglePlayerRace({
      mode: 'solo',
      sessionType: 'race',
      bikeClass: quickClass,
      circuitId: selectedCircuit,
      totalLaps: quickLaps,
      aiDifficulty: 0.98,
      skyMood: spec.skyMood,
      riderCount: quickRiderCount,
      playerGridPos: Math.min(quickRiderCount, Math.ceil(quickRiderCount * 0.45)),
    });
  }, [launchSinglePlayerRace, quickClass, quickLaps, quickRiderCount, selectedCircuit]);

  const startLanRaceFromRoom = useCallback(
    (room: LanRoomState) => {
      const myId = lanRef.current?.getClientId() || lanClientId || 'local';
      const roomClass: BikeClassId = room.bikeClass ?? 'motogp';
      const roomCircuit: CircuitId = room.circuitId ?? 'lusail';
      const participants: RaceStartConfig['participants'] = room.players.map((p) => {
        const liv = TEAM_LIVERIES.find((l) => l.id === p.liveryId) ?? TEAM_LIVERIES[0];
        const isMe = p.id === myId;
        return {
          id: p.id,
          name: p.name,
          livery: liv,
          bikeClass: roomClass,
          isPlayer: isMe,
          isRemote: !isMe,
          isAi: false,
        };
      });

      if (room.fillWithAi && participants.length < DEFAULT_RACE_RIDER_COUNT) {
        const usedLiveries = new Set(participants.map((p) => p.livery.id));
        const avail = TEAM_LIVERIES.filter((l) => !usedLiveries.has(l.id));
        let aiIdx = 0;
        while (participants.length < DEFAULT_RACE_RIDER_COUNT) {
          const liv = avail[aiIdx % avail.length] ?? TEAM_LIVERIES[aiIdx % TEAM_LIVERIES.length];
          participants.push({
            id: `ai-${aiIdx + 1}`,
            name: liv.riderName ?? `GP AI #${aiIdx + 1}`,
            livery: liv,
            bikeClass: roomClass,
            isPlayer: false,
            isRemote: false,
            isAi: true,
          });
          aiIdx++;
        }
      }

      const me = participants.find((p) => p.isPlayer) ?? participants[0];
      setIsLanRace(true);
      setActiveCircuitId(roomCircuit);
      setActiveRaceIsCareer(false);
      setActiveSessionType('race');
      setCareerOutcome(null);
      setQuickRaceOpen(false);
      setCareerOpen(false);
      setLanOpen(false);
      setAndroidOpen(false);
      document.body.dataset.state = 'playing';
      setGameState('playing');
      sceneRef.current?.startRace({
        mode: 'lan',
        bikeClass: roomClass,
        circuitId: roomCircuit,
        totalLaps: room.totalLaps,
        skyMood: CIRCUIT_SPECS[roomCircuit].skyMood,
        localRiderId: me.id,
        localRiderName: me.name,
        localLivery: me.livery,
        participants,
      });
    },
    [lanClientId],
  );

  // Refs for callbacks used inside long-lived Scene & WebSocket instances
  const callbacksRef = useRef({
    startLanRaceFromRoom,
    isLanRace,
    gameState,
    activeRaceIsCareer,
    activeSessionType,
    careerProgress,
    selectedLivery,
  });
  callbacksRef.current = {
    startLanRaceFromRoom,
    isLanRace,
    gameState,
    activeRaceIsCareer,
    activeSessionType,
    careerProgress,
    selectedLivery,
  };

  // Mount WebGL canvas once
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const scene = new MotoGPScene(mount, {
      onHudUpdate: (snapshot) => setHud(snapshot),
      onRaceFinish: (res) => {
        if (callbacksRef.current.activeRaceIsCareer && callbacksRef.current.activeSessionType === 'qualifying') {
          const playerEntry = res.find((r) => r.isPlayer) ?? res[0];
          const curProg = callbacksRef.current.careerProgress;
          const round = getActiveCareerRound(curProg);
          const quali = buildQualifyingClassification({
            circuitId: round.circuitId,
            bikeClass: curProg.activeClass,
            aiDifficulty: round.aiDifficulty,
            playerLivery: playerEntry?.livery ?? callbacksRef.current.selectedLivery,
            playerName: playerEntry?.name ?? 'You',
            playerLapMs: playerEntry?.finishTimeMs ?? 90000,
            playerTopSpeedKmh: playerEntry?.topSpeedKmh ?? 250,
            riderCount: DEFAULT_RACE_RIDER_COUNT,
          });
          const updated: CareerProgress = {
            ...curProg,
            qualifyingGridPos: quali.playerGridPos,
            qualifyingLapMs: playerEntry?.finishTimeMs ?? null,
            qualifyingOrderIds: quali.orderedAiLiveryIds,
          };
          saveCareerProgress(updated);
          setCareerProgress(updated);
          setResults(quali.results);
          setCareerOutcome(null);
          setGameState('gameover');
          return;
        }

        setResults(res);
        if (callbacksRef.current.activeRaceIsCareer) {
          const rank = findPlayerRankFromResults(res);
          const classPlayed = callbacksRef.current.careerProgress.activeClass;
          const outcome = applyCareerRaceOutcome(callbacksRef.current.careerProgress, rank);
          saveCareerProgress(outcome.updated);
          setCareerProgress(outcome.updated);
          setCareerOutcome({
            classPlayed,
            pointsEarned: outcome.pointsEarned,
            promotedTo: outcome.promotedTo,
            seasonFinished: outcome.seasonFinished,
            wonChampionship: outcome.wonChampionship,
            updatedProgress: outcome.updated,
          });
        } else {
          setCareerOutcome(null);
        }
        setGameState('gameover');
      },
      onLocalTelemetry: (state) => {
        lanRef.current?.sendTelemetry(state);
      },
      onTogglePause: () => {
        setGameState((prev) => (prev === 'playing' ? 'paused' : prev === 'paused' ? 'playing' : prev));
      },
      onCameraModeChange: (mode) => {
        setCameraMode(mode);
      },
    });
    sceneRef.current = scene;

    // Support ?autostart=1
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      window.setTimeout(() => {
        startCareerRace();
      }, 60);
    }

    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Connect LAN WebSocket client when LAN modal is opened or during LAN race
  useEffect(() => {
    if (!lanOpen && !isLanRace) return;
    if (!lanRef.current) {
      lanRef.current = new LanMultiplayerClient(
        {
          onConnectionChange: (conn, cid) => {
            setLanConnected(conn);
            setLanClientId(cid);
            if (conn) setLanError(null);
          },
          onRoomList: (list) => setOpenRooms(list),
          onRoomState: (rm) => setLanRoom(rm),
          onRoomError: (msg) => setLanError(msg),
          onRaceStart: (rm) => {
            setLanRoom(rm);
            callbacksRef.current.startLanRaceFromRoom(rm);
          },
          onRaceSnapshot: (states) => {
            sceneRef.current?.applyRemoteStates(states);
          },
        },
        wsUrl,
      );
      lanRef.current.connect();
    }
  }, [lanOpen, isLanRace, wsUrl]);

  // Cleanup LAN client on unmount
  useEffect(() => {
    return () => {
      lanRef.current?.disconnect();
      lanRef.current = null;
    };
  }, []);

  // Enter / Space opens or starts Quick Race from Title; Esc closes modals or toggles Pause
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (gameState === 'title') {
        if (e.code === 'Escape') {
          if (quickRaceOpen || careerOpen || settingsOpen || lanOpen || androidOpen) {
            e.preventDefault();
            setQuickRaceOpen(false);
            setCareerOpen(false);
            setSettingsOpen(false);
            setLanOpen(false);
            setAndroidOpen(false);
          }
          return;
        }
        if (quickRaceOpen && (e.code === 'Enter' || e.code === 'Space')) {
          const activeTag = document.activeElement?.tagName;
          if (activeTag === 'INPUT' || activeTag === 'SELECT' || activeTag === 'BUTTON') return;
          e.preventDefault();
          startQuickRace();
          return;
        }
        if (!quickRaceOpen && !careerOpen && !lanOpen && !settingsOpen && !androidOpen) {
          if (e.code === 'Enter' || e.code === 'Space') {
            const activeTag = document.activeElement?.tagName;
            if (activeTag === 'INPUT' || activeTag === 'SELECT' || activeTag === 'BUTTON') return;
            e.preventDefault();
            setQuickRaceOpen(true);
          }
        }
      } else if (gameState === 'paused') {
        if (e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          setGameState('playing');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameState, quickRaceOpen, careerOpen, lanOpen, settingsOpen, androidOpen, startQuickRace]);

  const handleTouchChange = useCallback((partial: Partial<RiderInput>) => {
    sceneRef.current?.setTouchInput(partial);
  }, []);

  const preferredLanClass: BikeClassId = quickClass;

  return (
    <main className="relative w-full h-full overflow-hidden bg-[#0b0f17]">
      {/* Dedicated isolated WebGL canvas container */}
      <div
        ref={canvasMountRef}
        data-testid="game-canvas-container"
        className="absolute inset-0 w-full h-full"
      />

      {gameState === 'title' && (
        <TitleScreen
          accentHex={selectedLivery.primaryHex}
          onQuickRace={() => setQuickRaceOpen(true)}
          onCareer={() => setCareerOpen(true)}
          onMultiplayer={() => setLanOpen(true)}
          onSetting={() => setSettingsOpen(true)}
        />
      )}

      {gameState === 'playing' && (
        <>
          <RaceHud
            hud={hud}
            circuitId={activeCircuitId}
            muted={muted}
            bgmEnabled={bgmEnabled}
            cameraMode={cameraMode}
            touchEnabled={touchEnabled}
            onToggleMute={() => {
              const next = sceneRef.current?.getAudio().toggleMute() ?? !muted;
              setMuted(next);
            }}
            onToggleBgm={() => {
              const next = sceneRef.current?.getAudio().toggleBgm() ?? !bgmEnabled;
              setBgmEnabled(next);
            }}
            onCycleCamera={() => {
              const next = sceneRef.current?.cycleCameraMode() ?? 'chase';
              setCameraMode(next);
            }}
            onToggleTouch={() => setTouchEnabled((v) => !v)}
            onResetBike={() => sceneRef.current?.resetLocalBike()}
            onPause={() => setGameState('paused')}
          />
          {touchEnabled && <TouchControls onChange={handleTouchChange} />}
        </>
      )}

      {gameState === 'paused' && (
        <PauseModal
          onResume={() => setGameState('playing')}
          onRestart={() => {
            if (isLanRace && lanRoom) {
              startLanRaceFromRoom(lanRoom);
            } else if (activeRaceIsCareer) {
              if (activeSessionType === 'qualifying') {
                startCareerQualifying();
              } else {
                startCareerRace();
              }
            } else {
              startQuickRace();
            }
          }}
          onExitTitle={() => {
            setIsLanRace(false);
            setActiveRaceIsCareer(false);
            setActiveSessionType('race');
            setGameState('title');
          }}
        />
      )}

      {gameState === 'gameover' && (
        <FinishModal
          sessionType={activeSessionType}
          results={results}
          isLan={isLanRace}
          careerOutcome={careerOutcome}
          onPlayAgain={() => {
            if (isLanRace) {
              lanRef.current?.returnToLobby();
              setGameState('title');
              setLanOpen(true);
            } else if (activeRaceIsCareer) {
              if (activeSessionType === 'qualifying') {
                startCareerRace(careerProgress);
              } else {
                startCareerQualifying();
              }
            } else {
              startQuickRace();
            }
          }}
          onExitTitle={() => {
            const wasQualifying = activeRaceIsCareer && activeSessionType === 'qualifying';
            setIsLanRace(false);
            setActiveRaceIsCareer(false);
            setActiveSessionType('race');
            setGameState('title');
            if (wasQualifying) {
              setCareerOpen(true);
            }
          }}
        />
      )}

      {lanOpen && (
        <LanLobbyModal
          connected={lanConnected}
          clientId={lanClientId}
          wsUrl={wsUrl}
          room={lanRoom}
          openRooms={openRooms}
          errorMsg={lanError}
          riderName={riderName}
          selectedLivery={selectedLivery}
          preferredClass={preferredLanClass}
          onChangeName={(name) => {
            setRiderName(name);
            lanRef.current?.updatePlayer({ name });
          }}
          onSelectLivery={(liv) => {
            setSelectedLivery(liv);
            lanRef.current?.updatePlayer({ liveryId: liv.id });
          }}
          onChangeWsUrl={(url) => {
            setWsUrl(url);
            setLanError(null);
            lanRef.current?.connect(url);
          }}
          onCreateRoom={() => {
            setLanError(null);
            lanRef.current?.createRoom(riderName, selectedLivery.id, preferredLanClass, selectedCircuit);
          }}
          onJoinRoom={(code) => {
            setLanError(null);
            lanRef.current?.joinRoom(code, riderName, selectedLivery.id);
          }}
          onLeaveRoom={() => lanRef.current?.leaveRoom()}
          onToggleReady={() => {
            const me = lanRoom?.players.find((p) => p.id === lanClientId);
            lanRef.current?.updatePlayer({ ready: !me?.ready });
          }}
          onUpdateSettings={(patch) => lanRef.current?.updateSettings(patch)}
          onStartRace={() => lanRef.current?.startRace()}
          onRefreshRooms={() => lanRef.current?.refreshRooms()}
          onClose={() => setLanOpen(false)}
        />
      )}

      {quickRaceOpen && (
        <QuickRaceModal
          selectedLivery={selectedLivery}
          selectedCircuit={selectedCircuit}
          quickClass={quickClass}
          quickLaps={quickLaps}
          quickRiderCount={quickRiderCount}
          onSelectLivery={setSelectedLivery}
          onSelectCircuit={setSelectedCircuit}
          onSelectClass={setQuickClass}
          onSelectLaps={setQuickLaps}
          onSelectRiderCount={setQuickRiderCount}
          onStartRace={startQuickRace}
          onClose={() => setQuickRaceOpen(false)}
        />
      )}

      {careerOpen && (
        <CareerModal
          career={careerProgress}
          selectedLivery={selectedLivery}
          onSelectLivery={setSelectedLivery}
          onStartQualifying={startCareerQualifying}
          onStartNextRound={() => startCareerRace()}
          onResetCareer={() => setCareerProgress(resetCareerProgress())}
          onClose={() => setCareerOpen(false)}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          riderName={riderName}
          selectedLivery={selectedLivery}
          quickClass={quickClass}
          quickLaps={quickLaps}
          career={careerProgress}
          muted={muted}
          bgmEnabled={bgmEnabled}
          touchEnabled={touchEnabled}
          onChangeRiderName={(name) => {
            setRiderName(name);
            lanRef.current?.updatePlayer({ name });
          }}
          onSelectLivery={(liv) => {
            setSelectedLivery(liv);
            lanRef.current?.updatePlayer({ liveryId: liv.id });
          }}
          onSelectQuickClass={setQuickClass}
          onSelectQuickLaps={setQuickLaps}
          onToggleMute={() => {
            const next = sceneRef.current?.getAudio().toggleMute() ?? !muted;
            setMuted(next);
          }}
          onToggleBgm={() => {
            const next = sceneRef.current?.getAudio().toggleBgm() ?? !bgmEnabled;
            setBgmEnabled(next);
          }}
          onToggleTouch={() => setTouchEnabled((v) => !v)}
          onResetCareer={() => setCareerProgress(resetCareerProgress())}
          onOpenAndroid={() => setAndroidOpen(true)}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {androidOpen && <AndroidApkModal onClose={() => setAndroidOpen(false)} />}
    </main>
  );
}
