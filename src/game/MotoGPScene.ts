import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { MotoAudioEngine } from './audio';
import { animateBikeRiderPose, BikeVisualRig, createMotoBikeRig } from './bikeMesh';
import {
  animatePodiumCeremony,
  createPodiumStage,
  type PodiumStage,
  type PodiumWinnerSlot,
} from './podiumMesh';
import {
  clampSteeringSensitivity,
  computeAiInput,
  computeSteerInputStep,
  createInitialBikeState,
  DEFAULT_STEERING_SENSITIVITY,
  normalizeAngle,
  resetBikeToTrack,
  resolveBikeCollisions,
  stepBikePhysics,
  updateRaceRankings,
  updateSlipstreamStatus,
} from './physics';
import { createProceduralTextures, ProceduralTextures } from './textures';
import { createTrackWorld, TrackWorld } from './trackMesh';
import { CircuitData, getCircuit, sampleTrackAtS, START_LINE_S } from './trackMath';
import {
  BIKE_CLASSES,
  type BikeClassId,
  BikeState,
  CameraMode,
  type CircuitId,
  GameScreenState,
  getClassLiveries,
  HudSnapshot,
  RaceResultEntry,
  RiderInput,
  RiderNetState,
  type SessionType,
  TEAM_LIVERIES,
  TeamLivery,
} from './types';
import {
  createInitialWeatherState,
  type DynamicWeatherState,
  stepDynamicWeather,
} from './weather';

export interface RaceStartConfig {
  mode: 'solo' | 'lan' | 'career';
  sessionType?: SessionType;
  bikeClass: BikeClassId;
  circuitId?: CircuitId;
  totalLaps: number;
  skyMood?: 'sunny' | 'sunset' | 'overcast';
  localRiderId: string;
  localRiderName: string;
  localLivery: TeamLivery;
  participants: Array<{
    id: string;
    name: string;
    livery: TeamLivery;
    bikeClass?: BikeClassId;
    aiPaceFactor?: number;
    isPlayer: boolean;
    isRemote: boolean;
    isAi: boolean;
  }>;
}

export interface SceneCallbacks {
  onHudUpdate: (hud: HudSnapshot) => void;
  onRaceFinish: (results: RaceResultEntry[]) => void;
  onLocalTelemetry?: (state: RiderNetState) => void;
  onTogglePause?: () => void;
  onCameraModeChange?: (mode: CameraMode) => void;
}

// Pre-allocated scratch vectors outside animation loop (zero GC)
const _camTargetPos = new THREE.Vector3();
const _camLookAt = new THREE.Vector3();
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

interface ParticleSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  scale: number;
  colorHex: number;
}

export class MotoGPScene {
  private container: HTMLElement;
  private callbacks: SceneCallbacks;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private circuit: CircuitData;
  private textures: ProceduralTextures;
  private trackWorld: TrackWorld;
  private audio: MotoAudioEngine;
  private isSoftwareGl: boolean;

  private bikeRigs = new Map<string, BikeVisualRig>();
  private bikes: BikeState[] = [];
  private localBikeId = 'local';
  private totalLaps = 3;
  private gameState: GameScreenState = 'title';
  private cameraMode: CameraMode = 'chase';
  private raceMode: 'solo' | 'lan' | 'career' = 'solo';
  private sessionType: SessionType = 'race';

  private sky!: Sky;
  private sunLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;

  private preRaceTimer = 0;
  private preRaceDuration = 3.0;
  private countdownTimer = 3.2;
  private lastCountdownStage = 4;
  private raceElapsedMs = 0;
  private trauma = 0;
  private hitstopTimer = 0;
  private lastHudEmit = 0;
  private lastNetEmit = 0;
  private titlePanTime = 0;
  private crowdTimeSec = 0;
  private podiumTimeSec = 0;
  private podiumStage: PodiumStage | null = null;
  private podiumOrigin = new THREE.Vector3();
  private wasBoosting = false;
  private prevLocalRank = 1;

  // Input state
  private keys = new Set<string>();
  private touchInput: RiderInput = { throttle: 0, brake: 0, steer: 0, boost: false };
  private steeringSensitivity = DEFAULT_STEERING_SENSITIVITY;
  private smoothedSteer = 0;

  // Pooled InstancedMesh particles (smoke, gravel, sparks, water spray)
  private particleMesh: THREE.InstancedMesh;
  private particles: ParticleSlot[] = [];
  private particleCursor = 0;

  // Dynamic Weather System (Clear -> Clouds -> Rain Patches + pooled falling rain streaks)
  private baseSkyMood: 'sunny' | 'sunset' | 'overcast' = 'sunny';
  private weatherState: DynamicWeatherState = createInitialWeatherState();
  private rainLines: THREE.LineSegments;
  private rainPositions: Float32Array;
  private rainCount = 220;

  // Frame loop handles
  private frameId = 0;
  private disposed = false;
  private lastTime = performance.now();
  private resizeObserver: ResizeObserver;
  private envMap: THREE.Texture;

  constructor(container: HTMLElement, callbacks: SceneCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.circuit = getCircuit('lusail');
    this.audio = new MotoAudioEngine();

    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const horizonHex = 0xcfe2f3;
    this.scene.background = new THREE.Color(horizonHex);
    this.scene.fog = new THREE.FogExp2(horizonHex, 0.0013);

    this.camera = new THREE.PerspectiveCamera(62, width / height, 0.45, 1600);

    // Procedural studio reflections for bike metallic alloys & visor clearcoat
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envMap;
    pmrem.dispose();

    // Daylight Sky Dome
    this.sky = new Sky();
    this.sky.scale.setScalar(2600);
    this.scene.add(this.sky);

    // Warm/cool 3-point outdoor lighting rig
    this.hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x3f6212, 0.72);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff4dc, 2.2);
    this.sunLight.position.set(110, 145, 80);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 20;
    this.sunLight.shadow.camera.far = 420;
    const d = 140;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);

    const rimLight = new THREE.DirectionalLight(0xbae6fd, 0.6);
    rimLight.position.set(-90, 60, -110);
    this.scene.add(rimLight);

    this.applySkyMood('sunny');

    // Procedural textures & circuit world
    this.textures = createProceduralTextures(this.renderer.capabilities.getMaxAnisotropy());
    this.trackWorld = createTrackWorld(this.circuit, this.textures);
    this.scene.add(this.trackWorld.group);

    // Pooled particle ring buffer (120 spheres)
    const pCount = 120;
    const pGeo = new THREE.IcosahedronGeometry(0.18, 0);
    const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.78 });
    this.particleMesh = new THREE.InstancedMesh(pGeo, pMat, pCount);
    this.particleMesh.frustumCulled = false;
    for (let i = 0; i < pCount; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 0.4,
        scale: 0,
        colorHex: 0xffffff,
      });
      _dummy.position.set(0, -50, 0);
      _dummy.scale.setScalar(0.001);
      _dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, _dummy.matrix);
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.particleMesh);

    // Pooled falling rain streaks around active camera
    this.rainPositions = new Float32Array(this.rainCount * 2 * 3);
    for (let i = 0; i < this.rainCount; i++) {
      const rx = (Math.random() - 0.5) * 44;
      const ry = Math.random() * 20;
      const rz = (Math.random() - 0.5) * 44;
      const base = i * 6;
      this.rainPositions[base] = rx;
      this.rainPositions[base + 1] = ry;
      this.rainPositions[base + 2] = rz;
      this.rainPositions[base + 3] = rx - 0.14;
      this.rainPositions[base + 4] = ry - 1.05;
      this.rainPositions[base + 5] = rz - 0.14;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));
    const rainMat = new THREE.LineBasicMaterial({
      color: 0xcbeafe,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    });
    this.rainLines = new THREE.LineSegments(rainGeo, rainMat);
    this.rainLines.visible = false;
    this.rainLines.frustumCulled = false;
    this.scene.add(this.rainLines);

    // Spawn full 22-rider showcase grid for Title Screen flyover
    const showcaseAi = TEAM_LIVERIES.slice(1, 22);
    this.setupGrid({
      mode: 'solo',
      bikeClass: 'motogp',
      totalLaps: 3,
      skyMood: 'sunny',
      localRiderId: 'local',
      localRiderName: TEAM_LIVERIES[0].riderName,
      localLivery: TEAM_LIVERIES[0],
      participants: [
        {
          id: 'local',
          name: TEAM_LIVERIES[0].riderName,
          livery: TEAM_LIVERIES[0],
          bikeClass: 'motogp',
          isPlayer: true,
          isRemote: false,
          isAi: false,
        },
        ...showcaseAi.map((liv, idx) => ({
          id: `ai-${idx + 1}`,
          name: liv.riderName,
          livery: liv,
          bikeClass: 'motogp' as BikeClassId,
          isPlayer: false,
          isRemote: false,
          isAi: true,
        })),
      ],
    });

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.stepTitleShowcase(0.016);
    this.renderer.render(this.scene, this.camera);

    // Event listeners (also unlock audio on first user pointer interaction for title BGM)
    window.addEventListener('pointerdown', this.handleFirstInteract, { passive: true });
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    document.addEventListener('visibilitychange', this.handleVisibility);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    this.startLoop();
  }

  public updateCallbacks(callbacks: SceneCallbacks): void {
    this.callbacks = callbacks;
  }

  public getAudio(): MotoAudioEngine {
    return this.audio;
  }

  public getCameraMode(): CameraMode {
    return this.cameraMode;
  }

  public cycleCameraMode(): CameraMode {
    const order: CameraMode[] = ['chase', 'helmet', 'tv'];
    const idx = order.indexOf(this.cameraMode);
    this.cameraMode = order[(idx + 1) % order.length];
    this.callbacks.onCameraModeChange?.(this.cameraMode);
    return this.cameraMode;
  }

  public setSteeringSensitivity(value: number): void {
    this.steeringSensitivity = clampSteeringSensitivity(value);
  }

  public getSteeringSensitivity(): number {
    return this.steeringSensitivity;
  }

  public setTouchInput(partial: Partial<RiderInput>): void {
    Object.assign(this.touchInput, partial);
  }

  public clearInputs(): void {
    this.keys.clear();
    this.touchInput = { throttle: 0, brake: 0, steer: 0, boost: false };
    this.smoothedSteer = 0;
  }

  public skipPreRace(): void {
    if (this.gameState !== 'playing' || this.preRaceTimer <= 0) return;
    this.preRaceTimer = 0;
    const localBike = this.bikes.find((b) => b.id === this.localBikeId) ?? this.bikes[0];
    if (localBike) {
      const fwdX = Math.sin(localBike.heading);
      const fwdZ = Math.cos(localBike.heading);
      this.camera.up.set(0, 1, 0);
      this.camera.position.set(localBike.x - fwdX * 4.2, 1.82, localBike.z - fwdZ * 4.2);
      this.camera.lookAt(localBike.x + fwdX * 14, 1.05, localBike.z + fwdZ * 14);
    }
    this.emitHudSnapshot(performance.now(), Math.ceil(this.countdownTimer), false, true);
  }

  public resetLocalBike(): void {
    if (this.gameState !== 'playing' || this.preRaceTimer > 0 || this.countdownTimer > 0.15) return;
    const localBike = this.bikes.find((b) => b.id === this.localBikeId) ?? this.bikes[0];
    if (!localBike || localBike.finished) return;

    resetBikeToTrack(localBike, this.circuit);
    this.trauma = 0;
    this.hitstopTimer = 0;
    this.wasBoosting = false;
    this.syncVisualRig(localBike, 0, 0, false);

    const fwdX = Math.sin(localBike.heading);
    const fwdZ = Math.cos(localBike.heading);
    this.camera.up.set(0, 1, 0);
    this.camera.position.set(localBike.x - fwdX * 4.2, 1.82, localBike.z - fwdZ * 4.2);
    this.camera.lookAt(localBike.x + fwdX * 14, 1.05, localBike.z + fwdZ * 14);
  }

  private clearPodiumStage(): void {
    if (this.podiumStage) {
      this.scene.remove(this.podiumStage.group);
      this.podiumStage.dispose();
      this.podiumStage = null;
    }
    for (const rig of this.bikeRigs.values()) {
      rig.root.visible = true;
    }
  }

  public setGameState(state: GameScreenState): void {
    this.gameState = state;
    if (state === 'title') {
      this.clearPodiumStage();
      this.audio.silenceEngine();
      this.audio.setBgmMode('title');
      this.clearInputs();
    } else if (state === 'playing') {
      this.clearPodiumStage();
      this.audio.unlock();
      this.audio.setBgmMode('race');
    } else {
      this.audio.silenceEngine();
      this.audio.setBgmMode('off');
      this.clearInputs();
    }
  }

  public applySkyMood(mood: 'sunny' | 'sunset' | 'overcast' = 'sunny'): void {
    this.baseSkyMood = mood;
    const skyUniforms = this.sky.material.uniforms;
    if (mood === 'sunset') {
      const sunVec = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(81), THREE.MathUtils.degToRad(132));
      skyUniforms['turbidity'].value = 7.5;
      skyUniforms['rayleigh'].value = 2.6;
      skyUniforms['mieCoefficient'].value = 0.008;
      skyUniforms['mieDirectionalG'].value = 0.86;
      skyUniforms['sunPosition'].value.copy(sunVec);
      this.sunLight.color.setHex(0xffb86c);
      this.sunLight.intensity = 2.1;
      this.hemiLight.color.setHex(0xfed7aa);
      this.hemiLight.intensity = 0.65;
      this.scene.background = new THREE.Color(0xe6b89c);
      this.scene.fog = new THREE.FogExp2(0xe6b89c, 0.0014);
    } else if (mood === 'overcast') {
      const sunVec = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(50), THREE.MathUtils.degToRad(150));
      skyUniforms['turbidity'].value = 9.0;
      skyUniforms['rayleigh'].value = 0.85;
      skyUniforms['mieCoefficient'].value = 0.012;
      skyUniforms['mieDirectionalG'].value = 0.72;
      skyUniforms['sunPosition'].value.copy(sunVec);
      this.sunLight.color.setHex(0xe2e8f0);
      this.sunLight.intensity = 1.65;
      this.hemiLight.color.setHex(0xcbd5e1);
      this.hemiLight.intensity = 0.85;
      this.scene.background = new THREE.Color(0xbcc9d8);
      this.scene.fog = new THREE.FogExp2(0xbcc9d8, 0.0016);
    } else {
      const sunVec = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(62), THREE.MathUtils.degToRad(140));
      skyUniforms['turbidity'].value = 4.5;
      skyUniforms['rayleigh'].value = 1.4;
      skyUniforms['mieCoefficient'].value = 0.004;
      skyUniforms['mieDirectionalG'].value = 0.82;
      skyUniforms['sunPosition'].value.copy(sunVec);
      this.sunLight.color.setHex(0xfff4dc);
      this.sunLight.intensity = 2.2;
      this.hemiLight.color.setHex(0xdbeafe);
      this.hemiLight.intensity = 0.72;
      this.scene.background = new THREE.Color(0xcfe2f3);
      this.scene.fog = new THREE.FogExp2(0xcfe2f3, 0.0013);
    }
  }

  public setCircuit(circuitId: CircuitId): void {
    if (this.circuit.id === circuitId) return;
    this.circuit = getCircuit(circuitId);
    this.scene.remove(this.trackWorld.group);
    this.trackWorld.dispose();
    this.trackWorld = createTrackWorld(this.circuit, this.textures);
    this.scene.add(this.trackWorld.group);
  }

  public startRace(config: RaceStartConfig): void {
    this.clearPodiumStage();
    this.audio.unlock();
    this.audio.setBgmMode('race');
    if (config.circuitId) {
      this.setCircuit(config.circuitId);
    }
    this.applySkyMood(config.skyMood ?? 'sunny');
    this.weatherState = createInitialWeatherState(Math.round(performance.now()) + config.participants.length * 97);
    this.trackWorld.syncRainPatches([], 0);
    this.rainLines.visible = false;
    this.setupGrid(config);
    this.gameState = 'playing';
    this.preRaceDuration = config.sessionType === 'qualifying' ? 7.5 : 11.5;
    this.preRaceTimer = this.preRaceDuration;
    this.countdownTimer = config.sessionType === 'qualifying' ? 1.6 : 2.4;
    this.lastCountdownStage = 4;
    this.raceElapsedMs = 0;
    this.trauma = 0;
    this.hitstopTimer = 0;
    this.wasBoosting = false;
    this.clearInputs();
    this.trackWorld.setStartLights(0, false);

    // Populate initial HUD & position camera on the before-race grid vista
    updateRaceRankings(this.bikes);
    const localBike = this.bikes.find((b) => b.id === this.localBikeId) ?? this.bikes[0];
    if (localBike) {
      this.prevLocalRank = localBike.rank;
    }
    this.updatePreRaceCamera(0);
    for (const bike of this.bikes) {
      this.syncVisualRig(bike, 0, 0, true);
    }
    this.emitHudSnapshot(performance.now(), -1, false, true);
    this.renderer.render(this.scene, this.camera);
  }

  public updateShowcaseBike(livery: TeamLivery, bikeClass: BikeClassId, circuitId?: CircuitId): void {
    if (this.gameState !== 'title') return;
    const circuitChanged = Boolean(circuitId && circuitId !== this.circuit.id);
    if (circuitId && circuitChanged) {
      this.setCircuit(circuitId);
    }
    const localBike = this.bikes.find((b) => b.id === this.localBikeId) ?? this.bikes[0];
    if (!localBike) return;
    if (!circuitChanged && localBike.livery.id === livery.id && localBike.bikeClass === bikeClass) return;

    const usedIds = new Set([livery.id]);
    const aiLiveries = getClassLiveries(bikeClass).filter((l) => !usedIds.has(l.id)).slice(0, 21);
    this.setupGrid({
      mode: 'solo',
      bikeClass,
      totalLaps: 3,
      localRiderId: 'local',
      localRiderName: livery.riderName,
      localLivery: livery,
      participants: [
        { id: 'local', name: livery.riderName, livery, bikeClass, isPlayer: true, isRemote: false, isAi: false },
        ...aiLiveries.map((aiLiv, idx) => ({
          id: `ai-${idx + 1}`,
          name: aiLiv.riderName,
          livery: aiLiv,
          bikeClass,
          isPlayer: false,
          isRemote: false,
          isAi: true,
        })),
      ],
    });
    this.stepTitleShowcase(0.016);
    this.renderer.render(this.scene, this.camera);
  }

  public applyRemoteStates(states: RiderNetState[]): void {
    for (const net of states) {
      if (net.id === this.localBikeId) continue;
      const bike = this.bikes.find((b) => b.id === net.id);
      if (!bike) continue;
      bike.netTargetX = net.x;
      bike.netTargetZ = net.z;
      bike.netTargetHeading = net.heading;
      bike.netTargetLean = net.leanAngle;
      bike.netTargetSpeed = net.speed;
      bike.gear = net.gear;
      bike.rpm = net.rpm;
      bike.lap = net.lap;
      bike.totalProgress = net.totalProgress;
      bike.finished = net.finished;
      bike.finishTimeMs = net.finishTimeMs;
      bike.bestLapMs = net.bestLapMs;
      bike.topSpeedKmh = net.topSpeedKmh;
      bike.isBoosting = net.isBoosting;
      if (net.crashed !== undefined) {
        bike.crashed = net.crashed;
      }
    }
  }

  private setupGrid(config: RaceStartConfig): void {
    this.raceMode = config.mode;
    this.sessionType = config.sessionType ?? 'race';
    this.totalLaps = config.totalLaps;
    this.localBikeId = config.localRiderId;

    // Clear old bike rigs
    for (const rig of this.bikeRigs.values()) {
      this.scene.remove(rig.root);
      rig.dispose();
    }
    this.bikeRigs.clear();
    this.bikes = [];

    config.participants.forEach((p, idx) => {
      const bClass = p.bikeClass ?? config.bikeClass ?? 'motogp';
      const bike = createInitialBikeState({
        id: p.id,
        name: p.name,
        livery: p.livery,
        bikeClass: bClass,
        slotIndex: idx,
        circuit: this.circuit,
        isPlayer: p.isPlayer,
        isRemote: p.isRemote,
        isAi: p.isAi,
        aiPaceFactor: p.aiPaceFactor ?? (0.94 + (idx % 4) * 0.025),
      });
      this.bikes.push(bike);

      const rig = createMotoBikeRig(p.livery, this.textures.radialShadowMap, this.isSoftwareGl, bClass);
      rig.root.position.set(bike.x, 0, bike.z);
      rig.root.rotation.y = bike.heading;
      this.scene.add(rig.root);
      this.bikeRigs.set(bike.id, rig);
    });
  }

  private readLocalInput(dt = 0.016): RiderInput {
    const up = this.keys.has('KeyW') || this.keys.has('ArrowUp');
    const down = this.keys.has('KeyS') || this.keys.has('ArrowDown');
    const left = this.keys.has('KeyA') || this.keys.has('ArrowLeft');
    const right = this.keys.has('KeyD') || this.keys.has('ArrowRight');
    const shift = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.keys.has('Space');

    const throttle = Math.max(up ? 1 : 0, this.touchInput.throttle);
    const brake = Math.max(down ? 1 : 0, this.touchInput.brake);
    let rawSteer = (right ? 1 : 0) - (left ? 1 : 0);
    if (rawSteer === 0) rawSteer = this.touchInput.steer;
    this.smoothedSteer = computeSteerInputStep(rawSteer, this.smoothedSteer, this.steeringSensitivity, dt);
    const boost = shift || this.touchInput.boost;

    return { throttle, brake, steer: this.smoothedSteer, boost };
  }

  private spawnParticle(x: number, y: number, z: number, vx: number, vy: number, vz: number, scale: number, colorHex: number, maxLife = 0.4): void {
    const slot = this.particles[this.particleCursor];
    this.particleCursor = (this.particleCursor + 1) % this.particles.length;
    slot.active = true;
    slot.x = x;
    slot.y = y;
    slot.z = z;
    slot.vx = vx;
    slot.vy = vy;
    slot.vz = vz;
    slot.life = maxLife;
    slot.maxLife = maxLife;
    slot.scale = scale;
    slot.colorHex = colorHex;
  }

  private updateParticles(dt: number): void {
    let anyActive = false;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      anyActive = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        _dummy.position.set(0, -50, 0);
        _dummy.scale.setScalar(0.001);
        _dummy.updateMatrix();
        this.particleMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= 4.5 * dt;
      const ratio = p.life / p.maxLife;
      _dummy.position.set(p.x, Math.max(0.05, p.y), p.z);
      _dummy.scale.setScalar(p.scale * (0.4 + ratio * 0.8));
      _dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, _dummy.matrix);
      this.particleMesh.setColorAt(i, _color.setHex(p.colorHex));
    }
    if (anyActive) {
      this.particleMesh.instanceMatrix.needsUpdate = true;
      if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
    }
  }

  private syncVisualRig(bike: BikeState, dt: number, brakeAmount = 0, preRaceIdle = false): void {
    const rig = this.bikeRigs.get(bike.id);
    if (!rig) return;
    rig.root.position.set(bike.x, 0, bike.z);
    rig.root.rotation.y = bike.heading;
    rig.leanGroup.rotation.z = bike.leanAngle;
    rig.frontForkGroup.rotation.y = -bike.steerVisual * 0.45;
    rig.frontWheel.rotation.x = bike.wheelSpin;
    rig.rearWheel.rotation.x = bike.wheelSpin;

    // Tip & slide bike fairing on crash
    if (bike.crashed) {
      rig.leanGroup.position.y = -0.16;
      rig.leanGroup.rotation.y = bike.crashSlideYaw;
    } else {
      rig.leanGroup.position.y = 0;
      rig.leanGroup.rotation.y = 0;
    }

    // Detailed articulated rider pose animation (hang-off, knee drop, aero tuck, braking, pre-race idle, hands on bars, feet animation)
    const riderSeed = bike.livery.number * 0.37;
    animateBikeRiderPose(rig, {
      speed: bike.speed,
      leanAngle: bike.leanAngle,
      steerVisual: bike.steerVisual,
      gear: bike.gear,
      brake: brakeAmount,
      isBoosting: bike.isBoosting,
      crashed: bike.crashed,
      preRaceIdle,
      timeSec: this.crowdTimeSec + this.titlePanTime,
      riderSeed,
      dt,
    });

    // Boost flame flicker (off while crashed)
    rig.exhaustFlame.visible = bike.isBoosting && !bike.crashed;
    if (rig.exhaustFlame.visible) {
      rig.exhaustFlame.scale.set(1, 1, 0.8 + Math.random() * 0.6);
    }

    // Emit crash sparks, gravel dust, water spray on rain patches, or tire smoke at high lean
    if (bike.crashed && bike.speed > 4) {
      if (Math.random() < dt * 36) {
        this.spawnParticle(
          bike.x + (Math.random() - 0.5) * 0.5,
          0.16,
          bike.z + (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 5,
          1.4 + Math.random() * 2.4,
          (Math.random() - 0.5) * 5,
          bike.surface === 'asphalt' || bike.surface === 'curb' ? 0.55 : 1.05,
          bike.surface === 'asphalt' || bike.surface === 'curb' ? 0xf97316 : 0xb7a994,
          0.34,
        );
      }
    } else if (!bike.crashed && bike.speed > 14 && (bike.onRainPatch || this.weatherState.rainIntensity > 0.45)) {
      const rate = bike.onRainPatch ? 34 : 10;
      if (Math.random() < dt * rate) {
        const fwdX = Math.sin(bike.heading);
        const fwdZ = Math.cos(bike.heading);
        this.spawnParticle(
          bike.x - fwdX * 0.95 + (Math.random() - 0.5) * 0.35,
          0.18,
          bike.z - fwdZ * 0.95 + (Math.random() - 0.5) * 0.35,
          -fwdX * (bike.speed * 0.16) + (Math.random() - 0.5) * 1.4,
          1.4 + Math.random() * 1.9,
          -fwdZ * (bike.speed * 0.16) + (Math.random() - 0.5) * 1.4,
          bike.onRainPatch ? 0.88 : 0.52,
          0xbae6fd,
          0.36,
        );
      }
    } else if (bike.speed > 18 && (bike.surface === 'gravel' || Math.abs(bike.leanAngle) > 0.68)) {
      if (Math.random() < dt * 22) {
        const isGravel = bike.surface === 'gravel';
        this.spawnParticle(
          bike.x + (Math.random() - 0.5) * 0.4,
          0.14,
          bike.z + (Math.random() - 0.5) * 0.4,
          (Math.random() - 0.5) * 2.2,
          1.2 + Math.random() * 1.4,
          (Math.random() - 0.5) * 2.2,
          isGravel ? 1.1 : 0.75,
          isGravel ? 0xb7a994 : 0xe2e8f0,
          0.38,
        );
      }
    }
  }

  private stepTitleShowcase(dt: number): void {
    this.titlePanTime += dt;
    const localBike = this.bikes.find((b) => b.id === this.localBikeId) ?? this.bikes[0];
    const gantrySample = sampleTrackAtS(this.circuit, START_LINE_S);
    const sway = Math.sin(this.titlePanTime * 0.45);
    if (localBike) {
      // Hero rear-quarter orbit framing the selected rider bike cleanly on the right of the menu
      const camX = localBike.x - 3.1 + sway * 1.1;
      const camZ = localBike.z - 4.4 + Math.cos(this.titlePanTime * 0.32) * 0.7;
      this.camera.up.set(0, 1, 0);
      this.camera.position.set(camX, 1.72 + Math.sin(this.titlePanTime * 0.35) * 0.22, camZ);
      this.camera.lookAt(localBike.x - 0.85, 0.92, localBike.z + 3.2);
    } else {
      const camX = gantrySample.x - 3.6 + sway * 1.6;
      const camZ = gantrySample.z - 14.5;
      this.camera.up.set(0, 1, 0);
      this.camera.position.set(camX, 2.1, camZ);
      this.camera.lookAt(gantrySample.x, 1.0, gantrySample.z);
    }

    for (const bike of this.bikes) {
      this.syncVisualRig(bike, dt);
    }
    this.trackWorld.updateCrowd(this.titlePanTime, gantrySample.x, gantrySample.z);
    this.trackWorld.updateMarshals(this.titlePanTime, false);
  }

  private updatePreRaceCamera(progress: number): void {
    // 2-Phase Cinematic Pre-Race Sequence:
    // Phase 1 (0..0.46): Trackside Turn 1 & Pit Wall glide past animated flag-waving Marshals + Grandstands
    // Phase 2 (0.46..1.0): Sweeping front-grid flyover down past P1-P3 settling behind player's bike
    const t = Math.max(0, Math.min(1, progress));
    const localBike = this.bikes.find((b) => b.id === this.localBikeId) ?? this.bikes[0];
    const poleBike = this.bikes[0] ?? localBike;
    const gantrySample = sampleTrackAtS(this.circuit, START_LINE_S);
    const t1Sample = sampleTrackAtS(this.circuit, START_LINE_S + 20);

    if (!localBike) return;

    const fwdX = Math.sin(localBike.heading);
    const fwdZ = Math.cos(localBike.heading);

    // Anchor trackside camera beside the waving pit-wall marshal overlooking the 22-bike grid
    const phase1StartX = t1Sample.x - t1Sample.nx * 9.8;
    const phase1StartY = 3.6;
    const phase1StartZ = t1Sample.z - t1Sample.nz * 9.8;

    // Anchor front-row grid & green-flag marshal vista
    const midX = gantrySample.x - gantrySample.nx * 7.8 - gantrySample.tx * 8.5;
    const midY = 2.45;
    const midZ = gantrySample.z - gantrySample.nz * 7.8 - gantrySample.tz * 8.5;

    // Anchor player chase start
    const endX = localBike.x - fwdX * 4.2;
    const endY = 1.82;
    const endZ = localBike.z - fwdZ * 4.2;

    this.camera.up.set(0, 1, 0);

    if (t < 0.46) {
      const u = t / 0.46;
      const su = u * u * (3 - 2 * u);
      this.camera.position.set(
        phase1StartX + (midX - phase1StartX) * su,
        phase1StartY + (midY - phase1StartY) * su,
        phase1StartZ + (midZ - phase1StartZ) * su,
      );
      const lookAx = gantrySample.x - gantrySample.tx * 9;
      const lookAz = gantrySample.z - gantrySample.tz * 9;
      const lookBx = (poleBike ? poleBike.x : gantrySample.x) - gantrySample.tx * 5;
      const lookBz = (poleBike ? poleBike.z : gantrySample.z) - gantrySample.tz * 5;
      this.camera.lookAt(
        lookAx + (lookBx - lookAx) * su,
        1.45 - su * 0.25,
        lookAz + (lookBz - lookAz) * su,
      );
    } else {
      const u = (t - 0.46) / 0.54;
      const su = u * u * (3 - 2 * u);
      this.camera.position.set(
        midX + (endX - midX) * su,
        midY + (endY - midY) * su,
        midZ + (endZ - midZ) * su,
      );
      const lookStartX = (poleBike ? poleBike.x : gantrySample.x) - gantrySample.tx * 5;
      const lookStartZ = (poleBike ? poleBike.z : gantrySample.z) - gantrySample.tz * 5;
      const lookEndX = localBike.x + fwdX * 14;
      const lookEndZ = localBike.z + fwdZ * 14;
      this.camera.lookAt(
        lookStartX + (lookEndX - lookStartX) * su,
        1.2 + (1.05 - 1.2) * su,
        lookStartZ + (lookEndZ - lookStartZ) * su,
      );
    }
  }

  private stepPlaying(dt: number, now: number): void {
    // Hitstop freeze frame on heavy bike-to-bike contact
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.updateParticles(dt);
      this.updateCamera(dt);
      return;
    }

    // Before-Race Trackside & Marshal Flag Scene -> Starting Grid Intro
    if (this.preRaceTimer > 0) {
      this.preRaceTimer = Math.max(0, this.preRaceTimer - dt);
      this.crowdTimeSec += dt;
      const progress = 1 - this.preRaceTimer / Math.max(0.01, this.preRaceDuration);
      this.updatePreRaceCamera(progress);
      for (const bike of this.bikes) {
        this.syncVisualRig(bike, dt, 0, true);
      }
      const localBike = this.bikes.find((b) => b.id === this.localBikeId) ?? this.bikes[0];
      this.trackWorld.updateCrowd(
        this.crowdTimeSec,
        localBike ? localBike.x : 0,
        localBike ? localBike.z : 0,
      );
      this.trackWorld.updateMarshals(this.crowdTimeSec, true);
      this.emitHudSnapshot(now, -1, false, false);
      return;
    }

    // Countdown sequence (3..2..1..GO)
    let canMove = true;
    let countdownStage = -1;
    if (this.countdownTimer > 0) {
      this.countdownTimer -= dt;
      if (this.countdownTimer > 1.6) countdownStage = 3;
      else if (this.countdownTimer > 0.8) countdownStage = 2;
      else if (this.countdownTimer > 0.15) countdownStage = 1;
      else countdownStage = 0;

      if (countdownStage !== this.lastCountdownStage) {
        this.lastCountdownStage = countdownStage;
        if (countdownStage === 3) {
          this.trackWorld.setStartLights(2, false);
          this.audio.playCountdownTone(false);
        } else if (countdownStage === 2) {
          this.trackWorld.setStartLights(4, false);
          this.audio.playCountdownTone(false);
        } else if (countdownStage === 1) {
          this.trackWorld.setStartLights(5, false);
          this.audio.playCountdownTone(false);
        } else if (countdownStage === 0) {
          this.trackWorld.setStartLights(5, true);
          this.audio.playCountdownTone(true);
        }
      }
      canMove = this.countdownTimer <= 0.15;
    } else {
      this.raceElapsedMs += dt * 1000;
      if (this.raceElapsedMs > 1600 && this.lastCountdownStage !== -1) {
        this.lastCountdownStage = -1;
        this.trackWorld.setStartLights(0, false);
      }
    }

    const localInput = this.readLocalInput(dt);
    let localWrongWay = false;
    const localBike = this.bikes.find((b) => b.id === this.localBikeId) ?? this.bikes[0];

    if (canMove) {
      updateSlipstreamStatus(this.bikes, this.circuit);
      const weatherEvt = stepDynamicWeather(
        this.weatherState,
        this.circuit,
        this.raceElapsedMs,
        dt,
        this.sessionType === 'qualifying',
      );
      if (weatherEvt.changedPhase) {
        this.audio.playWeatherCue(this.weatherState.phase === 'rain');
      }
      if (weatherEvt.spawnedPatches) {
        this.trackWorld.syncRainPatches(this.weatherState.patches, this.weatherState.rainIntensity);
      }
    }

    for (const bike of this.bikes) {
      if (bike.isRemote) {
        // Smoothly interpolate remote LAN players
        if (bike.netTargetX !== undefined && bike.netTargetZ !== undefined) {
          const alpha = 1 - Math.exp(-14 * dt);
          bike.x += (bike.netTargetX - bike.x) * alpha;
          bike.z += (bike.netTargetZ - bike.z) * alpha;
          if (bike.netTargetHeading !== undefined) {
            const diff = normalizeAngle(bike.netTargetHeading - bike.heading);
            bike.heading = normalizeAngle(bike.heading + diff * alpha);
          }
          if (bike.netTargetLean !== undefined) {
            bike.leanAngle += (bike.netTargetLean - bike.leanAngle) * alpha;
          }
          if (bike.netTargetSpeed !== undefined) {
            bike.speed += (bike.netTargetSpeed - bike.speed) * alpha;
          }
          bike.wheelSpin += (bike.speed / 0.32) * dt;
        }
        this.syncVisualRig(bike, dt);
        continue;
      }

      const input = bike.isPlayer
        ? localInput
        : computeAiInput(bike, this.circuit, this.bikes, this.weatherState.patches);
      const res = stepBikePhysics(
        bike,
        input,
        dt,
        this.circuit,
        this.raceElapsedMs,
        this.totalLaps,
        canMove,
        this.trackWorld.colliders,
        this.weatherState.patches,
        this.weatherState.rainIntensity,
      );

      if (res.solidImpact) {
        if (bike.isPlayer) {
          this.trauma = Math.min(1, this.trauma + 0.32 + res.solidImpact.intensity * 0.45);
          this.audio.playImpact(res.solidImpact.intensity);
        }
        for (let k = 0; k < 8; k++) {
          this.spawnParticle(
            res.solidImpact.x,
            0.65,
            res.solidImpact.z,
            (Math.random() - 0.5) * 8,
            2 + Math.random() * 3.5,
            (Math.random() - 0.5) * 8,
            0.58,
            0xfbbf24,
            0.28,
          );
        }
      }

      if (res.justCrashed) {
        if (bike.isPlayer) {
          // Camera shake + audio impact ONLY — never freeze/slow the rest of the grid
          this.trauma = 0.85;
          this.audio.playImpact(1.0);
        }
        for (let k = 0; k < 14; k++) {
          this.spawnParticle(
            bike.x,
            0.45,
            bike.z,
            (Math.random() - 0.5) * 10,
            2.4 + Math.random() * 4.5,
            (Math.random() - 0.5) * 10,
            0.7,
            0xf97316,
            0.38,
          );
        }
      }

      if (bike.isPlayer) {
        localWrongWay = res.wrongWay;
        if (res.completedLap) {
          this.audio.playLapComplete(res.finishedRace);
        }
        if (res.finishedRace) {
          this.triggerRaceFinish();
        }
      }
      this.syncVisualRig(bike, dt, input.brake, !canMove);
    }

    // Bike-to-bike collisions (impact only the riders involved, zero global simulation freeze)
    const impacts = resolveBikeCollisions(this.bikes);
    if (impacts.length > 0) {
      for (const imp of impacts) {
        const localHit = imp.aId === this.localBikeId || imp.bId === this.localBikeId;
        const localCrashed = imp.crashedIds.includes(this.localBikeId);
        if (localHit || localCrashed) {
          this.trauma = Math.min(1, this.trauma + (localCrashed ? 0.85 : 0.35 + imp.intensity * 0.45));
          this.audio.playImpact(localCrashed ? 1.0 : imp.intensity);
        }
        const particleCount = imp.crashedIds.length > 0 ? 14 : 10;
        for (let k = 0; k < particleCount; k++) {
          this.spawnParticle(
            imp.x,
            0.55,
            imp.z,
            (Math.random() - 0.5) * 9,
            2.5 + Math.random() * 4,
            (Math.random() - 0.5) * 9,
            0.65,
            imp.crashedIds.length > 0 ? 0xf97316 : 0xfbbf24,
            0.34,
          );
        }
      }
    }

    updateRaceRankings(this.bikes);

    if (localBike) {
      this.audio.updateEngine(
        localBike.rpm,
        localBike.crashed ? 0 : localInput.throttle,
        localBike.isBoosting,
        true,
        localBike.bikeClass,
        localBike.gear,
      );
      this.audio.updateSurfaceSfx(localBike.surface, localBike.speed, canMove);
      if (localBike.isBoosting && !this.wasBoosting && canMove) {
        this.audio.playBoostStart();
      }
      this.wasBoosting = localBike.isBoosting;

      if (canMove && this.raceElapsedMs > 2500 && localBike.rank < this.prevLocalRank) {
        this.audio.playOvertakeChime();
      }
      this.prevLocalRank = localBike.rank;
    }

    this.crowdTimeSec += dt;
    this.trackWorld.updateCrowd(
      this.crowdTimeSec,
      localBike ? localBike.x : 0,
      localBike ? localBike.z : 0,
    );
    this.trackWorld.updateMarshals(this.crowdTimeSec, !canMove);
    this.updateParticles(dt);
    this.updateCamera(dt);
    this.updateWeatherVisuals(dt);

    // Emit network telemetry at ~20Hz when in LAN mode
    if (this.raceMode === 'lan' && localBike && this.callbacks.onLocalTelemetry && now - this.lastNetEmit >= 50) {
      this.lastNetEmit = now;
      this.callbacks.onLocalTelemetry({
        id: localBike.id,
        x: localBike.x,
        z: localBike.z,
        heading: localBike.heading,
        speed: localBike.speed,
        leanAngle: localBike.leanAngle,
        gear: localBike.gear,
        rpm: localBike.rpm,
        lap: localBike.lap,
        totalProgress: localBike.totalProgress,
        finished: localBike.finished,
        finishTimeMs: localBike.finishTimeMs,
        bestLapMs: localBike.bestLapMs,
        topSpeedKmh: localBike.topSpeedKmh,
        isBoosting: localBike.isBoosting,
        crashed: localBike.crashed,
      });
    }

    this.emitHudSnapshot(now, countdownStage, localWrongWay, false);
  }

  private updateWeatherVisuals(dt: number): void {
    const cloud = this.weatherState.cloudCover;
    const rain = this.weatherState.rainIntensity;

    // Smoothly darken clear sunlit sky into storm clouds & rain atmosphere
    if (cloud > 0.01) {
      const skyUniforms = this.sky.material.uniforms;
      const baseSun = this.baseSkyMood === 'overcast' ? 1.65 : this.baseSkyMood === 'sunset' ? 2.1 : 2.2;
      const baseHemi = this.baseSkyMood === 'overcast' ? 0.85 : this.baseSkyMood === 'sunset' ? 0.65 : 0.72;
      skyUniforms['turbidity'].value = 4.5 + cloud * 5.5;
      skyUniforms['rayleigh'].value = Math.max(0.55, 1.4 - cloud * 0.8);
      this.sunLight.intensity = baseSun * (1 - cloud * 0.42);
      this.hemiLight.intensity = baseHemi * (1 - cloud * 0.15);

      const bgColor = this.scene.background as THREE.Color;
      const clearBg = this.baseSkyMood === 'sunset' ? 0xe6b89c : this.baseSkyMood === 'overcast' ? 0xbcc9d8 : 0xcfe2f3;
      const stormBg = 0x7b8da3;
      bgColor.setHex(clearBg).lerp(_color.setHex(stormBg), Math.min(1, cloud * 0.88));
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.copy(bgColor);
        this.scene.fog.density = 0.0013 + cloud * 0.0008 + rain * 0.0006;
      }
    }

    if (rain > 0.08) {
      this.rainLines.visible = true;
      this.rainLines.position.set(this.camera.position.x, 0, this.camera.position.z);
      const posAttr = this.rainLines.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = this.rainPositions;
      const fallSpeed = 24 + rain * 14;
      for (let i = 0; i < this.rainCount; i++) {
        const base = i * 6;
        let ry = arr[base + 1] - fallSpeed * dt;
        let rx = arr[base] - 2.4 * dt;
        if (ry < 0.2) {
          ry += 20;
          rx = (Math.random() - 0.5) * 44;
        }
        arr[base] = rx;
        arr[base + 1] = ry;
        arr[base + 3] = rx - 0.18;
        arr[base + 4] = ry - 1.15;
      }
      posAttr.needsUpdate = true;
      (this.rainLines.material as THREE.LineBasicMaterial).opacity = Math.min(0.62, rain * 0.65);
    } else {
      this.rainLines.visible = false;
    }
  }

  private emitHudSnapshot(
    now: number,
    countdownStage: number,
    localWrongWay: boolean,
    force: boolean,
  ): void {
    const localBike = this.bikes.find((b) => b.id === this.localBikeId) ?? this.bikes[0];
    if (!localBike || (!force && now - this.lastHudEmit < 85)) return;

    this.lastHudEmit = now;
    const spec = BIKE_CLASSES[localBike.bikeClass];
    const sortedStandings = [...this.bikes].sort((a, b) => a.rank - b.rank);
    this.callbacks.onHudUpdate({
      sessionType: this.sessionType,
      preRaceActive: this.preRaceTimer > 0,
      circuitName: this.circuit.name,
      localLiveryId: localBike.livery.id,
      speedKmh: Math.round(localBike.speed * 3.6),
      gear: localBike.gear,
      rpmRatio: Math.min(1, Math.max(0, (localBike.rpm - 3500) / (spec.maxRpm - 3500))),
      boostFuel: Math.round(localBike.boostFuel),
      isBoosting: localBike.isBoosting,
      lap: localBike.lap,
      totalLaps: this.totalLaps,
      rank: localBike.rank,
      totalRiders: this.bikes.length,
      raceTimeMs: Math.round(this.raceElapsedMs),
      currentLapMs: Math.round(Math.max(0, this.raceElapsedMs - localBike.currentLapStartMs)),
      bestLapMs: localBike.bestLapMs ? Math.round(localBike.bestLapMs) : null,
      countdownStage:
        this.preRaceTimer > 0
          ? -1
          : this.countdownTimer > 0
          ? countdownStage
          : this.raceElapsedMs < 1100
          ? 0
          : -1,
      surface: localBike.surface,
      wrongWay: localWrongWay,
      crashed: localBike.crashed,
      crashRecoverSec: Math.max(0, Number(localBike.crashTimer.toFixed(1))),
      bikeClass: localBike.bikeClass,
      weatherPhase: this.weatherState.phase,
      rainIntensity: Number(this.weatherState.rainIntensity.toFixed(2)),
      onRainPatch: Boolean(localBike.onRainPatch),
      rainPatches: this.weatherState.patches.map((p) => ({
        id: p.id,
        x: p.x,
        z: p.z,
        radius: p.radiusS,
      })),
      leaderboard: sortedStandings.map((b) => ({
        id: b.id,
        rank: b.rank,
        name: b.name,
        color: b.livery.primaryHex,
        liveryId: b.livery.id,
        nationality: b.livery.nationality,
        isPlayer: b.isPlayer,
        crashed: b.crashed,
      })),
      minimapRiders: this.bikes.map((b) => ({
        id: b.id,
        x: b.x,
        z: b.z,
        color: b.livery.primaryHex,
        isPlayer: b.isPlayer,
      })),
    });
  }

  private setupPodiumCeremony(sorted: BikeState[]): void {
    this.clearPodiumStage();
    if (this.sessionType !== 'race' || sorted.length === 0) return;

    const winners: PodiumWinnerSlot[] = [];
    for (let i = 0; i < Math.min(3, sorted.length); i++) {
      winners.push({
        rank: (i + 1) as 1 | 2 | 3,
        name: sorted[i].name,
        livery: sorted[i].livery,
      });
    }

    const bikeClass = sorted[0].bikeClass;
    const stage = createPodiumStage(
      winners,
      this.textures.radialShadowMap,
      this.isSoftwareGl,
      bikeClass,
    );

    const anchor = sampleTrackAtS(this.circuit, START_LINE_S + 45);
    stage.group.position.set(anchor.x, 0, anchor.z);
    // Face the podium toward the approaching main straight (-Z / opposite tangent)
    stage.group.rotation.y = Math.atan2(-anchor.tx, -anchor.tz);
    this.scene.add(stage.group);

    this.podiumStage = stage;
    this.podiumOrigin.set(anchor.x, 0, anchor.z);
    this.podiumTimeSec = 0;

    // Hide race bikes on the track so the Parc Ferme podium bikes shine cleanly
    for (const rig of this.bikeRigs.values()) {
      rig.root.visible = false;
    }

    // Immediate celebratory confetti burst
    const confettiColors = [0xfacc15, 0xef4444, 0x38bdf8, 0x22c55e, 0xf8fafc];
    for (let i = 0; i < 36; i++) {
      this.spawnParticle(
        anchor.x + (Math.random() - 0.5) * 6,
        2.5 + Math.random() * 2.2,
        anchor.z + (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 4,
        2.0 + Math.random() * 3.5,
        (Math.random() - 0.5) * 4,
        0.55,
        confettiColors[i % confettiColors.length],
        1.4,
      );
    }
  }

  private stepPodiumCeremony(dt: number): void {
    if (!this.podiumStage) return;
    this.podiumTimeSec += dt;
    animatePodiumCeremony(this.podiumStage, this.podiumTimeSec);

    // Gentle celebratory confetti stream
    if (Math.random() < dt * 24) {
      const confettiColors = [0xfacc15, 0xef4444, 0x38bdf8, 0x22c55e, 0xf8fafc];
      this.spawnParticle(
        this.podiumOrigin.x + (Math.random() - 0.5) * 5.2,
        3.6 + Math.random() * 1.4,
        this.podiumOrigin.z + (Math.random() - 0.5) * 3.5,
        (Math.random() - 0.5) * 2.4,
        1.4 + Math.random() * 1.6,
        (Math.random() - 0.5) * 2.4,
        0.48,
        confettiColors[Math.floor(Math.random() * confettiColors.length)],
        1.3,
      );
    }
    this.updateParticles(dt);
    this.trackWorld.updateCrowd(this.podiumTimeSec, this.podiumOrigin.x, this.podiumOrigin.z);
    this.trackWorld.updateMarshals(this.podiumTimeSec, false);

    // Orbital broadcast camera in front of the podium stage (wide enough to clear bottom overlay)
    const orbit = Math.sin(this.podiumTimeSec * 0.35) * 0.36;
    const anchor = sampleTrackAtS(this.circuit, START_LINE_S + 45);
    const frontX = -anchor.tx;
    const frontZ = -anchor.tz;
    const rightX = -frontZ;
    const rightZ = frontX;
    const dist = 8.4;

    this.camera.up.set(0, 1, 0);
    this.camera.position.set(
      this.podiumOrigin.x + frontX * dist * Math.cos(orbit) + rightX * dist * Math.sin(orbit),
      2.65 + Math.sin(this.podiumTimeSec * 0.5) * 0.16,
      this.podiumOrigin.z + frontZ * dist * Math.cos(orbit) + rightZ * dist * Math.sin(orbit),
    );
    this.camera.lookAt(this.podiumOrigin.x, 1.05, this.podiumOrigin.z);
  }

  private triggerRaceFinish(): void {
    this.gameState = 'gameover';
    this.audio.silenceEngine();
    this.audio.setBgmMode('off');
    const sorted = [...this.bikes].sort((a, b) => a.rank - b.rank);
    this.setupPodiumCeremony(sorted);
    const results: RaceResultEntry[] = sorted.map((b) => ({
      id: b.id,
      name: b.name,
      livery: b.livery,
      rank: b.rank,
      finishTimeMs: b.finished ? b.finishTimeMs : Math.round(this.raceElapsedMs + Math.max(800, (this.totalLaps * this.circuit.totalLength - b.totalProgress) * 18)),
      bestLapMs: b.bestLapMs,
      topSpeedKmh: b.topSpeedKmh,
      isPlayer: b.isPlayer,
      isAi: b.isAi,
    }));
    this.callbacks.onRaceFinish(results);
  }

  public previewPodium(): void {
    this.audio.silenceEngine();
    this.audio.setBgmMode('off');
    updateRaceRankings(this.bikes);
    const sorted = [...this.bikes].sort((a, b) => a.rank - b.rank);
    const results: RaceResultEntry[] = sorted.map((b, idx) => ({
      id: b.id,
      name: b.name,
      livery: b.livery,
      rank: idx + 1,
      finishTimeMs: 184200 + idx * 1450,
      bestLapMs: 59400 + idx * 320,
      topSpeedKmh: 318 - idx * 2,
      isPlayer: b.isPlayer,
      isAi: b.isAi,
    }));
    this.setupPodiumCeremony(sorted);
    this.stepPodiumCeremony(0.4);
    this.gameState = 'gameover';
    this.callbacks.onRaceFinish(results);
    this.renderer.render(this.scene, this.camera);
  }

  private updateCamera(dt: number): void {
    const localBike = this.bikes.find((b) => b.id === this.localBikeId) ?? this.bikes[0];
    if (!localBike) return;

    const fwdX = Math.sin(localBike.heading);
    const fwdZ = Math.cos(localBike.heading);
    this.camera.up.set(0, 1, 0);

    if (this.cameraMode === 'chase') {
      // Fixed chase distance so high speed keeps the bike consistent without zooming out
      const dist = 4.2;
      _camTargetPos.set(localBike.x - fwdX * dist, 1.82, localBike.z - fwdZ * dist);
      _camLookAt.set(localBike.x + fwdX * 14, 1.05, localBike.z + fwdZ * 14);
      const damp = 1 - Math.exp(-12 * dt);
      this.camera.position.lerp(_camTargetPos, damp);
      this.camera.lookAt(_camLookAt);
    } else if (this.cameraMode === 'helmet') {
      const leanLat = -Math.sin(localBike.leanAngle) * 0.42;
      const rightX = -fwdZ;
      const rightZ = fwdX;
      this.camera.position.set(
        localBike.x + fwdX * 0.56 + rightX * leanLat,
        1.32 - Math.abs(localBike.leanAngle) * 0.15,
        localBike.z + fwdZ * 0.56 + rightZ * leanLat,
      );
      _camLookAt.set(localBike.x + fwdX * 22, 1.02, localBike.z + fwdZ * 22);
      this.camera.lookAt(_camLookAt);
      // Local Z roll in camera space avoids Euler gimbal flip along +Z heading
      this.camera.rotateZ(-localBike.leanAngle * 0.25);
    } else {
      // Elevated TV Broadcast helicam
      _camTargetPos.set(localBike.x - fwdX * 10.5, 7.2, localBike.z - fwdZ * 10.5);
      _camLookAt.set(localBike.x + fwdX * 6, 0.85, localBike.z + fwdZ * 6);
      const damp = 1 - Math.exp(-6.0 * dt);
      this.camera.position.lerp(_camTargetPos, damp);
      this.camera.lookAt(_camLookAt);
    }

    // Lock FOV steady at high speed (never zoom out on straightaways or KERS boost)
    const targetFov = 62;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 10, dt);
      this.camera.updateProjectionMatrix();
    }

    if (localBike.surface === 'gravel' && localBike.speed > 10) {
      this.trauma = Math.max(this.trauma, 0.16);
    }
    if (this.trauma > 0.001) {
      const shake = this.trauma * this.trauma;
      this.camera.position.x += (Math.random() - 0.5) * 0.14 * shake;
      this.camera.position.y += (Math.random() - 0.5) * 0.11 * shake;
      this.trauma = Math.max(0, this.trauma - dt * 1.9);
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private startLoop(): void {
    const tick = () => {
      if (this.disposed) return;
      const now = performance.now();
      const rawDt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      const frameBudget = Math.min(rawDt, 0.25);

      if (this.gameState === 'title') {
        this.stepTitleShowcase(Math.min(frameBudget, 0.05));
      } else if (this.gameState === 'playing') {
        let remaining = frameBudget;
        while (remaining > 0.0001) {
          const subDt = Math.min(remaining, 0.04);
          this.stepPlaying(subDt, now);
          remaining -= subDt;
        }
      } else if (this.gameState === 'gameover' && this.podiumStage) {
        this.stepPodiumCeremony(Math.min(frameBudget, 0.05));
      }

      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.frameId = window.setTimeout(tick, 16);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private handleResize(): void {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    if (w <= 0 || h <= 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.render(this.scene, this.camera);
  }

  private handleFirstInteract = (): void => {
    this.audio.unlock();
    this.audio.setBgmMode(this.gameState === 'title' ? 'title' : this.gameState === 'playing' ? 'race' : 'off');
    window.removeEventListener('pointerdown', this.handleFirstInteract);
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    this.audio.unlock();
    this.keys.add(e.code);
    if (this.gameState === 'playing') {
      if (this.preRaceTimer > 0 && (e.code === 'Space' || e.code === 'Enter')) {
        this.skipPreRace();
        return;
      }
      if (e.code === 'Escape' || e.code === 'KeyP') {
        this.callbacks.onTogglePause?.();
      } else if (e.code === 'KeyC') {
        this.cycleCameraMode();
      } else if (e.code === 'KeyM') {
        this.audio.toggleMute();
      } else if (e.code === 'KeyR') {
        this.resetLocalBike();
      }
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private handleBlur = (): void => {
    this.keys.clear();
    this.touchInput = { throttle: 0, brake: 0, steer: 0, boost: false };
  };

  private handleVisibility = (): void => {
    if (document.hidden) {
      this.keys.clear();
      this.touchInput = { throttle: 0, brake: 0, steer: 0, boost: false };
    }
  };

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('pointerdown', this.handleFirstInteract);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    this.resizeObserver.disconnect();
    this.clearPodiumStage();
    for (const rig of this.bikeRigs.values()) {
      rig.dispose();
    }
    this.trackWorld.dispose();
    this.textures.dispose();
    this.particleMesh.geometry.dispose();
    (this.particleMesh.material as THREE.Material).dispose();
    this.rainLines.geometry.dispose();
    (this.rainLines.material as THREE.Material).dispose();
    this.envMap.dispose();
    this.audio.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
