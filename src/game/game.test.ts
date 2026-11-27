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

test('Moto3, Moto2, and MotoGP each have dedicated 22-rider rosters with unique IDs and numbers', async () => {
  const { getClassLiveries, MOTO2_RIDERS, MOTO3_RIDERS, MOTOGP_RIDERS } = await import('./types');

  for (const [label, roster] of [
    ['Moto3', MOTO3_RIDERS],
    ['Moto2', MOTO2_RIDERS],
    ['MotoGP', MOTOGP_RIDERS],
  ] as const) {
    assert.equal(roster.length, 22, `${label} should have 22 riders`);
    assert.equal(new Set(roster.map((r) => r.id)).size, 22, `${label} IDs must be unique`);
    assert.equal(new Set(roster.map((r) => r.number)).size, 22, `${label} numbers must be unique`);
  }

  assert.equal(getClassLiveries('moto3')[0].riderName, MOTO3_RIDERS[0].riderName);
  assert.equal(getClassLiveries('moto2')[0].riderName, MOTO2_RIDERS[0].riderName);
  assert.equal(getClassLiveries('motogp')[0].riderName, MOTOGP_RIDERS[0].riderName);
  assert.notEqual(MOTO3_RIDERS[0].riderName, MOTO2_RIDERS[0].riderName);
  assert.notEqual(MOTO2_RIDERS[0].riderName, MOTOGP_RIDERS[0].riderName);
});

test('live leaderboard slices cycle cleanly across 1-5, 6-10, 11-15 and wrap back to 1-5', async () => {
  const { getLeaderboardPageSlice } = await import('./leaderboard');
  const { MOTOGP_RIDERS } = await import('./types');

  const board = MOTOGP_RIDERS.map((liv, idx) => ({
    id: liv.id,
    rank: idx + 1,
    name: liv.riderName,
    color: liv.primaryHex,
    liveryId: liv.id,
    nationality: liv.nationality,
    isPlayer: idx === 12, // player running P13
    crashed: false,
  }));

  const page0 = getLeaderboardPageSlice(board, 0);
  assert.equal(page0.rangeLabel, '1-5');
  assert.equal(page0.totalPages, 3);
  assert.deepEqual(page0.rows.map((r) => r.rank), [1, 2, 3, 4, 5]);
  assert.equal(page0.pinnedPlayer?.rank, 13);

  const page1 = getLeaderboardPageSlice(board, 1);
  assert.equal(page1.rangeLabel, '6-10');
  assert.deepEqual(page1.rows.map((r) => r.rank), [6, 7, 8, 9, 10]);
  assert.equal(page1.pinnedPlayer?.rank, 13);

  const page2 = getLeaderboardPageSlice(board, 2);
  assert.equal(page2.rangeLabel, '11-15');
  assert.deepEqual(page2.rows.map((r) => r.rank), [11, 12, 13, 14, 15]);
  assert.equal(page2.pinnedPlayer, null);

  const page3 = getLeaderboardPageSlice(board, 3);
  assert.equal(page3.rangeLabel, '1-5');
  assert.equal(page3.pageIndex, 0);
});

test('career qualifying draws AI competitors strictly from the active bike class roster', async () => {
  const { buildQualifyingClassification } = await import('./career');
  const { MOTO2_RIDERS, MOTO3_RIDERS } = await import('./types');

  const m3Set = new Set(MOTO3_RIDERS.map((r) => r.id));
  const m3Quali = buildQualifyingClassification({
    circuitId: 'lusail',
    bikeClass: 'moto3',
    aiDifficulty: 0.96,
    playerLivery: MOTO3_RIDERS[0],
    playerName: MOTO3_RIDERS[0].riderName,
    playerLapMs: 92000,
    playerTopSpeedKmh: 230,
  });
  assert.equal(m3Quali.results.length, 22);
  assert.ok(m3Quali.orderedAiLiveryIds.every((id) => m3Set.has(id)));

  const m2Set = new Set(MOTO2_RIDERS.map((r) => r.id));
  const m2Quali = buildQualifyingClassification({
    circuitId: 'mugello',
    bikeClass: 'moto2',
    aiDifficulty: 0.97,
    playerLivery: MOTO2_RIDERS[0],
    playerName: MOTO2_RIDERS[0].riderName,
    playerLapMs: 85000,
    playerTopSpeedKmh: 270,
  });
  assert.equal(m2Quali.results.length, 22);
  assert.ok(m2Quali.orderedAiLiveryIds.every((id) => m2Set.has(id)));
});

test('procedural engine audio synthesizes distinct Moto3, Moto2, and MotoGP profiles with RPM & gear pitch shift', async () => {
  const { computeEngineAudioParams } = await import('./audio');

  const m3 = computeEngineAudioParams(10000, 1, false, 'moto3', 3);
  const m2 = computeEngineAudioParams(10000, 1, false, 'moto2', 3);
  const gp = computeEngineAudioParams(10000, 1, false, 'motogp', 3);

  assert.notEqual(m3.fundamentalHz, m2.fundamentalHz);
  assert.notEqual(m2.fundamentalHz, gp.fundamentalHz);
  assert.equal(m3.subHarmonicHz / m3.fundamentalHz, 0.5);
  assert.equal(m2.subHarmonicHz / m2.fundamentalHz, 1.5);
  assert.equal(gp.subHarmonicHz / gp.fundamentalHz, 0.75);

  const lowRpm = computeEngineAudioParams(5000, 0.5, false, 'motogp', 2);
  const highRpm = computeEngineAudioParams(15000, 1.0, false, 'motogp', 2);
  assert.ok(highRpm.fundamentalHz > lowRpm.fundamentalHz * 2.5);
  assert.ok(highRpm.filterHz > lowRpm.filterHz);

  const g1 = computeEngineAudioParams(12000, 1, false, 'motogp', 1);
  const g6 = computeEngineAudioParams(12000, 1, false, 'motogp', 6);
  assert.ok(g6.fundamentalHz > g1.fundamentalHz);
});

test('career 22-rider season standings promotes Top 1-3 across classes and denies 4th+ place', async () => {
  const {
    applyCareerRaceOutcome,
    createDefaultCareerProgress,
    getCareerSeasonStandings,
  } = await import('./career');

  // 1. Consistently P2 finishes Moto3 in Top 3 -> promotes to Moto2
  let c = createDefaultCareerProgress();
  for (let r = 0; r < 19; r++) {
    c = applyCareerRaceOutcome(c, 2).updated;
  }
  const standingBeforeLast = getCareerSeasonStandings(c);
  assert.equal(standingBeforeLast.length, 22);
  assert.ok((standingBeforeLast.find((s) => s.isPlayer)?.rank ?? 22) <= 3);

  const m3Promo = applyCareerRaceOutcome(c, 3);
  assert.equal(m3Promo.seasonFinished, true);
  assert.ok(m3Promo.seasonRank <= 3);
  assert.equal(m3Promo.promotedTo, 'moto2');
  assert.equal(m3Promo.updated.activeClass, 'moto2');

  // 2. Moto2 consistent Top 3 finishes -> promotes to MotoGP
  let m2 = m3Promo.updated;
  for (let r = 0; r < 19; r++) {
    m2 = applyCareerRaceOutcome(m2, 1).updated;
  }
  const m2Promo = applyCareerRaceOutcome(m2, 1);
  assert.equal(m2Promo.seasonFinished, true);
  assert.equal(m2Promo.seasonRank, 1);
  assert.equal(m2Promo.promotedTo, 'motogp');
  assert.equal(m2Promo.updated.activeClass, 'motogp');

  // 3. Finishing outside Top 3 (e.g., P10 every race) does NOT promote
  let back = createDefaultCareerProgress();
  for (let r = 0; r < 19; r++) {
    back = applyCareerRaceOutcome(back, 10).updated;
  }
  const denied = applyCareerRaceOutcome(back, 10);
  assert.equal(denied.seasonFinished, true);
  assert.ok(denied.seasonRank > 3, `expected seasonRank > 3, got ${denied.seasonRank}`);
  assert.equal(denied.promotedTo, null);
  assert.equal(denied.updated.activeClass, 'moto3');
});

test('steering sensitivity clamps safely and smooths left/right turn-in responsiveness', async () => {
  const {
    clampSteeringSensitivity,
    computeSteerInputStep,
    DEFAULT_STEERING_SENSITIVITY,
  } = await import('./physics');

  assert.equal(clampSteeringSensitivity(0.05), 0.25);
  assert.equal(clampSteeringSensitivity(2.5), 1.2);
  assert.equal(clampSteeringSensitivity(Number.NaN), DEFAULT_STEERING_SENSITIVITY);
  assert.equal(clampSteeringSensitivity(0.6), 0.6);

  const lowSensStep = computeSteerInputStep(1, 0, 0.35, 0.016);
  const highSensStep = computeSteerInputStep(1, 0, 1.15, 0.016);
  assert.ok(lowSensStep > 0 && lowSensStep < highSensStep);
  assert.ok(highSensStep <= 1.15);

  const centered = computeSteerInputStep(0, 0.001, 0.6, 0.05);
  assert.equal(centered, 0);
});

test('dynamic weather transitions from clear skies to clouds and asymmetric rain patches affecting racing lines', async () => {
  const {
    createInitialWeatherState,
    evaluateRainPatchAt,
    findNearestRainPatchAhead,
    stepDynamicWeather,
  } = await import('./weather');
  const { computeAiInput, createInitialBikeState, stepBikePhysics } = await import('./physics');
  const { getCircuit, sampleTrackAtS, TRACK_HALF_WIDTH } = await import('./trackMath');
  const { MOTOGP_RIDERS } = await import('./types');

  const circuit = getCircuit('lusail');
  const weather = createInitialWeatherState(2026);
  assert.equal(weather.phase, 'clear');
  assert.equal(weather.patches.length, 0);

  stepDynamicWeather(weather, circuit, 8000, 0.1, false);
  assert.equal(weather.phase, 'clouds');

  stepDynamicWeather(weather, circuit, 15000, 0.5, false);
  assert.equal(weather.phase, 'rain');
  assert.equal(weather.patches.length, 10);

  for (const patch of weather.patches) {
    assert.ok(Math.abs(patch.lateralCenter) < TRACK_HALF_WIDTH);
    assert.ok(patch.radiusS > 0 && patch.radiusLat > 0);
  }

  const targetPatch = weather.patches[0];
  const wetCheck = evaluateRainPatchAt(circuit, targetPatch.s, targetPatch.lateralCenter, weather.patches);
  assert.equal(wetCheck.onPatch, true);
  assert.ok(wetCheck.wetness > 0.5);

  const drySideOffset = targetPatch.lateralCenter >= 0 ? -5.8 : 5.8;
  const dryCheck = evaluateRainPatchAt(circuit, targetPatch.s, drySideOffset, weather.patches);
  assert.equal(dryCheck.onPatch, false);

  const aheadFound = findNearestRainPatchAhead(circuit, targetPatch.s - 20, 60, weather.patches);
  assert.ok(aheadFound !== null);

  // Physics marks onRainPatch & AI steers away from wet patch directly in front of its lane
  const patchSmp = sampleTrackAtS(circuit, targetPatch.s);
  const bikeDry = createInitialBikeState({
    id: 'test-ai',
    name: MOTOGP_RIDERS[0].riderName,
    livery: MOTOGP_RIDERS[0],
    bikeClass: 'motogp',
    slotIndex: 0,
    circuit,
    isPlayer: false,
    isRemote: false,
    isAi: true,
  });
  bikeDry.x = patchSmp.x + patchSmp.nx * targetPatch.lateralCenter;
  bikeDry.z = patchSmp.z + patchSmp.nz * targetPatch.lateralCenter;
  bikeDry.heading = Math.atan2(patchSmp.tx, patchSmp.tz);
  bikeDry.trackS = targetPatch.s;
  bikeDry.trackOffset = targetPatch.lateralCenter;
  bikeDry.speed = 62;
  stepBikePhysics(
    bikeDry,
    { throttle: 1, brake: 0, steer: 0, boost: false },
    0.05,
    circuit,
    15500,
    3,
    true,
    [],
    weather.patches,
    weather.rainIntensity,
  );
  assert.equal(bikeDry.onRainPatch, true);

  const aheadS = (targetPatch.s - 18 + circuit.totalLength) % circuit.totalLength;
  const aheadSmp = sampleTrackAtS(circuit, aheadS);
  const aiApproaching = createInitialBikeState({
    id: 'test-ai-2',
    name: MOTOGP_RIDERS[1].riderName,
    livery: MOTOGP_RIDERS[1],
    bikeClass: 'motogp',
    slotIndex: 1,
    circuit,
    isPlayer: false,
    isRemote: false,
    isAi: true,
  });
  aiApproaching.x = aheadSmp.x + aheadSmp.nx * targetPatch.lateralCenter;
  aiApproaching.z = aheadSmp.z + aheadSmp.nz * targetPatch.lateralCenter;
  aiApproaching.heading = Math.atan2(aheadSmp.tx, aheadSmp.tz);
  aiApproaching.trackS = aheadS;
  aiApproaching.trackOffset = targetPatch.lateralCenter;
  aiApproaching.speed = 55;
  aiApproaching.aiTargetOffset = targetPatch.lateralCenter;
  const aiInput = computeAiInput(aiApproaching, circuit, [aiApproaching], weather.patches);
  assert.notEqual(aiInput.steer, 0, 'AI should adjust steering to dodge rain patch ahead');
});

test('pre-race & post-race commentary reflect rider, circuit, weather rain patches, and career outcome', async () => {
  const { buildPostRaceCommentary, buildPreRaceCommentary } = await import('./commentary');
  const { MOTO2_RIDERS, MOTOGP_RIDERS } = await import('./types');

  const pre = buildPreRaceCommentary({
    circuitId: 'mandalika',
    bikeClass: 'motogp',
    sessionType: 'race',
    playerLivery: MOTOGP_RIDERS[0],
    playerGridPos: 2,
    totalRiders: 22,
    weatherPhase: 'clear',
  });
  assert.ok(pre.headline.includes('Mandalika'));
  assert.ok(pre.lines.join(' ').includes(MOTOGP_RIDERS[0].riderName));
  assert.ok(pre.lines.join(' ').toLowerCase().includes('rain patches'));

  const post = buildPostRaceCommentary({
    circuitId: 'mugello',
    bikeClass: 'moto2',
    sessionType: 'race',
    weatherHadRain: true,
    results: [
      {
        id: 'local',
        name: MOTO2_RIDERS[0].riderName,
        livery: MOTO2_RIDERS[0],
        rank: 1,
        finishTimeMs: 142300,
        bestLapMs: 70500,
        topSpeedKmh: 289,
        isPlayer: true,
        isAi: false,
      },
    ],
    careerOutcome: {
      pointsEarned: 25,
      seasonRank: 2,
      promotedTo: 'motogp',
      wonChampionship: false,
    },
  });
  assert.ok(post.headline.includes(MOTO2_RIDERS[0].riderName));
  assert.ok(post.lines[0].toLowerCase().includes('rain patches'));
  assert.ok(post.lines[0].includes('MotoGP'));
});

test('MotoGP championship menu anthem generates 64-step orchestral motif and all 66 riders have valid flags & faces', async () => {
  const { getTitleAnthemStepSpec } = await import('./audio');
  const {
    COUNTRY_NAMES,
    getRiderFaceStyle,
    MOTO2_RIDERS,
    MOTO3_RIDERS,
    MOTOGP_RIDERS,
  } = await import('./types');

  const step0 = getTitleAnthemStepSpec(0);
  assert.equal(step0.crashCymbal, true);
  assert.equal(step0.kick, true);
  assert.ok(step0.leadHz !== null && step0.bassHz > 0 && step0.ostinatoHz > 0);

  let leadCount = 0;
  for (let i = 0; i < 64; i++) {
    const spec = getTitleAnthemStepSpec(i);
    if (spec.leadHz !== null) leadCount++;
  }
  assert.ok(leadCount >= 16);

  for (const r of [...MOTO3_RIDERS, ...MOTO2_RIDERS, ...MOTOGP_RIDERS]) {
    assert.ok(COUNTRY_NAMES[r.nationality], `missing country mapping for ${r.riderName}`);
    const face = getRiderFaceStyle(r);
    assert.ok(face.skinHex.startsWith('#') && face.hairHex.startsWith('#'));
  }
});

test('crash isolation ensures uninvolved AI riders maintain full race pace when another bike crashes ahead', () => {
  const circuit = getCircuit('lusail');
  const crashedBike = createInitialBikeState({
    id: 'crashed-rider',
    name: 'Crashed Rider',
    livery: TEAM_LIVERIES[0],
    bikeClass: 'motogp',
    slotIndex: 0,
    circuit,
    isPlayer: true,
    isRemote: false,
    isAi: false,
  });
  const passingAi = createInitialBikeState({
    id: 'passing-ai',
    name: 'Passing AI',
    livery: TEAM_LIVERIES[1],
    bikeClass: 'motogp',
    slotIndex: 1,
    circuit,
    isPlayer: false,
    isRemote: false,
    isAi: true,
    aiPaceFactor: 1.0,
  });
  const trailingAi = createInitialBikeState({
    id: 'trailing-ai',
    name: 'Trailing AI',
    livery: TEAM_LIVERIES[2],
    bikeClass: 'motogp',
    slotIndex: 2,
    circuit,
    isPlayer: false,
    isRemote: false,
    isAi: true,
    aiPaceFactor: 1.0,
  });

  // Put crashed rider 14m ahead of passingAi in the same lane on a straight
  const smpAhead = sampleTrackAtS(circuit, START_LINE_S + 200);
  crashedBike.x = smpAhead.x;
  crashedBike.z = smpAhead.z;
  crashedBike.trackS = smpAhead.s;
  crashedBike.heading = Math.atan2(smpAhead.tx, smpAhead.tz);
  crashedBike.speed = 35;
  triggerBikeCrash(crashedBike, 1);
  assert.equal(crashedBike.crashed, true);

  const smpBehind = sampleTrackAtS(circuit, START_LINE_S + 186);
  passingAi.x = smpBehind.x;
  passingAi.z = smpBehind.z;
  passingAi.trackS = smpBehind.s;
  passingAi.heading = Math.atan2(smpBehind.tx, smpBehind.tz);
  passingAi.speed = 65;

  const smpFar = sampleTrackAtS(circuit, START_LINE_S + 130);
  trailingAi.x = smpFar.x;
  trailingAi.z = smpFar.z;
  trailingAi.trackS = smpFar.s;
  trailingAi.heading = Math.atan2(smpFar.tx, smpFar.tz);
  trailingAi.speed = 65;

  const inputPassing = computeAiInput(passingAi, circuit, [crashedBike, passingAi, trailingAi]);
  // Passing AI keeps full throttle to sweep cleanly around the crashed bike without global braking!
  assert.equal(inputPassing.throttle, 1);
  assert.equal(inputPassing.brake, 0);

  // Step physics for all 3 bikes: crashed bike slows heavily while uninvolved AIs keep full speed
  const startSpeedPassing = passingAi.speed;
  const startSpeedTrailing = trailingAi.speed;
  for (let i = 0; i < 25; i++) {
    stepBikePhysics(crashedBike, { throttle: 0, brake: 0, steer: 0, boost: false }, 0.04, circuit, 8000 + i * 40, 3, true);
    const inP = computeAiInput(passingAi, circuit, [crashedBike, passingAi, trailingAi]);
    const inT = computeAiInput(trailingAi, circuit, [crashedBike, passingAi, trailingAi]);
    stepBikePhysics(passingAi, inP, 0.04, circuit, 8000 + i * 40, 3, true);
    stepBikePhysics(trailingAi, inT, 0.04, circuit, 8000 + i * 40, 3, true);
  }
  assert.ok(crashedBike.speed < 25, `crashed bike loses speed (${crashedBike.speed})`);
  assert.ok(passingAi.speed >= startSpeedPassing, `passing AI should accelerate/maintain pace (${passingAi.speed} vs ${startSpeedPassing})`);
  assert.ok(trailingAi.speed >= startSpeedTrailing, 'trailing AI unaffected by another rider crash');
});

test('male commentary voice picker selects male English voice and produces humanized Marco Bellini script', async () => {
  const { pickMaleEnglishVoice, buildPreRaceCommentary } = await import('./commentary');

  const voices = [
    { name: 'Samantha', lang: 'en-US', default: true },
    { name: 'Google US English', lang: 'en-US', default: false },
    { name: 'Microsoft Zira Desktop', lang: 'en-US', default: false },
    { name: 'Daniel', lang: 'en-GB', default: false },
    { name: 'Arthur', lang: 'en-GB', default: false },
  ];
  const picked = pickMaleEnglishVoice(voices);
  assert.ok(picked && (picked.name === 'Daniel' || picked.name === 'Arthur'), `expected male UK voice, got ${picked?.name}`);

  const pre = buildPreRaceCommentary({
    circuitId: 'lusail',
    bikeClass: 'motogp',
    sessionType: 'race',
    playerLivery: TEAM_LIVERIES[0],
    playerGridPos: 1,
    totalRiders: 22,
    weatherPhase: 'clear',
  });
  assert.ok(pre.caster.includes('Marco Bellini'));
  assert.ok(pre.lines.join(' ').includes('green flags'));
});

test('3D rider rig includes head, ears, eyes, nose, mouth, body, 5-finger hands gripping handlebars via IK, and animated feet', async () => {
  const THREE = await import('three');
  const { solveRiderArmIK, createMotoBikeRig, animateBikeRiderPose, createStandingRiderMesh } = await import('./bikeMesh');

  // 1. Verify exact 2-bone analytical arm IK solution error < 1e-4
  const solved = solveRiderArmIK(1, new THREE.Vector3(0.192, 0.41, 0.07), new THREE.Vector3(0.24, 0.06, 0.44));
  assert.ok(solved.wristLocalError < 1e-4, `IK error too high: ${solved.wristLocalError}`);

  // 2. Build full bike + rider rig & standing podium rider with a minimal canvas stub for Node
  const origDoc = (globalThis as { document?: unknown }).document;
  const noopCtx = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
          return () => ({ addColorStop: () => {} });
        }
        if (prop === 'measureText') return () => ({ width: 20 });
        return () => {};
      },
      set: () => true,
    },
  );
  (globalThis as { document: unknown }).document = {
    createElement: () => ({
      width: 256,
      height: 256,
      getContext: () => noopCtx,
    }),
  };

  try {
    const tex = new THREE.Texture();
    const rig = createMotoBikeRig(TEAM_LIVERIES[0], tex, false, 'motogp');

    const names = new Set<string>();
    rig.root.traverse((o) => {
      if (o.name) names.add(o.name);
    });

    for (const required of [
      'head',
      'earL',
      'earR',
      'eyeL',
      'eyeR',
      'nose',
      'mouth',
      'bodyTorso',
      'bodyChest',
      'leftHand',
      'rightHand',
      'leftThumb',
      'rightThumb',
      'left_finger_index',
      'left_finger_middle',
      'left_finger_ring',
      'left_finger_pinky',
      'right_finger_index',
      'right_finger_pinky',
      'leftFoot',
      'rightFoot',
    ]) {
      assert.ok(names.has(required), `missing required 3D anatomical part: ${required}`);
    }

    // Animate riding pose with steering & verify hands stay locked to clip-on handlebars!
    rig.frontForkGroup.rotation.y = -0.25 * 0.45;
    animateBikeRiderPose(rig, {
      speed: 55,
      leanAngle: 0.45,
      steerVisual: 0.25,
      gear: 1,
      brake: 0,
      isBoosting: false,
      crashed: false,
      preRaceIdle: false,
      timeSec: 1.0,
      riderSeed: 1,
      dt: 0.05,
    });
    rig.root.updateMatrixWorld(true);

    const worldLeftHand = new THREE.Vector3();
    const worldLeftGrip = rig.leftGripAnchor.clone().applyMatrix4(rig.frontForkGroup.matrixWorld);
    rig.riderJoints.leftArm.wristPivot.getWorldPosition(worldLeftHand);
    const leftDist = worldLeftHand.distanceTo(worldLeftGrip);
    assert.ok(leftDist < 0.025, `left hand detached from handlebar grip: dist=${leftDist}`);

    const worldRightHand = new THREE.Vector3();
    const worldRightGrip = rig.rightGripAnchor.clone().applyMatrix4(rig.frontForkGroup.matrixWorld);
    rig.riderJoints.rightArm.wristPivot.getWorldPosition(worldRightHand);
    const rightDist = worldRightHand.distanceTo(worldRightGrip);
    assert.ok(rightDist < 0.025, `right hand detached from handlebar grip: dist=${rightDist}`);

    // Trigger gear shift and advance cleanly into mid-shift ankle flexion
    for (let k = 0; k < 3; k++) {
      animateBikeRiderPose(rig, {
        speed: 60,
        leanAngle: 0,
        steerVisual: 0,
        gear: 2,
        brake: 0,
        isBoosting: false,
        crashed: false,
        preRaceIdle: false,
        timeSec: 1.05 + k * 0.04,
        riderSeed: 1,
        dt: 0.04,
      });
    }
    assert.ok(
      Math.abs(rig.riderJoints.leftLeg.footPivot.rotation.x) > 0.05,
      `left foot should animate on gear shift (${rig.riderJoints.leftLeg.footPivot.rotation.x})`,
    );

    const podiumRider = createStandingRiderMesh(TEAM_LIVERIES[0]);
    const podiumNames = new Set<string>();
    podiumRider.root.traverse((o) => {
      if (o.name) podiumNames.add(o.name);
    });
    assert.ok(podiumNames.has('head') && podiumNames.has('mouth') && podiumNames.has('leftFoot') && podiumNames.has('rightHand'));

    rig.dispose();
    podiumRider.dispose();
    tex.dispose();
  } finally {
    if (origDoc === undefined) {
      delete (globalThis as { document?: unknown }).document;
    } else {
      (globalThis as { document?: unknown }).document = origDoc;
    }
  }
});




