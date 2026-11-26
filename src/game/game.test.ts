import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCircuitData,
  buildMinimapGeometry,
  CIRCUIT_LIST,
  classifySurface,
  CURB_WIDTH,
  getCircuit,
  getGridSlotTransform,
  isInsideCircuitLoop,
  projectPointToMinimap,
  projectToTrack,
  sampleTrackAtS,
  START_LINE_S,
  TRACK_HALF_WIDTH,
  updateLapAndCheckpoints,
} from './trackMath';
import {
  computeAiInput,
  computeGearAndRpm,
  createInitialBikeState,
  resetBikeToTrack,
  resolveBikeCollisions,
  resolveSolidCollisions,
  stepBikePhysics,
  triggerBikeCrash,
  updateRaceRankings,
  updateSlipstreamStatus,
} from './physics';
import { TEAM_LIVERIES } from './types';

test('all 6 upgraded championship circuits build closed >3100m technical loops with 19-22 corners', () => {
  assert.equal(CIRCUIT_LIST.length, 6);
  for (const meta of CIRCUIT_LIST) {
    assert.ok(meta.corners >= 19 && meta.corners <= 22, `${meta.id} corners=${meta.corners}`);
    const circuit = getCircuit(meta.id);
    assert.equal(circuit.samples.length, 1000);
    assert.ok(circuit.totalLength > 3100, `${meta.id} perimeter should exceed 3100m, got ${circuit.totalLength}`);

    const s0 = sampleTrackAtS(circuit, 0);
    const sWrap = sampleTrackAtS(circuit, circuit.totalLength);
    assert.ok(Math.hypot(s0.x - sWrap.x, s0.z - sWrap.z) < 0.05, `${meta.id} loop not closed`);
    assert.ok(Math.abs(Math.hypot(s0.tx, s0.tz) - 1) < 1e-4);
    assert.ok(Math.abs(s0.tx * s0.nx + s0.tz * s0.nz) < 1e-4);
    assert.equal(isInsideCircuitLoop(circuit, circuit.centroid.x, circuit.centroid.z), true, `${meta.id} centroid inside`);
    assert.equal(isInsideCircuitLoop(circuit, -1500, -1500), false);
  }
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
  const cheat = updateLapAndCheckpoints(950, 10, 0b0001, 1, 3, len);
  assert.equal(cheat.lap, 1);
  assert.equal(cheat.completedLap, false);

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

test('all 22 3-wide grid slots spawn bikes cleanly on asphalt facing forward with no overlaps', () => {
  const circuit = getCircuit('lusail');
  const slots = [];
  for (let i = 0; i < 22; i++) {
    const slot = getGridSlotTransform(circuit, i);
    const proj = projectToTrack(circuit, slot.x, slot.z, slot.trackS);
    assert.equal(proj.surface, 'asphalt', `slot ${i} offset=${proj.offset}`);
    assert.ok(slot.trackS < START_LINE_S);
    slots.push(slot);
  }
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const dist = Math.hypot(slots[i].x - slots[j].x, slots[i].z - slots[j].z);
      assert.ok(dist >= 3.0, `grid slots ${i} and ${j} too close: ${dist}`);
    }
  }
});

test('6-speed gearbox shifts smoothly across speed range', () => {
  assert.equal(computeGearAndRpm(0, false).gear, 1);
  assert.equal(computeGearAndRpm(35, false).gear, 3);
  assert.equal(computeGearAndRpm(80, false).gear, 6);
  assert.ok(computeGearAndRpm(80, true).rpm > computeGearAndRpm(80, false).rpm);
});

test('bike acceleration, steering lean, bike-to-bike collision, and ranking behave deterministically', () => {
  const circuit = buildCircuitData(1000, 'lusail');
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

  const aiInput = computeAiInput(bikeB, circuit, [bikeA, bikeB]);
  assert.ok(aiInput.steer >= -1 && aiInput.steer <= 1);
  assert.ok(aiInput.throttle >= 0 && aiInput.throttle <= 1);

  bikeA.totalProgress = 500;
  bikeB.totalProgress = 400;
  updateRaceRankings([bikeB, bikeA]);
  assert.equal(bikeA.rank, 1);
  assert.equal(bikeB.rank, 2);
});

test('career mode uses 20-round real-life GP calendar and promotes Moto3 -> Moto2 -> MotoGP', async () => {
  const { CAREER_CHAMPIONSHIPS, createDefaultCareerProgress, applyCareerRaceOutcome } = await import('./career');
  assert.equal(CAREER_CHAMPIONSHIPS.moto3.rounds.length, 20);
  assert.equal(CAREER_CHAMPIONSHIPS.motogp.rounds[0].grandPrixName, 'GP of Thailand');
  assert.equal(CAREER_CHAMPIONSHIPS.motogp.rounds[19].grandPrixName, 'GP of Valencia');

  let career = createDefaultCareerProgress();
  assert.equal(career.activeClass, 'moto3');

  // Complete first 19 rounds with top finishes (475 pts >= 180 threshold)
  for (let r = 0; r < 19; r++) {
    const res = applyCareerRaceOutcome(career, 1);
    assert.equal(res.seasonFinished, false);
    career = res.updated;
  }

  // Round 20 finishes Moto3 season and promotes to Moto2
  const finalRound = applyCareerRaceOutcome(career, 2);
  assert.equal(finalRound.seasonFinished, true);
  assert.equal(finalRound.wonChampionship, true);
  assert.equal(finalRound.promotedTo, 'moto2');
  assert.equal(finalRound.updated.activeClass, 'moto2');
  assert.ok(finalRound.updated.unlockedClasses.includes('moto2'));
});

test('Moto3 and MotoGP bike classes have distinct acceleration and top speed curves', () => {
  const circuit = getCircuit('lusail');
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

test('solid collisions stop bikes from passing through Tribuns, Buildings, and Armco guardrails', async () => {
  const { buildTracksideLayout } = await import('./tracksideLayout');
  const circuit = getCircuit('lusail');
  const layout = buildTracksideLayout(circuit);
  const tribun = layout.colliders.find((c) => c.kind === 'tribun');
  assert.ok(tribun, 'expected at least one solid tribun collider');

  const bike = createInitialBikeState({
    id: 'tester',
    name: 'Tester',
    livery: TEAM_LIVERIES[0],
    slotIndex: 0,
    circuit,
    isPlayer: true,
    isRemote: false,
    isAi: false,
  });

  // Position bike penetrating slightly into the solid tribun OBB
  const localPenX = tribun.halfX - 0.1;
  const localPenZ = 0;
  bike.x = tribun.x + localPenX * tribun.cosH + localPenZ * tribun.sinH;
  bike.z = tribun.z - localPenX * tribun.sinH + localPenZ * tribun.cosH;
  bike.trackS = projectToTrack(circuit, bike.x, bike.z).s;
  bike.speed = 40;
  const impact = resolveSolidCollisions(bike, layout.colliders, circuit);
  assert.ok(impact !== null, 'expected solid collision impact on tribun OBB');
  assert.ok(impact.kind === 'tribun');
  assert.ok(bike.speed < 40, 'expected speed loss on solid building impact');

  // Verify local point is pushed outside OBB
  const dx = bike.x - tribun.x;
  const dz = bike.z - tribun.z;
  const lx = dx * tribun.cosH - dz * tribun.sinH;
  const lz = dx * tribun.sinH + dz * tribun.cosH;
  const inside = Math.abs(lx) < tribun.halfX + 0.5 && Math.abs(lz) < tribun.halfZ + 0.5;
  assert.equal(inside, false, 'bike must be pushed outside solid tribun OBB');
});

test('AI overtakes slower riders cleanly and navigates >4.5km Sepang circuit without going off-track', () => {
  const circuit = getCircuit('sepang');
  const slowBike = createInitialBikeState({
    id: 'slow',
    name: 'Slow',
    livery: TEAM_LIVERIES[0],
    bikeClass: 'moto3',
    slotIndex: 0,
    circuit,
    isPlayer: false,
    isRemote: false,
    isAi: true,
    aiPaceFactor: 0.72,
  });
  const fastAi = createInitialBikeState({
    id: 'fast',
    name: 'Fast',
    livery: TEAM_LIVERIES[1],
    bikeClass: 'motogp',
    slotIndex: 4,
    circuit,
    isPlayer: false,
    isRemote: false,
    isAi: true,
    aiPaceFactor: 1.02,
  });

  const bikes = [slowBike, fastAi];
  const dt = 0.04;
  let maxPassOffset = 0;
  let maxFastOffset = 0;

  // Simulate 115 seconds on Sepang (~4.7km)
  for (let step = 0; step < 2900; step++) {
    const raceMs = step * dt * 1000;
    updateSlipstreamStatus(bikes, circuit);
    for (const b of bikes) {
      const input = computeAiInput(b, circuit, bikes);
      stepBikePhysics(b, input, dt, circuit, raceMs, 3, true);
    }
    resolveBikeCollisions(bikes);
    maxPassOffset = Math.max(maxPassOffset, Math.abs(fastAi.aiPassOffset));
    maxFastOffset = Math.max(maxFastOffset, Math.abs(fastAi.trackOffset));
  }

  assert.ok(fastAi.lap >= 2, `Fast AI should finish 1+ full lap on 4.7km Sepang, got lap=${fastAi.lap}`);
  assert.ok(fastAi.totalProgress > slowBike.totalProgress, 'Fast AI should cleanly overtake slower rider');
  assert.ok(maxPassOffset > 0.5, `AI should shift laterally to overtake (maxPassOffset=${maxPassOffset})`);
  assert.ok(maxFastOffset < TRACK_HALF_WIDTH + CURB_WIDTH + 3.5, `AI stayed on track (maxOffset=${maxFastOffset})`);
});

test('trackside layout builds upgraded crowd with caps/flags, solid colliders, billboards, and bridges', async () => {
  const { buildTracksideLayout } = await import('./tracksideLayout');
  const circuit = getCircuit('mugello');
  const layout = buildTracksideLayout(circuit);

  assert.equal(layout.grandstands.length, 4);
  for (const gs of layout.grandstands) {
    assert.equal(isInsideCircuitLoop(circuit, gs.x, gs.z), false, `${gs.id} must sit outside circuit loop`);
    const proj = projectToTrack(circuit, gs.x, gs.z, gs.s);
    assert.ok(proj.absOffset >= 20, `${gs.id} too close to track (${proj.absOffset})`);
  }

  assert.ok(layout.spectators.length >= 600, `expected >= 600 upgraded spectators, got ${layout.spectators.length}`);
  assert.ok(layout.flags.length >= 16, `expected >= 16 animated supporter flags, got ${layout.flags.length}`);
  assert.ok(layout.colliders.length >= 10, `expected >= 10 solid colliders for tribuns/buildings, got ${layout.colliders.length}`);
  assert.ok(layout.billboards.length >= 24, `expected >= 24 trackside billboards, got ${layout.billboards.length}`);
  for (const bb of layout.billboards) {
    const proj = projectToTrack(circuit, bb.x, bb.z, bb.s);
    assert.ok(proj.absOffset > TRACK_HALF_WIDTH + CURB_WIDTH + 4, `billboard overlaps track/gravel (${proj.absOffset})`);
  }

  assert.equal(layout.bridges.length, 2);
});

test('Player and AI bikes have identical straight-line acceleration and top speed in the same class', () => {
  const circuit = getCircuit('lusail');
  const playerBike = createInitialBikeState({
    id: 'player',
    name: 'Player',
    livery: TEAM_LIVERIES[0],
    bikeClass: 'motogp',
    slotIndex: 0,
    circuit,
    isPlayer: true,
    isRemote: false,
    isAi: false,
  });
  const aiBike = createInitialBikeState({
    id: 'ai',
    name: 'AI Pro',
    livery: TEAM_LIVERIES[1],
    bikeClass: 'motogp',
    slotIndex: 1,
    circuit,
    isPlayer: false,
    isRemote: false,
    isAi: true,
    aiPaceFactor: 1.0,
  });

  // Put both side-by-side cleanly on asphalt (x = -2 and x = +2) at identical trackS and heading with no slipstream
  const startSmp = sampleTrackAtS(circuit, START_LINE_S - 20);
  const startHeading = Math.atan2(startSmp.tx, startSmp.tz);
  playerBike.x = startSmp.x - startSmp.nx * 2.0;
  playerBike.z = startSmp.z - startSmp.nz * 2.0;
  playerBike.heading = startHeading;
  playerBike.trackS = startSmp.s;
  playerBike.trackOffset = -2.0;
  playerBike.surface = 'asphalt';

  aiBike.x = startSmp.x + startSmp.nx * 2.0;
  aiBike.z = startSmp.z + startSmp.nz * 2.0;
  aiBike.heading = startHeading;
  aiBike.trackS = startSmp.s;
  aiBike.trackOffset = 2.0;
  aiBike.surface = 'asphalt';

  for (let i = 0; i < 80; i++) {
    stepBikePhysics(playerBike, { throttle: 1, brake: 0, steer: 0, boost: false }, 0.04, circuit, i * 40, 3, true);
    stepBikePhysics(aiBike, { throttle: 1, brake: 0, steer: 0, boost: false }, 0.04, circuit, i * 40, 3, true);
  }

  assert.ok(Math.abs(playerBike.speed - aiBike.speed) < 0.01, `player (${playerBike.speed}) and AI (${aiBike.speed}) must share identical power`);
  assert.equal(playerBike.gear, aiBike.gear);
});

test('crashes trigger on gravel washouts and hard wall hits, auto-recover, and resetBikeToTrack restores centerline', async () => {
  const { buildTracksideLayout } = await import('./tracksideLayout');
  const circuit = getCircuit('lusail');
  const layout = buildTracksideLayout(circuit);
  const tribun = layout.colliders.find((c) => c.kind === 'tribun')!;

  const bike = createInitialBikeState({
    id: 'crash-tester',
    name: 'Crash Tester',
    livery: TEAM_LIVERIES[0],
    slotIndex: 0,
    circuit,
    isPlayer: true,
    isRemote: false,
    isAi: false,
  });

  // 1. Heavy impact into solid tribun triggers crash
  const localPenX = tribun.halfX - 0.1;
  bike.x = tribun.x + localPenX * tribun.cosH;
  bike.z = tribun.z - localPenX * tribun.sinH;
  bike.heading = Math.atan2(-(tribun.x - bike.x), -(tribun.z - bike.z)) + Math.PI;
  bike.speed = 55;
  bike.trackS = projectToTrack(circuit, bike.x, bike.z).s;

  const crashStep = stepBikePhysics(
    bike,
    { throttle: 1, brake: 0, steer: 0, boost: false },
    0.04,
    circuit,
    5000,
    3,
    true,
    layout.colliders,
  );
  assert.equal(crashStep.justCrashed, true);
  assert.equal(bike.crashed, true);

  // 2. Simulating > 2.1s auto-recovers bike onto centerline with grace timer
  let recovered = false;
  for (let i = 0; i < 60; i++) {
    const s = stepBikePhysics(bike, { throttle: 0, brake: 0, steer: 0, boost: false }, 0.04, circuit, 5100 + i * 40, 3, true);
    if (s.justRecovered) recovered = true;
  }
  assert.equal(recovered, true);
  assert.equal(bike.crashed, false);
  assert.equal(bike.surface, 'asphalt');
  assert.ok(bike.recoveryGraceTimer > 0);

  // 3. Manual resetBikeToTrack immediately clears an active crash and restores centerline
  bike.recoveryGraceTimer = 0;
  bike.trackOffset = 14;
  bike.speed = 42;
  assert.equal(triggerBikeCrash(bike, -1), true);
  assert.equal(bike.crashed, true);

  resetBikeToTrack(bike, circuit);
  assert.equal(bike.crashed, false);
  assert.equal(bike.speed, 0);
  assert.equal(bike.trackOffset, 0);
  assert.equal(bike.surface, 'asphalt');
});

test('AI navigates all newly upgraded higher-turn technical circuits cleanly without crashing off-track', () => {
  for (const id of ['lusail', 'assen', 'mandalika'] as const) {
    const circuit = getCircuit(id);
    const ai = createInitialBikeState({
      id: `ai-${id}`,
      name: `AI ${id}`,
      livery: TEAM_LIVERIES[2],
      bikeClass: 'motogp',
      slotIndex: 0,
      circuit,
      isPlayer: false,
      isRemote: false,
      isAi: true,
      aiPaceFactor: 1.0,
    });
    const bikes = [ai];
    let crashCount = 0;
    let maxOffset = 0;

    for (let step = 0; step < 1500; step++) {
      const input = computeAiInput(ai, circuit, bikes);
      const res = stepBikePhysics(ai, input, 0.04, circuit, step * 40, 3, true);
      if (res.justCrashed) crashCount++;
      maxOffset = Math.max(maxOffset, Math.abs(ai.trackOffset));
    }
    assert.equal(crashCount, 0, `Pro AI should navigate ${id} technical corners cleanly without crashing (crashes=${crashCount})`);
    assert.ok(maxOffset < TRACK_HALF_WIDTH + CURB_WIDTH + 3.5, `AI stayed on track on ${id}, maxOffset=${maxOffset}`);
    assert.ok(ai.totalProgress > 2200, `AI covered fast distance on ${id}: ${ai.totalProgress}`);
  }
});

test('22-rider roster has unique IDs/numbers and Career Qualifying ranks 22-rider grid accurately', async () => {
  const { buildQualifyingClassification, DEFAULT_RACE_RIDER_COUNT, getPointsForRank } = await import('./career');
  assert.equal(TEAM_LIVERIES.length, 22);
  assert.equal(DEFAULT_RACE_RIDER_COUNT, 22);
  const ids = new Set(TEAM_LIVERIES.map((l) => l.id));
  const numbers = new Set(TEAM_LIVERIES.map((l) => l.number));
  assert.equal(ids.size, 22);
  assert.equal(numbers.size, 22);

  // Official 15-place scoring
  assert.equal(getPointsForRank(1), 25);
  assert.equal(getPointsForRank(15), 1);
  assert.equal(getPointsForRank(16), 0);

  // Fast qualifying lap earns Pole Position (P1) out of 22
  const poleQuali = buildQualifyingClassification({
    circuitId: 'lusail',
    bikeClass: 'motogp',
    aiDifficulty: 0.98,
    playerLivery: TEAM_LIVERIES[0],
    playerName: TEAM_LIVERIES[0].riderName,
    playerLapMs: 42000,
    playerTopSpeedKmh: 332,
  });
  assert.equal(poleQuali.results.length, 22);
  assert.equal(poleQuali.playerGridPos, 1);
  assert.equal(poleQuali.orderedAiLiveryIds.length, 21);

  // Very slow qualifying lap puts player P22 on the back row
  const backRowQuali = buildQualifyingClassification({
    circuitId: 'lusail',
    bikeClass: 'motogp',
    aiDifficulty: 0.98,
    playerLivery: TEAM_LIVERIES[0],
    playerName: TEAM_LIVERIES[0].riderName,
    playerLapMs: 250000,
    playerTopSpeedKmh: 210,
  });
  assert.equal(backRowQuali.results.length, 22);
  assert.equal(backRowQuali.playerGridPos, 22);
});

test('minimap geometry fits all 6 circuits cleanly inside viewport with start/finish marker', () => {
  for (const spec of CIRCUIT_LIST) {
    const circuit = getCircuit(spec.id);
    const geo = buildMinimapGeometry(spec.id, 100, 12);
    assert.ok(geo.pathD.startsWith('M') && geo.pathD.endsWith('Z'), `${spec.id} pathD must be closed`);
    assert.ok(
      geo.startLine.x1 >= 0 && geo.startLine.x1 <= 100 && geo.startLine.y1 >= 0 && geo.startLine.y1 <= 100,
      `${spec.id} startLine p1 inside 0..100`,
    );
    assert.ok(
      geo.startLine.x2 >= 0 && geo.startLine.x2 <= 100 && geo.startLine.y2 >= 0 && geo.startLine.y2 <= 100,
      `${spec.id} startLine p2 inside 0..100`,
    );
    for (let i = 0; i < circuit.samples.length; i += 25) {
      const s = circuit.samples[i];
      const pt = projectPointToMinimap(s.x, s.z, geo);
      assert.ok(pt.x >= 10 && pt.x <= 90, `${spec.id} sample x (${pt.x}) within padded viewport`);
      assert.ok(pt.y >= 10 && pt.y <= 90, `${spec.id} sample y (${pt.y}) within padded viewport`);
    }
  }
});
