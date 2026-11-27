import { useCallback, useEffect, useRef, useState } from 'react';
import { CareerModal } from './components/CareerModal';
import { LanLobbyModal } from './components/LanLobbyModal';
import { QuickRaceModal } from './components/QuickRaceModal';
import { RaceHud } from './components/RaceHud';
import {
  FinishModal,
  PauseModal,
  PodiumCeremonyOverlay,
  type CareerFinishOutcome,
} from './components/RaceModals';
import { SettingsModal } from './components/SettingsModal';
import { TitleScreen } from './components/TitleScreen';
import { TouchControls } from './components/TouchControls';
import {
  applyCareerRaceOutcome,
  buildQualifyingClassification,
  DEFAULT_RACE_RIDER_COUNT,
  getActiveCareerRound,
  loadCareerProgress,
  resetCareerProgress,
  saveCareerProgress,
  type CareerProgress,
} from './game/career';
import {
  buildPostRaceCommentary,
  buildPreRaceCommentary,
  speakCommentaryText,
  stopCommentarySpeech,
} from './game/commentary';
import { MotoGPScene, type RaceStartConfig } from './game/MotoGPScene';
import { clampSteeringSensitivity, DEFAULT_STEERING_SENSITIVITY } from './game/physics';
import { CIRCUIT_SPECS } from './game/trackMath';
import {
  getClassLiveries,
  getLiveryById,
  MOTO2_RIDERS,
  MOTO3_RIDERS,
  MOTOGP_RIDERS,
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
  preRaceActive: false,
  circuitName: 'Lusail International Circuit',
  localLiveryId: MOTOGP_RIDERS[0].id,
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
  weatherPhase: 'clear',
  rainIntensity: 0,
  onRainPatch: false,
  rainPatches: [],
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
  const [activeBikeClass, setActiveBikeClass] = useState<BikeClassId>('motogp');
  const [liveryByClass, setLiveryByClass] = useState<Record<BikeClassId, TeamLivery>>({
    moto3: MOTO3_RIDERS[0],
    moto2: MOTO2_RIDERS[0],
    motogp: MOTOGP_RIDERS[0],
  });
  const [riderName, setRiderName] = useState('Rider 1');
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [muted, setMuted] = useState(false);
  const [bgmEnabled, setBgmEnabled] = useState(true);
  const [steeringSensitivity, setSteeringSensitivity] = useState<number>(() => {
    if (typeof window === 'undefined') return DEFAULT_STEERING_SENSITIVITY;
    try {
      const saved = window.localStorage.getItem('apexgp_steer_sens_v1');
      if (saved !== null) return clampSteeringSensitivity(Number(saved));
    } catch {
      // ignore storage errors
    }
    return DEFAULT_STEERING_SENSITIVITY;
  });
  const [cameraMode, setCameraMode] = useState<CameraMode>('chase');
  const [touchEnabled, setTouchEnabled] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768
      : false,
  );
  const [results, setResults] = useState<RaceResultEntry[]>([]);
  const [showPodiumBanner, setShowPodiumBanner] = useState(false);
  const [activeRaceIsCareer, setActiveRaceIsCareer] = useState(false);
  const [activeSessionType, setActiveSessionType] = useState<SessionType>('race');
  const [careerOutcome, setCareerOutcome] = useState<CareerFinishOutcome | null>(null);
  const [weatherHadRain, setWeatherHadRain] = useState(false);
  const [commentarySpeaking, setCommentarySpeaking] = useState(false);

  // Modal state
  const [quickRaceOpen, setQuickRaceOpen] = useState(false);
  const [careerOpen, setCareerOpen] = useState(false);
  const [lanOpen, setLanOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // LAN state
  const [lanConnected, setLanConnected] = useState(false);
  const [lanClientId, setLanClientId] = useState<string | null>(null);
  const [wsUrl, setWsUrl] = useState(() => getDefaultWsUrl());
  const [lanRoom, setLanRoom] = useState<LanRoomState | null>(null);
  const [openRooms, setOpenRooms] = useState<OpenRoomSummary[]>([]);
  const [lanError, setLanError] = useState<string | null>(null);
  const [isLanRace, setIsLanRace] = useState(false);

  const weatherHadRainRef = useRef(false);
  const preRaceSpokenRef = useRef(false);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const selectedLivery = liveryByClass[quickClass];
  const careerLivery = liveryByClass[careerProgress.activeClass];

  const selectLiveryForClass = useCallback((bikeClass: BikeClassId, livery: TeamLivery) => {
    setLiveryByClass((prev) => ({ ...prev, [bikeClass]: livery }));
  }, []);

  // Mirror game state to document.body.dataset.state
  useEffect(() => {
    document.body.dataset.state = gameState;
    sceneRef.current?.setGameState(gameState);
    if (gameState !== 'playing' && gameState !== 'gameover') {
      stopCommentarySpeech();
    }
  }, [gameState]);

  // Keep 3D Title showcase bike & circuit synced with selected livery, class & circuit
  useEffect(() => {
    if (gameState !== 'title') return;
    const showcaseClass = careerOpen ? careerProgress.activeClass : quickClass;
    const showcaseLivery = liveryByClass[showcaseClass];
    sceneRef.current?.updateShowcaseBike(showcaseLivery, showcaseClass, selectedCircuit);
    sceneRef.current?.applySkyMood(CIRCUIT_SPECS[selectedCircuit].skyMood);
  }, [gameState, quickClass, careerOpen, careerProgress.activeClass, liveryByClass, selectedCircuit]);

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
      const classRoster = getClassLiveries(opts.bikeClass);
      const playerLivery = liveryByClass[opts.bikeClass] ?? classRoster[0];
      const riderCount = Math.max(2, Math.min(classRoster.length, opts.riderCount ?? DEFAULT_RACE_RIDER_COUNT));
      const localDisplayName = playerLivery.riderName || riderName || 'You';
      const playerParticipant = {
        id: 'local',
        name: localDisplayName,
        livery: playerLivery,
        bikeClass: opts.bikeClass,
        isPlayer: true,
        isRemote: false,
        isAi: false,
      };

      let participants: RaceStartConfig['participants'];
      if (sessionType === 'qualifying') {
        participants = [playerParticipant];
      } else {
        const defaultAiPool = classRoster.filter((l) => l.id !== playerLivery.id);
        const orderedAi: TeamLivery[] = [];
        if (opts.orderedAiLiveryIds && opts.orderedAiLiveryIds.length > 0) {
          const seen = new Set<string>([playerLivery.id]);
          for (const lid of opts.orderedAiLiveryIds) {
            const found = classRoster.find((l) => l.id === lid);
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
        localLivery: playerLivery,
        participants,
      };

      stopCommentarySpeech();
      weatherHadRainRef.current = false;
      preRaceSpokenRef.current = false;
      setWeatherHadRain(false);
      setCommentarySpeaking(false);
      setIsLanRace(false);
      setShowPodiumBanner(false);
      setActiveCircuitId(opts.circuitId);
      setActiveBikeClass(opts.bikeClass);
      setActiveRaceIsCareer(opts.mode === 'career');
      setActiveSessionType(sessionType);
      setCareerOutcome(null);
      setQuickRaceOpen(false);
      setCareerOpen(false);
      setLanOpen(false);
      setSettingsOpen(false);
      document.body.dataset.state = 'playing';
      setGameState('playing');
      sceneRef.current?.startRace(config);
    },
    [liveryByClass, riderName],
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
      const classRoster = getClassLiveries(roomClass);
      const participants: RaceStartConfig['participants'] = room.players.map((p) => {
        const liv = getLiveryById(p.liveryId, roomClass);
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
        const avail = classRoster.filter((l) => !usedLiveries.has(l.id));
        let aiIdx = 0;
        while (participants.length < DEFAULT_RACE_RIDER_COUNT) {
          const liv = avail[aiIdx % avail.length] ?? classRoster[aiIdx % classRoster.length];
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
      stopCommentarySpeech();
      weatherHadRainRef.current = false;
      preRaceSpokenRef.current = false;
      setWeatherHadRain(false);
      setCommentarySpeaking(false);
      setIsLanRace(true);
      setShowPodiumBanner(false);
      setActiveCircuitId(roomCircuit);
      setActiveBikeClass(roomClass);
      setActiveRaceIsCareer(false);
      setActiveSessionType('race');
      setCareerOutcome(null);
      setQuickRaceOpen(false);
      setCareerOpen(false);
      setLanOpen(false);
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
    activeCircuitId,
    activeBikeClass,
    careerProgress,
    liveryByClass,
  });
  callbacksRef.current = {
    startLanRaceFromRoom,
    isLanRace,
    gameState,
    activeRaceIsCareer,
    activeSessionType,
    activeCircuitId,
    activeBikeClass,
    careerProgress,
    liveryByClass,
  };

  // Mount WebGL canvas once
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const scene = new MotoGPScene(mount, {
      onHudUpdate: (snapshot) => {
        setHud(snapshot);
        if ((snapshot.weatherPhase === 'rain' || snapshot.rainPatches.length > 0) && !weatherHadRainRef.current) {
          weatherHadRainRef.current = true;
          setWeatherHadRain(true);
        }
        if (snapshot.preRaceActive && !preRaceSpokenRef.current) {
          preRaceSpokenRef.current = true;
          const liv = getLiveryById(snapshot.localLiveryId, snapshot.bikeClass);
          const pre = buildPreRaceCommentary({
            circuitId: callbacksRef.current.activeCircuitId,
            bikeClass: snapshot.bikeClass,
            sessionType: snapshot.sessionType,
            playerLivery: liv,
            playerGridPos: snapshot.rank,
            totalRiders: snapshot.totalRiders,
            weatherPhase: snapshot.weatherPhase,
          });
          sceneRef.current?.getAudio().playBroadcastChime();
          speakCommentaryText(`${pre.headline}. ${pre.lines.join(' ')}`, mutedRef.current, {
            onDone: () => {
              sceneRef.current?.skipPreRace();
            },
          });
        } else if (!snapshot.preRaceActive && preRaceSpokenRef.current) {
          preRaceSpokenRef.current = false;
        }
      },
      onRaceFinish: (res) => {
        const hadRain = weatherHadRainRef.current;
        if (callbacksRef.current.activeRaceIsCareer && callbacksRef.current.activeSessionType === 'qualifying') {
          const playerEntry = res.find((r) => r.isPlayer) ?? res[0];
          const curProg = callbacksRef.current.careerProgress;
          const round = getActiveCareerRound(curProg);
          const fallbackLiv = callbacksRef.current.liveryByClass[curProg.activeClass];
          const quali = buildQualifyingClassification({
            circuitId: round.circuitId,
            bikeClass: curProg.activeClass,
            aiDifficulty: round.aiDifficulty,
            playerLivery: playerEntry?.livery ?? fallbackLiv,
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
          setShowPodiumBanner(false);
          setCommentarySpeaking(true);
          setGameState('gameover');

          const qualiComm = buildPostRaceCommentary({
            circuitId: round.circuitId,
            bikeClass: curProg.activeClass,
            sessionType: 'qualifying',
            results: quali.results,
            weatherHadRain: hadRain,
          });
          sceneRef.current?.getAudio().playBroadcastChime();
          speakCommentaryText(`${qualiComm.headline}. ${qualiComm.lines.join(' ')}`, mutedRef.current, {
            onDone: () => setCommentarySpeaking(false),
          });
          return;
        }

        setResults(res);
        let finishCareerSummary: {
          pointsEarned: number;
          seasonRank: number;
          promotedTo: BikeClassId | null;
          wonChampionship: boolean;
        } | null = null;

        if (callbacksRef.current.activeRaceIsCareer) {
          const curCareer = callbacksRef.current.careerProgress;
          const classPlayed = curCareer.activeClass;
          const playerLiv = callbacksRef.current.liveryByClass[classPlayed];
          const outcome = applyCareerRaceOutcome(curCareer, res, playerLiv);
          saveCareerProgress(outcome.updated);
          setCareerProgress(outcome.updated);
          finishCareerSummary = {
            pointsEarned: outcome.pointsEarned,
            seasonRank: outcome.seasonRank,
            promotedTo: outcome.promotedTo,
            wonChampionship: outcome.wonChampionship,
          };
          setCareerOutcome({
            classPlayed,
            pointsEarned: outcome.pointsEarned,
            seasonRank: outcome.seasonRank,
            promotedTo: outcome.promotedTo,
            seasonFinished: outcome.seasonFinished,
            wonChampionship: outcome.wonChampionship,
            updatedProgress: outcome.updated,
          });
        } else {
          setCareerOutcome(null);
        }

        const postComm = buildPostRaceCommentary({
          circuitId: callbacksRef.current.activeCircuitId,
          bikeClass: callbacksRef.current.activeBikeClass,
          sessionType: 'race',
          results: res,
          weatherHadRain: hadRain,
          careerOutcome: finishCareerSummary,
        });
        sceneRef.current?.getAudio().playBroadcastChime();
        setCommentarySpeaking(true);
        speakCommentaryText(`${postComm.headline}. ${postComm.lines.join(' ')}`, mutedRef.current, {
          onDone: () => setCommentarySpeaking(false),
        });

        setShowPodiumBanner(true);
        setGameState('gameover');
      },
      onLocalTelemetry: (state) => {
        lanRef.current?.sendTelemetry(state);
      },
      onTogglePause: () => {
        stopCommentarySpeech();
        setGameState((prev) => (prev === 'playing' ? 'paused' : prev === 'paused' ? 'playing' : prev));
      },
      onCameraModeChange: (mode) => {
        setCameraMode(mode);
      },
    });
    scene.setSteeringSensitivity(steeringSensitivity);
    sceneRef.current = scene;

    // Support ?autostart=1 and ?podium=1
    const params = new URLSearchParams(window.location.search);
    if (params.get('podium') === '1') {
      window.setTimeout(() => {
        scene.previewPodium();
      }, 80);
    } else if (params.get('autostart') === '1') {
      window.setTimeout(() => {
        startCareerRace();
      }, 60);
    }

    return () => {
      stopCommentarySpeech();
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
          if (quickRaceOpen || careerOpen || settingsOpen || lanOpen) {
            e.preventDefault();
            setQuickRaceOpen(false);
            setCareerOpen(false);
            setSettingsOpen(false);
            setLanOpen(false);
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
        if (!quickRaceOpen && !careerOpen && !lanOpen && !settingsOpen) {
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
      } else if (gameState === 'playing' && hud.preRaceActive) {
        if (e.code === 'Space' || e.code === 'Enter') {
          stopCommentarySpeech();
        }
      } else if (gameState === 'gameover' && commentarySpeaking) {
        if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') {
          e.preventDefault();
          stopCommentarySpeech();
          setCommentarySpeaking(false);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameState, quickRaceOpen, careerOpen, lanOpen, settingsOpen, startQuickRace, hud.preRaceActive, commentarySpeaking]);

  const handleTouchChange = useCallback((partial: Partial<RiderInput>) => {
    sceneRef.current?.setTouchInput(partial);
  }, []);

  const preferredLanClass: BikeClassId = quickClass;
  const lanActiveClass: BikeClassId = lanRoom?.bikeClass ?? preferredLanClass;
  const lanSelectedLivery = liveryByClass[lanActiveClass];

  const handlePlayAgainFromResult = () => {
    stopCommentarySpeech();
    setShowPodiumBanner(false);
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
  };

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
          accentHex={(careerOpen ? careerLivery : selectedLivery).primaryHex}
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
              if (next) stopCommentarySpeech();
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
            onPause={() => {
              stopCommentarySpeech();
              setGameState('paused');
            }}
          />
          {touchEnabled && !hud.preRaceActive && <TouchControls onChange={handleTouchChange} />}
        </>
      )}

      {gameState === 'paused' && (
        <PauseModal
          onResume={() => setGameState('playing')}
          onRestart={() => {
            stopCommentarySpeech();
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
            stopCommentarySpeech();
            setCommentarySpeaking(false);
            setIsLanRace(false);
            setShowPodiumBanner(false);
            setActiveRaceIsCareer(false);
            setActiveSessionType('race');
            setGameState('title');
          }}
        />
      )}

      {/* During post-race male commentary speaking: pure 3D podium scene with zero text layer */}
      {gameState === 'gameover' && !commentarySpeaking && showPodiumBanner && activeSessionType === 'race' && (
        <PodiumCeremonyOverlay
          circuitId={activeCircuitId}
          bikeClass={activeBikeClass}
          weatherHadRain={weatherHadRain}
          results={results}
          isLan={isLanRace}
          careerOutcome={careerOutcome}
          onViewClassification={() => setShowPodiumBanner(false)}
          onPlayAgain={handlePlayAgainFromResult}
        />
      )}

      {gameState === 'gameover' && !commentarySpeaking && (!showPodiumBanner || activeSessionType === 'qualifying') && (
        <FinishModal
          circuitId={activeCircuitId}
          bikeClass={activeBikeClass}
          weatherHadRain={weatherHadRain}
          sessionType={activeSessionType}
          results={results}
          isLan={isLanRace}
          careerOutcome={careerOutcome}
          onPlayAgain={handlePlayAgainFromResult}
          onExitTitle={() => {
            stopCommentarySpeech();
            setCommentarySpeaking(false);
            const wasQualifying = activeRaceIsCareer && activeSessionType === 'qualifying';
            setShowPodiumBanner(false);
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
          selectedLivery={lanSelectedLivery}
          preferredClass={preferredLanClass}
          onChangeName={(name) => {
            setRiderName(name);
            lanRef.current?.updatePlayer({ name });
          }}
          onSelectLivery={(liv) => {
            selectLiveryForClass(lanActiveClass, liv);
            lanRef.current?.updatePlayer({ liveryId: liv.id });
          }}
          onChangeWsUrl={(url) => {
            setWsUrl(url);
            setLanError(null);
            lanRef.current?.connect(url);
          }}
          onCreateRoom={() => {
            setLanError(null);
            lanRef.current?.createRoom(riderName, lanSelectedLivery.id, preferredLanClass, selectedCircuit);
          }}
          onJoinRoom={(code) => {
            setLanError(null);
            lanRef.current?.joinRoom(code, riderName, lanSelectedLivery.id);
          }}
          onLeaveRoom={() => lanRef.current?.leaveRoom()}
          onToggleReady={() => {
            const me = lanRoom?.players.find((p) => p.id === lanClientId);
            lanRef.current?.updatePlayer({ ready: !me?.ready });
          }}
          onUpdateSettings={(patch) => {
            lanRef.current?.updateSettings(patch);
            if (patch.bikeClass) {
              const nextLiv = liveryByClass[patch.bikeClass];
              lanRef.current?.updatePlayer({ liveryId: nextLiv.id });
            }
          }}
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
          onSelectLivery={(liv) => selectLiveryForClass(quickClass, liv)}
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
          selectedLivery={careerLivery}
          onSelectLivery={(liv) => selectLiveryForClass(careerProgress.activeClass, liv)}
          onStartQualifying={startCareerQualifying}
          onStartNextRound={() => startCareerRace()}
          onResetCareer={() => setCareerProgress(resetCareerProgress())}
          onClose={() => setCareerOpen(false)}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          muted={muted}
          bgmEnabled={bgmEnabled}
          steeringSensitivity={steeringSensitivity}
          onToggleMute={() => {
            const next = sceneRef.current?.getAudio().toggleMute() ?? !muted;
            if (next) stopCommentarySpeech();
            setMuted(next);
          }}
          onToggleBgm={() => {
            const next = sceneRef.current?.getAudio().toggleBgm() ?? !bgmEnabled;
            setBgmEnabled(next);
          }}
          onChangeSteeringSensitivity={(val) => {
            const clamped = clampSteeringSensitivity(val);
            setSteeringSensitivity(clamped);
            sceneRef.current?.setSteeringSensitivity(clamped);
            try {
              window.localStorage.setItem('apexgp_steer_sens_v1', String(clamped));
            } catch {
              // ignore storage errors
            }
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </main>
  );
}
