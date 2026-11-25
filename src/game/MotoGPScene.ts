import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { MotoAudioEngine } from './audio';
import { BikeVisualRig, createMotoBikeRig } from './bikeMesh';
import {
  computeAiInput,
  createInitialBikeState,
  normalizeAngle,
  resolveBikeCollisions,
  stepBikePhysics,
  updateRaceRankings,
} from './physics';
import { createProceduralTextures, ProceduralTextures } from './textures';
import { createTrackWorld, TrackWorld } from './trackMesh';
import { CircuitData, getCircuit, sampleTrackAtS, START_LINE_S } from './trackMath';
import {
  BIKE_CLASSES,
  type BikeClassId,
  BikeState,
  CameraMode,
  GameScreenState,
  HudSnapshot,
  RaceResultEntry,
  RiderInput,
  RiderNetState,
  TEAM_LIVERIES,
  TeamLivery,
} from './types';

export interface RaceStartConfig {
  mode: 'solo' | 'lan' | 'career';
  bikeClass: BikeClassId;
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

  private sky!: Sky;
  private sunLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;

  private countdownTimer = 3.2;
  private lastCountdownStage = 4;
  private raceElapsedMs = 0;
  private trauma = 0;
  private hitstopTimer = 0;
  private lastHudEmit = 0;
  private lastNetEmit = 0;
  private titlePanTime = 0;
  private wasBoosting = false;
  private prevLocalRank = 1;

  // Input state
  private keys = new Set<string>();
  private touchInput: RiderInput = { throttle: 0, brake: 0, steer: 0, boost: false };

  // Pooled InstancedMesh particles (smoke, gravel, sparks)
  private particleMesh: THREE.InstancedMesh;
  private particles: ParticleSlot[] = [];
  private particleCursor = 0;

  // Frame loop handles
  private frameId = 0;
  private disposed = false;
  private lastTime = performance.now();
  private resizeObserver: ResizeObserver;
  private envMap: THREE.Texture;

  constructor(container: HTMLElement, callbacks: SceneCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.circuit = getCircuit();
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

    // Spawn initial 10-rider showcase grid for Title Screen flyover
    const showcaseAiNames = [
      'M. Rossi',
      'F. Bagnaia',
      'M. Marquez',
      'J. Martin',
      'F. Quartararo',
      'A. Espargaro',
      'E. Bastianini',
      'B. Binder',
      'P. Acosta',
    ];
    this.setupGrid({
      mode: 'solo',
      bikeClass: 'motogp',
      totalLaps: 3,
      skyMood: 'sunny',
      localRiderId: 'local',
      localRiderName: 'You',
      localLivery: TEAM_LIVERIES[0],
      participants: [
        { id: 'local', name: 'You', livery: TEAM_LIVERIES[0], bikeClass: 'motogp', isPlayer: true, isRemote: false, isAi: false },
        ...showcaseAiNames.map((name, idx) => ({
          id: `ai-${idx + 1}`,
          name,
          livery: TEAM_LIVERIES[(idx + 1) % TEAM_LIVERIES.length],
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

  public setTouchInput(partial: Partial<RiderInput>): void {
    Object.assign(this.touchInput, partial);
  }

  public clearInputs(): void {
    this.keys.clear();
    this.touchInput = { throttle: 0, brake: 0, steer: 0, boost: false };
  }

  public setGameState(state: GameScreenState): void {
    this.gameState = state;
    if (state === 'title') {
      this.audio.silenceEngine();
      this.audio.setBgmMode('title');
      this.clearInputs();
    } else if (state === 'playing') {
      this.audio.unlock();
      this.audio.setBgmMode('race');
    } else {
      this.audio.silenceEngine();
      this.audio.setBgmMode('off');
      this.clearInputs();
    }
  }

  public applySkyMood(mood: 'sunny' | 'sunset' | 'overcast' = 'sunny'): void {
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

  public startRace(config: RaceStartConfig): void {
    this.audio.unlock();
    this.audio.setBgmMode('race');
    this.applySkyMood(config.skyMood ?? 'sunny');
    this.setupGrid(config);
    this.gameState = 'playing';
    this.countdownTimer = 2.4;
    this.lastCountdownStage = 4;
    this.raceElapsedMs = 0;
    this.trauma = 0;
    this.hitstopTimer = 0;
    this.wasBoosting = false;
    this.clearInputs();
    this.trackWorld.setStartLights(0, false);

    // Snap camera immediately behind local player bike upright
    const localBike = this.bikes.find((b) => b.id === this.localBikeId) ?? this.bikes[0];
    if (localBike) {
      this.prevLocalRank = localBike.rank;
      const fwdX = Math.sin(localBike.heading);
      const fwdZ = Math.cos(localBike.heading);
      this.camera.up.set(0, 1, 0);
      this.camera.position.set(localBike.x - fwdX * 4.2, 1.82, localBike.z - fwdZ * 4.2);
      this.camera.lookAt(localBike.x + fwdX * 14, 1.05, localBike.z + fwdZ * 14);
    }
  }

  public updateShowcaseBike(livery: TeamLivery, bikeClass: BikeClassId): void {
    if (this.gameState !== 'title') return;
    const localBike = this.bikes.find((b) => b.id === this.localBikeId) ?? this.bikes[0];
    if (!localBike) return;
    if (localBike.livery.id === livery.id && localBike.bikeClass === bikeClass) return;

    const usedIds = new Set([livery.id]);
    const aiLiveries = TEAM_LIVERIES.filter((l) => !usedIds.has(l.id));
    const aiNames = [
      'M. Rossi',
      'F. Bagnaia',
      'M. Marquez',
      'J. Martin',
      'F. Quartararo',
      'A. Espargaro',
      'E. Bastianini',
      'B. Binder',
      'P. Acosta',
    ];
    this.setupGrid({
      mode: 'solo',
      bikeClass,
      totalLaps: 3,
      localRiderId: 'local',
      localRiderName: 'You',
      localLivery: livery,
      participants: [
        { id: 'local', name: 'You', livery, bikeClass, isPlayer: true, isRemote: false, isAi: false },
        ...aiNames.map((name, idx) => ({
          id: `ai-${idx + 1}`,
          name,
          livery: aiLiveries[idx % aiLiveries.length],
          bikeClass,
          isPlayer: false,
          isRemote: false,
          isAi: true,
        })),
      ],
    });
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
    }
  }

  private setupGrid(config: RaceStartConfig): void {
    this.raceMode = config.mode;
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
        aiPaceFactor: p.aiPaceFactor ?? (0.86 + (idx % 3) * 0.045),
      });
      this.bikes.push(bike);

      const rig = createMotoBikeRig(p.livery, this.textures.radialShadowMap, this.isSoftwareGl, bClass);
      rig.root.position.set(bike.x, 0, bike.z);
      rig.root.rotation.y = bike.heading;
      this.scene.add(rig.root);
      this.bikeRigs.set(bike.id, rig);
    });
  }

  private readLocalInput(): RiderInput {
    const up = this.keys.has('KeyW') || this.keys.has('ArrowUp');
    const down = this.keys.has('KeyS') || this.keys.has('ArrowDown');
    const left = this.keys.has('KeyA') || this.keys.has('ArrowLeft');
    const right = this.keys.has('KeyD') || this.keys.has('ArrowRight');
    const shift = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.keys.has('Space');

    const throttle = Math.max(up ? 1 : 0, this.touchInput.throttle);
    const brake = Math.max(down ? 1 : 0, this.touchInput.brake);
    let steer = (right ? 1 : 0) - (left ? 1 : 0);
    if (steer === 0) steer = this.touchInput.steer;
    const boost = shift || this.touchInput.boost;

    return { throttle, brake, steer, boost };
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

  private syncVisualRig(bike: BikeState, dt: number): void {
    const rig = this.bikeRigs.get(bike.id);
    if (!rig) return;
    rig.root.position.set(bike.x, 0, bike.z);
    rig.root.rotation.y = bike.heading;
    rig.leanGroup.rotation.z = bike.leanAngle;
    rig.frontForkGroup.rotation.y = -bike.steerVisual * 0.45;
    rig.frontWheel.rotation.x = bike.wheelSpin;
    rig.rearWheel.rotation.x = bike.wheelSpin;

    // Rider shifts inside toward corner apex
    rig.riderGroup.position.x = -Math.sin(bike.leanAngle) * 0.22;
    rig.riderGroup.rotation.z = bike.leanAngle * 0.28;

    // Boost flame flicker
    rig.exhaustFlame.visible = bike.isBoosting;
    if (bike.isBoosting) {
      rig.exhaustFlame.scale.set(1, 1, 0.8 + Math.random() * 0.6);
    }

    // Emit gravel dust or tire smoke at high lean
    if (bike.speed > 18 && (bike.surface === 'gravel' || Math.abs(bike.leanAngle) > 0.68)) {
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
    const gantrySample = sampleTrackAtS(this.circuit, START_LINE_S);
    const sway = Math.sin(this.titlePanTime * 0.45);
    // Hero rear-quarter angle showcasing the detailed motorcycle & grandstands across the pit straight
    const camX = gantrySample.x - 5.2 + sway * 2.4;
    const camZ = gantrySample.z - 16.8 + Math.cos(this.titlePanTime * 0.32) * 1.8;
    this.camera.up.set(0, 1, 0);
    this.camera.position.set(camX, 2.35 + Math.sin(this.titlePanTime * 0.35) * 0.35, camZ);
    this.camera.lookAt(gantrySample.x + 1.8, 1.05, gantrySample.z - 5.2);

    for (const bike of this.bikes) {
      this.syncVisualRig(bike, dt);
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

    const localInput = this.readLocalInput();
    let localWrongWay = false;
    const localBike = this.bikes.find((b) => b.id === this.localBikeId) ?? this.bikes[0];

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

      const input = bike.isPlayer ? localInput : computeAiInput(bike, this.circuit, this.bikes);
      const res = stepBikePhysics(bike, input, dt, this.circuit, this.raceElapsedMs, this.totalLaps, canMove);

      if (bike.isPlayer) {
        localWrongWay = res.wrongWay;
        if (res.gearChanged && canMove) {
          this.audio.playGearShift();
        }
        if (res.completedLap) {
          this.audio.playLapComplete(res.finishedRace);
        }
        if (res.finishedRace) {
          this.triggerRaceFinish();
        }
      }
      this.syncVisualRig(bike, dt);
    }

    // Soft bike-to-bike collisions
    const impacts = resolveBikeCollisions(this.bikes);
    if (impacts.length > 0) {
      for (const imp of impacts) {
        if (imp.aId === this.localBikeId || imp.bId === this.localBikeId) {
          this.trauma = Math.min(1, this.trauma + 0.35 + imp.intensity * 0.45);
          this.hitstopTimer = 0.035;
          this.audio.playImpact(imp.intensity);
        }
        for (let k = 0; k < 10; k++) {
          this.spawnParticle(
            imp.x,
            0.55,
            imp.z,
            (Math.random() - 0.5) * 9,
            2.5 + Math.random() * 4,
            (Math.random() - 0.5) * 9,
            0.65,
            0xfbbf24,
            0.32,
          );
        }
      }
    }

    updateRaceRankings(this.bikes);

    if (localBike) {
      this.audio.updateEngine(localBike.rpm, localInput.throttle, localBike.isBoosting, true, localBike.bikeClass);
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

    this.updateParticles(dt);
    this.updateCamera(dt);

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
      });
    }

    // Throttle React HUD state updates to <= 12Hz
    if (localBike && now - this.lastHudEmit >= 85) {
      this.lastHudEmit = now;
      const spec = BIKE_CLASSES[localBike.bikeClass];
      this.callbacks.onHudUpdate({
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
        countdownStage: this.countdownTimer > 0 ? countdownStage : this.raceElapsedMs < 1100 ? 0 : -1,
        surface: localBike.surface,
        wrongWay: localWrongWay,
        bikeClass: localBike.bikeClass,
        minimapRiders: this.bikes.map((b) => ({
          id: b.id,
          x: b.x,
          z: b.z,
          color: b.livery.primaryHex,
          isPlayer: b.isPlayer,
        })),
      });
    }
  }

  private triggerRaceFinish(): void {
    this.gameState = 'gameover';
    this.audio.silenceEngine();
    this.audio.setBgmMode('off');
    const sorted = [...this.bikes].sort((a, b) => a.rank - b.rank);
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

  private updateCamera(dt: number): void {
    const localBike = this.bikes.find((b) => b.id === this.localBikeId) ?? this.bikes[0];
    if (!localBike) return;

    const fwdX = Math.sin(localBike.heading);
    const fwdZ = Math.cos(localBike.heading);
    this.camera.up.set(0, 1, 0);

    if (this.cameraMode === 'chase') {
      const dist = 4.1 + (localBike.speed / 92) * 1.1;
      _camTargetPos.set(localBike.x - fwdX * dist, 1.82, localBike.z - fwdZ * dist);
      _camLookAt.set(localBike.x + fwdX * 14, 1.05, localBike.z + fwdZ * 14);
      const damp = 1 - Math.exp(-10 * dt);
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

    // Dynamic speed FOV kick + gravel rumble / impact trauma position shake (never flips orientation)
    const targetFov = 62 + (localBike.speed / 92) * 15 + (localBike.isBoosting ? 5 : 0);
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 7, dt);
    this.camera.updateProjectionMatrix();

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
      if (e.code === 'Escape' || e.code === 'KeyP') {
        this.callbacks.onTogglePause?.();
      } else if (e.code === 'KeyC') {
        this.cycleCameraMode();
      } else if (e.code === 'KeyM') {
        this.audio.toggleMute();
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
    for (const rig of this.bikeRigs.values()) {
      rig.dispose();
    }
    this.trackWorld.dispose();
    this.textures.dispose();
    this.particleMesh.geometry.dispose();
    (this.particleMesh.material as THREE.Material).dispose();
    this.envMap.dispose();
    this.audio.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
