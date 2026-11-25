import { useCallback, useEffect, useRef, useState } from 'react';
import { AndroidApkModal } from './components/AndroidApkModal';
import { LanLobbyModal } from './components/LanLobbyModal';
import { RaceHud } from './components/RaceHud';
import { FinishModal, PauseModal, type CareerFinishOutcome } from './components/RaceModals';
import { TitleScreen, type MainMenuTab } from './components/TitleScreen';
import { TouchControls } from './components/TouchControls';
import {
  applyCareerRaceOutcome,
  findPlayerRankFromResults,
  getActiveCareerRound,
  loadCareerProgress,
  resetCareerProgress,
  saveCareerProgress,
  type CareerProgress,
} from './game/career';
import { MotoGPScene, type RaceStartConfig } from './game/MotoGPScene';
import {
  TEAM_LIVERIES,
  type BikeClassId,
  type CameraMode,
  type GameScreenState,
  type HudSnapshot,
  type LanRoomState,
  type RaceResultEntry,
  type RiderInput,
  type TeamLivery,
} from './game/types';
import { getDefaultWsUrl, LanMultiplayerClient, type OpenRoomSummary } from './net/lanClient';

const INITIAL_HUD: HudSnapshot = {
  speedKmh: 0,
  gear: 1,
  rpmRatio: 0.1,
  boostFuel: 100,
  isBoosting: false,
  lap: 1,
  totalLaps: 3,
  rank: 1,
  totalRiders: 4,
  raceTimeMs: 0,
  currentLapMs: 0,
  bestLapMs: null,
  countdownStage: 3,
  surface: 'asphalt',
  wrongWay: false,
  bikeClass: 'motogp',
  minimapRiders: [],
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<MotoGPScene | null>(null);
  const lanRef = useRef<LanMultiplayerClient | null>(null);

  const [gameState, setGameState] = useState<GameScreenState>('title');
  const [menuTab, setMenuTab] = useState<MainMenuTab>('career');
  const [careerProgress, setCareerProgress] = useState<CareerProgress>(() => loadCareerProgress());
  const [quickClass, setQuickClass] = useState<BikeClassId>('motogp');
  const [quickLaps, setQuickLaps] = useState<number>(3);
  const [selectedLivery, setSelectedLivery] = useState<TeamLivery>(TEAM_LIVERIES[0]);
  const [riderName, setRiderName] = useState('Rider 1');
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [muted, setMuted] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>('chase');
  const [touchEnabled, setTouchEnabled] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768
      : false,
  );
  const [results, setResults] = useState<RaceResultEntry[]>([]);
  const [activeRaceIsCareer, setActiveRaceIsCareer] = useState(false);
  const [careerOutcome, setCareerOutcome] = useState<CareerFinishOutcome | null>(null);

  // Modal state
  const [lanOpen, setLanOpen] = useState(false);
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

  // Keep 3D Title showcase bike synced with selected livery & previewed class
  useEffect(() => {
    if (gameState !== 'title') return;
    const previewClass = menuTab === 'career' ? careerProgress.activeClass : quickClass;
    sceneRef.current?.updateShowcaseBike(selectedLivery, previewClass);
    const mood = menuTab === 'career' ? getActiveCareerRound(careerProgress).skyMood : 'sunny';
    sceneRef.current?.applySkyMood(mood);
  }, [gameState, menuTab, careerProgress, quickClass, selectedLivery]);

  const launchSinglePlayerRace = useCallback(
    (opts: {
      mode: 'career' | 'solo';
      bikeClass: BikeClassId;
      totalLaps: number;
      aiDifficulty: number;
      skyMood: 'sunny' | 'sunset' | 'overcast';
    }) => {
      const usedIds = new Set([selectedLivery.id]);
      const aiLiveries = TEAM_LIVERIES.filter((l) => !usedIds.has(l.id));
      const aiNames = ['M. Rossi', 'F. Bagnaia', 'K. Nakagami'];

      const config: RaceStartConfig = {
        mode: opts.mode,
        bikeClass: opts.bikeClass,
        totalLaps: opts.totalLaps,
        skyMood: opts.skyMood,
        localRiderId: 'local',
        localRiderName: riderName,
        localLivery: selectedLivery,
        participants: [
          {
            id: 'local',
            name: riderName || 'You',
            livery: selectedLivery,
            bikeClass: opts.bikeClass,
            isPlayer: true,
            isRemote: false,
            isAi: false,
          },
          ...aiNames.map((name, i) => ({
            id: `ai-${i + 1}`,
            name,
            livery: aiLiveries[i % aiLiveries.length],
            bikeClass: opts.bikeClass,
            aiPaceFactor: opts.aiDifficulty + (i % 3) * 0.035,
            isPlayer: false,
            isRemote: false,
            isAi: true,
          })),
        ],
      };

      setIsLanRace(false);
      setActiveRaceIsCareer(opts.mode === 'career');
      setCareerOutcome(null);
      setLanOpen(false);
      setAndroidOpen(false);
      document.body.dataset.state = 'playing';
      setGameState('playing');
      sceneRef.current?.startRace(config);
    },
    [riderName, selectedLivery],
  );

  const startCareerRace = useCallback(() => {
    const round = getActiveCareerRound(careerProgress);
    launchSinglePlayerRace({
      mode: 'career',
      bikeClass: careerProgress.activeClass,
      totalLaps: round.laps,
      aiDifficulty: round.aiDifficulty,
      skyMood: round.skyMood,
    });
  }, [careerProgress, launchSinglePlayerRace]);

  const startQuickRace = useCallback(() => {
    launchSinglePlayerRace({
      mode: 'solo',
      bikeClass: quickClass,
      totalLaps: quickLaps,
      aiDifficulty: 0.86,
      skyMood: 'sunny',
    });
  }, [launchSinglePlayerRace, quickClass, quickLaps]);

  const startLanRaceFromRoom = useCallback(
    (room: LanRoomState) => {
      const myId = lanRef.current?.getClientId() || lanClientId || 'local';
      const roomClass: BikeClassId = room.bikeClass ?? 'motogp';
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

      if (room.fillWithAi && participants.length < 4) {
        const usedLiveries = new Set(participants.map((p) => p.livery.id));
        const avail = TEAM_LIVERIES.filter((l) => !usedLiveries.has(l.id));
        let aiIdx = 0;
        while (participants.length < 4) {
          participants.push({
            id: `ai-${aiIdx + 1}`,
            name: `GP AI #${aiIdx + 1}`,
            livery: avail[aiIdx % avail.length] ?? TEAM_LIVERIES[aiIdx % TEAM_LIVERIES.length],
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
      setActiveRaceIsCareer(false);
      setCareerOutcome(null);
      setLanOpen(false);
      setAndroidOpen(false);
      document.body.dataset.state = 'playing';
      setGameState('playing');
      sceneRef.current?.startRace({
        mode: 'lan',
        bikeClass: roomClass,
        totalLaps: room.totalLaps,
        skyMood: 'sunny',
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
    careerProgress,
  });
  callbacksRef.current = {
    startLanRaceFromRoom,
    isLanRace,
    gameState,
    activeRaceIsCareer,
    careerProgress,
  };

  // Mount WebGL canvas once
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const scene = new MotoGPScene(mount, {
      onHudUpdate: (snapshot) => setHud(snapshot),
      onRaceFinish: (res) => {
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

  // Enter / Space starts from Title; Esc / P toggles Pause during play
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (gameState === 'title' && !lanOpen && !androidOpen) {
        if (e.code === 'Enter' || e.code === 'Space') {
          const activeTag = document.activeElement?.tagName;
          if (activeTag === 'INPUT' || activeTag === 'SELECT') return;
          e.preventDefault();
          if (menuTab === 'career') startCareerRace();
          else startQuickRace();
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
  }, [gameState, lanOpen, androidOpen, menuTab, startCareerRace, startQuickRace]);

  const handleTouchChange = useCallback((partial: Partial<RiderInput>) => {
    sceneRef.current?.setTouchInput(partial);
  }, []);

  const preferredLanClass: BikeClassId =
    menuTab === 'career' ? careerProgress.activeClass : quickClass;

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
          activeTab={menuTab}
          onChangeTab={setMenuTab}
          career={careerProgress}
          selectedLivery={selectedLivery}
          quickClass={quickClass}
          quickLaps={quickLaps}
          onSelectLivery={setSelectedLivery}
          onSelectQuickClass={setQuickClass}
          onSelectQuickLaps={setQuickLaps}
          onStartCareerRace={startCareerRace}
          onStartQuickRace={startQuickRace}
          onResetCareer={() => setCareerProgress(resetCareerProgress())}
          onOpenLan={() => setLanOpen(true)}
          onOpenAndroid={() => setAndroidOpen(true)}
        />
      )}

      {gameState === 'playing' && (
        <>
          <RaceHud
            hud={hud}
            muted={muted}
            cameraMode={cameraMode}
            touchEnabled={touchEnabled}
            onToggleMute={() => {
              const next = sceneRef.current?.getAudio().toggleMute() ?? !muted;
              setMuted(next);
            }}
            onCycleCamera={() => {
              const next = sceneRef.current?.cycleCameraMode() ?? 'chase';
              setCameraMode(next);
            }}
            onToggleTouch={() => setTouchEnabled((v) => !v)}
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
              startCareerRace();
            } else {
              startQuickRace();
            }
          }}
          onExitTitle={() => {
            setIsLanRace(false);
            setActiveRaceIsCareer(false);
            setGameState('title');
          }}
        />
      )}

      {gameState === 'gameover' && (
        <FinishModal
          results={results}
          isLan={isLanRace}
          careerOutcome={careerOutcome}
          onPlayAgain={() => {
            if (isLanRace) {
              lanRef.current?.returnToLobby();
              setGameState('title');
              setLanOpen(true);
            } else if (activeRaceIsCareer) {
              startCareerRace();
            } else {
              startQuickRace();
            }
          }}
          onExitTitle={() => {
            setIsLanRace(false);
            setActiveRaceIsCareer(false);
            setGameState('title');
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
            lanRef.current?.createRoom(riderName, selectedLivery.id, preferredLanClass);
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

      {androidOpen && <AndroidApkModal onClose={() => setAndroidOpen(false)} />}
    </main>
  );
}
