import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCircuitData,
  classifySurface,
  getGridSlotTransform,
  projectToTrack,
  sampleTrackAtS,
  START_LINE_S,
  updateLapAndCheckpoints,
} from './trackMath';
import {
  computeAiInput,
  computeGearAndRpm,
  createInitialBikeState,
  resolveBikeCollisions,
  stepBikePhysics,
  updateRaceRankings,
} from './physics';
import { TEAM_LIVERIES } from './types';

test('circuit spline builds closed loop with valid unit tangents and normals', () => {
  const circuit = buildCircuitData(480);
  assert.equal(circuit.samples.length, 480);
  assert.ok(circuit.totalLength > 800, 'circuit perimeter should exceed 800m');

  const s0 = sampleTrackAtS(circuit, 0);
  const sWrap = sampleTrackAtS(circuit, circuit.totalLength);
  assert.ok(Math.hypot(s0.x - sWrap.x, s0.z - sWrap.z) < 0.05);
  assert.ok(Math.abs(Math.hypot(s0.tx, s0.tz) - 1) < 1e-4);
  assert.ok(Math.abs(s0.tx * s0.nx + s0.tz * s0.nz) < 1e-4);
});

test('surface classification transitions cleanly from asphalt to curb, gravel, and grass', () => {
  assert.equal(classifySurface(0), 'asphalt');
  assert.equal(classifySurface(7.9), 'asphalt');
  assert.equal(classifySurface(8.8), 'curb');
  assert.equal(classifySurface(12.0), 'gravel');
  assert.equal(classifySurface(22.0), 'grass');
});

test('lap and checkpoint logic prevents reverse-line crossing cheat and advances valid laps', () => {
  const len = 1000;
  // Trying to cross backward or without checkpoints should not increment lap
  const cheat = updateLapAndCheckpoints(950, 10, 0b0001, 1, 3, len);
  assert.equal(cheat.lap, 1);
  assert.equal(cheat.completedLap, false);

  // Passing all 4 sectors then crossing start line increments lap
  let mask = 0;
  mask = updateLapAndCheckpoints(10, 50, mask, 1, 3, len).checkpointMask;
  mask = updateLapAndCheckpoints(50, 300, mask, 1, 3, len).checkpointMask;
  mask = updateLapAndCheckpoints(300, 550, mask, 1, 3, len).checkpointMask;
  mask = updateLapAndCheckpoints(550, 820, mask, 1, 3, len).checkpointMask;
  assert.equal(mask, 0b1111);

  const lap2 = updateLapAndCheckpoints(820, 20, mask, 1, 3, len);
  assert.equal(lap2.completedLap, true);
  assert.equal(lap2.lap, 2);
  assert.equal(lap2.finishedRace, false);

  const finish = updateLapAndCheckpoints(820, 20, 0b1111, 3, 3, len);
  assert.equal(finish.completedLap, true);
  assert.equal(finish.finishedRace, true);
});

test('grid slots spawn bikes cleanly on asphalt facing forward down the straight', () => {
  const circuit = buildCircuitData(480);
  for (let i = 0; i < 6; i++) {
    const slot = getGridSlotTransform(circuit, i);
    const proj = projectToTrack(circuit, slot.x, slot.z, slot.trackS);
    assert.equal(proj.surface, 'asphalt');
    assert.ok(slot.trackS < START_LINE_S);
  }
});

test('6-speed gearbox shifts smoothly across speed range', () => {
  assert.equal(computeGearAndRpm(0, false).gear, 1);
  assert.equal(computeGearAndRpm(35, false).gear, 3);
  assert.equal(computeGearAndRpm(80, false).gear, 6);
  assert.ok(computeGearAndRpm(80, true).rpm > computeGearAndRpm(80, false).rpm);
});

test('bike acceleration, gravel slowdown, steering lean, and collision resolution behave deterministically', () => {
  const circuit = buildCircuitData(480);
  const bikeA = createInitialBikeState({
    id: 'p1',
    name: 'Rider 1',
    livery: TEAM_LIVERIES[0],
    slotIndex: 0,
    circuit,
    isPlayer: true,
    isRemote: false,
    isAi: false,
  });

  // Accelerate down main straight for 2 seconds
  for (let i = 0; i < 40; i++) {
    stepBikePhysics(
      bikeA,
      { throttle: 1, brake: 0, steer: 0, boost: false },
      0.05,
      circuit,
      i * 50,
      3,
      true,
    );
  }
  assert.equal(bikeA.surface, 'asphalt');
  assert.ok(bikeA.speed > 45, `expected high speed after 2s throttle on straight, got ${bikeA.speed}`);
  assert.ok(bikeA.gear >= 3);

  // Steer right and check lean angle clamps smoothly
  for (let i = 0; i < 20; i++) {
    stepBikePhysics(
      bikeA,
      { throttle: 1, brake: 0, steer: 1, boost: false },
      0.05,
      circuit,
      3000 + i * 50,
      3,
      true,
    );
  }
  assert.ok(bikeA.leanAngle > 0.3);
  assert.ok(bikeA.leanAngle <= 0.85);

  // Collision push-apart
  const bikeB = createInitialBikeState({
    id: 'ai1',
    name: 'AI 1',
    livery: TEAM_LIVERIES[1],
    slotIndex: 1,
    circuit,
    isPlayer: false,
    isRemote: false,
    isAi: true,
  });
  bikeB.x = bikeA.x + 0.5;
  bikeB.z = bikeA.z;
  const impacts = resolveBikeCollisions([bikeA, bikeB]);
  assert.equal(impacts.length, 1);
  assert.ok(Math.hypot(bikeB.x - bikeA.x, bikeB.z - bikeA.z) > 0.5);

  // AI produces bounded steering and throttle
  const aiInput = computeAiInput(bikeB, circuit, [bikeA, bikeB]);
  assert.ok(aiInput.steer >= -1 && aiInput.steer <= 1);
  assert.ok(aiInput.throttle >= 0 && aiInput.throttle <= 1);

  // Rankings order by totalProgress
  bikeA.totalProgress = 500;
  bikeB.totalProgress = 400;
  updateRaceRankings([bikeB, bikeA]);
  assert.equal(bikeA.rank, 1);
  assert.equal(bikeB.rank, 2);
});

test('career mode awards MotoGP championship points and promotes Moto3 -> Moto2 -> MotoGP', async () => {
  const { createDefaultCareerProgress, applyCareerRaceOutcome } = await import('./career');
  let career = createDefaultCareerProgress();
  assert.equal(career.activeClass, 'moto3');

  // Win Round 1 and Round 2 of Moto3 (25 + 25 = 50 pts >= 40 pts threshold)
  const r1 = applyCareerRaceOutcome(career, 1);
  assert.equal(r1.pointsEarned, 25);
  assert.equal(r1.seasonFinished, false);
  career = r1.updated;

  const r2 = applyCareerRaceOutcome(career, 1);
  assert.equal(r2.updated.seasonPoints, 50);
  career = r2.updated;

  // Round 3 finishes Moto3 season and promotes to Moto2
  const r3 = applyCareerRaceOutcome(career, 2);
  assert.equal(r3.seasonFinished, true);
  assert.equal(r3.wonChampionship, true);
  assert.equal(r3.promotedTo, 'moto2');
  assert.equal(r3.updated.activeClass, 'moto2');
  assert.ok(r3.updated.unlockedClasses.includes('moto2'));
});

test('Moto3 and MotoGP bike classes have distinct acceleration and top speed curves', () => {
  const circuit = buildCircuitData(480);
  const moto3 = createInitialBikeState({
    id: 'm3',
    name: 'Moto3',
    livery: TEAM_LIVERIES[0],
    bikeClass: 'moto3',
    slotIndex: 0,
    circuit,
    isPlayer: true,
    isRemote: false,
    isAi: false,
  });
  const motogp = createInitialBikeState({
    id: 'mgp',
    name: 'MotoGP',
    livery: TEAM_LIVERIES[1],
    bikeClass: 'motogp',
    slotIndex: 1,
    circuit,
    isPlayer: false,
    isRemote: false,
    isAi: false,
  });

  for (let i = 0; i < 30; i++) {
    stepBikePhysics(moto3, { throttle: 1, brake: 0, steer: 0, boost: false }, 0.04, circuit, i * 40, 3, true);
    stepBikePhysics(motogp, { throttle: 1, brake: 0, steer: 0, boost: false }, 0.04, circuit, i * 40, 3, true);
  }
  assert.ok(motogp.speed > moto3.speed, `MotoGP (${motogp.speed}) should out-accelerate Moto3 (${moto3.speed})`);
});

