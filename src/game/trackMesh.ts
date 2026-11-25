import * as THREE from 'three';
import {
  CircuitData,
  CURB_WIDTH,
  GRAVEL_WIDTH,
  sampleTrackAtS,
  START_LINE_S,
  TRACK_HALF_WIDTH,
  WORLD_BOUNDARY_RADIUS,
} from './trackMath';
import type { ProceduralTextures } from './textures';

export interface TrackWorld {
  group: THREE.Group;
  startLights: THREE.Mesh[];
  setStartLights: (litCount: number, allGreen?: boolean) => void;
  dispose: () => void;
}

function buildRibbonGeometry(
  circuit: CircuitData,
  innerOffset: number,
  outerOffset: number,
  y: number,
  uTile: number,
  vRepeatPerMeter: number,
): THREE.BufferGeometry {
  const { samples, totalLength } = circuit;
  const count = samples.length;
  const positions = new Float32Array((count + 1) * 2 * 3);
  const normals = new Float32Array((count + 1) * 2 * 3);
  const uvs = new Float32Array((count + 1) * 2 * 2);
  const indices: number[] = [];

  for (let i = 0; i <= count; i++) {
    const smp = samples[i % count];
    const s = i === count ? totalLength : smp.s;

    const ix = smp.x + smp.nx * innerOffset;
    const iz = smp.z + smp.nz * innerOffset;
    const ox = smp.x + smp.nx * outerOffset;
    const oz = smp.z + smp.nz * outerOffset;

    const vBase = i * 2;
    positions[vBase * 3] = ix;
    positions[vBase * 3 + 1] = y;
    positions[vBase * 3 + 2] = iz;

    positions[(vBase + 1) * 3] = ox;
    positions[(vBase + 1) * 3 + 1] = y;
    positions[(vBase + 1) * 3 + 2] = oz;

    normals[vBase * 3] = 0;
    normals[vBase * 3 + 1] = 1;
    normals[vBase * 3 + 2] = 0;
    normals[(vBase + 1) * 3] = 0;
    normals[(vBase + 1) * 3 + 1] = 1;
    normals[(vBase + 1) * 3 + 2] = 0;

    const vCoord = s * vRepeatPerMeter;
    uvs[vBase * 2] = 0;
    uvs[vBase * 2 + 1] = vCoord;
    uvs[(vBase + 1) * 2] = uTile;
    uvs[(vBase + 1) * 2 + 1] = vCoord;

    if (i < count) {
      const a = vBase;
      const b = vBase + 1;
      const c = vBase + 2;
      const d = vBase + 3;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

// Helper to build a realistic tiered grandstand ("Tribun") facing the track.
// `trackDirectionSign`: +1 if track center is toward local +X, -1 if track center is toward local -X.
function buildGrandstand(
  lengthZ: number,
  trackDirectionSign: 1 | -1,
  seatColorHex: number,
  canopyColorHex: number,
  disposables: Array<{ dispose: () => void }>,
): THREE.Group {
  const stand = new THREE.Group();
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.78 });
  const seatMat = new THREE.MeshStandardMaterial({ color: seatColorHex, roughness: 0.52 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.38, metalness: 0.8 });
  const canopyMat = new THREE.MeshStandardMaterial({ color: canopyColorHex, roughness: 0.42, metalness: 0.15 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.35, metalness: 0.6 });
  disposables.push(concreteMat, seatMat, steelMat, canopyMat, railMat);

  // Front safety wall facing the track
  const frontWallGeo = new THREE.BoxGeometry(0.45, 1.4, lengthZ);
  const frontWall = new THREE.Mesh(frontWallGeo, railMat);
  frontWall.position.set(trackDirectionSign * 1.4, 0.7, 0);
  stand.add(frontWall);
  disposables.push(frontWallGeo);

  // 5 stepped seating tiers climbing AWAY from the track (-trackDirectionSign)
  const tierGeo = new THREE.BoxGeometry(2.6, 1.15, lengthZ);
  const seatRowGeo = new THREE.BoxGeometry(1.1, 0.32, lengthZ - 1.2);
  disposables.push(tierGeo, seatRowGeo);

  for (let t = 0; t < 5; t++) {
    const xPos = -trackDirectionSign * t * 2.3;
    const yBase = 0.6 + t * 1.15;

    const step = new THREE.Mesh(tierGeo, concreteMat);
    step.position.set(xPos, yBase, 0);
    step.castShadow = true;
    step.receiveShadow = true;
    stand.add(step);

    const seats = new THREE.Mesh(seatRowGeo, seatMat);
    seats.position.set(xPos + trackDirectionSign * 0.35, yBase + 0.72, 0);
    stand.add(seats);
  }

  // Rear structural wall & steel columns supporting cantilevered grandstand roof
  const backX = -trackDirectionSign * 10.6;
  const backWallGeo = new THREE.BoxGeometry(0.5, 8.8, lengthZ);
  const backWall = new THREE.Mesh(backWallGeo, concreteMat);
  backWall.position.set(backX, 4.4, 0);
  stand.add(backWall);
  disposables.push(backWallGeo);

  const colGeo = new THREE.CylinderGeometry(0.22, 0.26, 9.6, 8);
  disposables.push(colGeo);
  for (let c = -2; c <= 2; c++) {
    const col = new THREE.Mesh(colGeo, steelMat);
    col.position.set(backX + trackDirectionSign * 0.8, 4.8, (c / 2) * (lengthZ * 0.44));
    stand.add(col);
  }

  // Cantilevered canopy sloping cleanly over the spectators toward the track
  const canopyGeo = new THREE.BoxGeometry(13.5, 0.38, lengthZ + 2);
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.position.set(-trackDirectionSign * 4.5, 9.3, 0);
  canopy.rotation.z = trackDirectionSign * 0.12;
  canopy.castShadow = true;
  stand.add(canopy);
  disposables.push(canopyGeo);

  return stand;
}

export function createTrackWorld(circuit: CircuitData, textures: ProceduralTextures): TrackWorld {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  // 1. Sunlit countryside grass terrain
  const groundGeo = new THREE.PlaneGeometry(1200, 1200);
  groundGeo.rotateX(-Math.PI / 2);
  const groundMat = new THREE.MeshStandardMaterial({
    map: textures.grassMap,
    roughness: 0.92,
    metalness: 0.0,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  group.add(ground);
  disposables.push(groundGeo, groundMat);

  // 2. Gravel run-off apron around track perimeter
  const gravelMat = new THREE.MeshStandardMaterial({
    map: textures.gravelMap,
    roughness: 0.95,
    metalness: 0.0,
  });
  const gravelGeo = buildRibbonGeometry(
    circuit,
    -(TRACK_HALF_WIDTH + CURB_WIDTH + GRAVEL_WIDTH),
    TRACK_HALF_WIDTH + CURB_WIDTH + GRAVEL_WIDTH,
    -0.025,
    4,
    0.18,
  );
  const gravelMesh = new THREE.Mesh(gravelGeo, gravelMat);
  gravelMesh.receiveShadow = true;
  group.add(gravelMesh);
  disposables.push(gravelGeo, gravelMat);

  // 3. Main MotoGP Asphalt Surface
  const asphaltMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.asphaltMap,
    bumpMap: textures.asphaltBump,
    bumpScale: 0.035,
    roughness: 0.72,
    metalness: 0.06,
  });
  const asphaltGeo = buildRibbonGeometry(circuit, -TRACK_HALF_WIDTH, TRACK_HALF_WIDTH, 0.0, 1, 0.08);
  const asphaltMesh = new THREE.Mesh(asphaltGeo, asphaltMat);
  asphaltMesh.receiveShadow = true;
  group.add(asphaltMesh);
  disposables.push(asphaltGeo, asphaltMat);

  // 4. Red & White FIA Curbing along both sides
  const curbMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.curbMap,
    roughness: 0.58,
    metalness: 0.05,
  });
  const leftCurbGeo = buildRibbonGeometry(circuit, -(TRACK_HALF_WIDTH + CURB_WIDTH), -TRACK_HALF_WIDTH, 0.02, 1, 0.35);
  const rightCurbGeo = buildRibbonGeometry(circuit, TRACK_HALF_WIDTH, TRACK_HALF_WIDTH + CURB_WIDTH, 0.02, 1, 0.35);
  const leftCurb = new THREE.Mesh(leftCurbGeo, curbMat);
  const rightCurb = new THREE.Mesh(rightCurbGeo, curbMat);
  leftCurb.receiveShadow = true;
  rightCurb.receiveShadow = true;
  group.add(leftCurb, rightCurb);
  disposables.push(leftCurbGeo, rightCurbGeo, curbMat);

  // 5. Checkered Start/Finish Line Strip + Painted Starting Grid Boxes
  const startSample = sampleTrackAtS(circuit, START_LINE_S);
  const startHeading = Math.atan2(startSample.tx, startSample.tz);

  const finishLineGeo = new THREE.PlaneGeometry(TRACK_HALF_WIDTH * 2, 2.4);
  finishLineGeo.rotateX(-Math.PI / 2);
  const finishLineMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.checkeredMap,
    roughness: 0.55,
  });
  const finishLine = new THREE.Mesh(finishLineGeo, finishLineMat);
  finishLine.position.set(startSample.x, 0.025, startSample.z);
  finishLine.rotation.y = startHeading;
  finishLine.receiveShadow = true;
  group.add(finishLine);
  disposables.push(finishLineGeo, finishLineMat);

  // Starting grid white U-brackets for 6 grid slots
  const gridLineMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
  const gridFrontGeo = new THREE.PlaneGeometry(1.7, 0.16);
  gridFrontGeo.rotateX(-Math.PI / 2);
  const gridSideGeo = new THREE.PlaneGeometry(0.14, 1.8);
  gridSideGeo.rotateX(-Math.PI / 2);
  disposables.push(gridLineMat, gridFrontGeo, gridSideGeo);

  for (let slot = 0; slot < 6; slot++) {
    const row = Math.floor(slot / 2);
    const col = slot % 2;
    const sBack = START_LINE_S - 10 - row * 7.5 + 1.0;
    const lat = col === 0 ? -2.6 : 2.6;
    const smp = sampleTrackAtS(circuit, sBack);
    const box = new THREE.Group();
    box.position.set(smp.x + smp.nx * lat, 0.022, smp.z + smp.nz * lat);
    box.rotation.y = Math.atan2(smp.tx, smp.tz);
    const front = new THREE.Mesh(gridFrontGeo, gridLineMat);
    const leftSide = new THREE.Mesh(gridSideGeo, gridLineMat);
    leftSide.position.set(-0.78, 0, -0.85);
    const rightSide = new THREE.Mesh(gridSideGeo, gridLineMat);
    rightSide.position.set(0.78, 0, -0.85);
    box.add(front, leftSide, rightSide);
    group.add(box);
  }

  // 6. Start/Finish Steel Truss Gantry Arch + Branded Banner + 5 Start Lights
  const gantry = new THREE.Group();
  gantry.position.set(startSample.x, 0, startSample.z);
  gantry.rotation.y = startHeading;

  const steelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.85 });
  const bannerMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.gantryBannerMap,
    roughness: 0.42,
    metalness: 0.1,
  });
  const pillarGeo = new THREE.BoxGeometry(1.0, 8.6, 1.1);
  const leftPillar = new THREE.Mesh(pillarGeo, steelMat);
  leftPillar.position.set(-(TRACK_HALF_WIDTH + 2.6), 4.3, 0);
  leftPillar.castShadow = true;
  const rightPillar = new THREE.Mesh(pillarGeo, steelMat);
  rightPillar.position.set(TRACK_HALF_WIDTH + 2.6, 4.3, 0);
  rightPillar.castShadow = true;

  const bridgeGeo = new THREE.BoxGeometry(TRACK_HALF_WIDTH * 2 + 6.2, 2.1, 1.3);
  const bridge = new THREE.Mesh(bridgeGeo, bannerMat);
  bridge.position.set(0, 7.8, 0);
  bridge.castShadow = true;

  const lightHousingGeo = new THREE.BoxGeometry(6.0, 0.95, 0.45);
  const lightHousingMat = new THREE.MeshStandardMaterial({ color: 0x090d14, roughness: 0.45 });
  const lightHousing = new THREE.Mesh(lightHousingGeo, lightHousingMat);
  lightHousing.position.set(0, 6.3, -0.58);

  const startLights: THREE.Mesh[] = [];
  const podGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.16, 16);
  podGeo.rotateX(Math.PI / 2);
  for (let i = 0; i < 5; i++) {
    const podMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      emissive: 0x000000,
      emissiveIntensity: 1.6,
      roughness: 0.3,
    });
    const pod = new THREE.Mesh(podGeo, podMat);
    pod.position.set(2.0 - i * 1.0, 6.3, -0.82);
    gantry.add(pod);
    startLights.push(pod);
    disposables.push(podMat);
  }

  gantry.add(leftPillar, rightPillar, bridge, lightHousing);
  group.add(gantry);
  disposables.push(pillarGeo, bridgeGeo, lightHousingGeo, podGeo, steelMat, bannerMat, lightHousingMat);

  // 7. Pit Lane Complex (Pit Apron + Pit Wall + Garage Bays + Race Control Tower)
  const pitSample = sampleTrackAtS(circuit, START_LINE_S - 18);
  const pitHeading = Math.atan2(pitSample.tx, pitSample.tz);
  const pitGroup = new THREE.Group();
  pitGroup.position.set(pitSample.x - pitSample.nx * 23, 0, pitSample.z - pitSample.nz * 23);
  pitGroup.rotation.y = pitHeading;

  const pitApronGeo = new THREE.PlaneGeometry(14, 92);
  pitApronGeo.rotateX(-Math.PI / 2);
  const pitApron = new THREE.Mesh(pitApronGeo, asphaltMat);
  pitApron.position.set(6, 0.015, 0);
  pitGroup.add(pitApron);

  // Pit lane concrete divider wall
  const pitWallBarrierGeo = new THREE.BoxGeometry(0.55, 1.15, 86);
  const pitWallBarrierMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.65 });
  const pitWallBarrier = new THREE.Mesh(pitWallBarrierGeo, pitWallBarrierMat);
  pitWallBarrier.position.set(12.2, 0.58, 0);
  pitGroup.add(pitWallBarrier);

  const pitBuildingGeo = new THREE.BoxGeometry(10, 5.4, 78);
  const pitBuildingMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.pitGarageMap,
    roughness: 0.6,
    metalness: 0.1,
  });
  const pitRoofGeo = new THREE.BoxGeometry(12.2, 0.65, 80);
  const pitRoofMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.7 });
  const pitBuilding = new THREE.Mesh(pitBuildingGeo, pitBuildingMat);
  pitBuilding.position.set(-2.5, 2.7, 0);
  pitBuilding.castShadow = true;
  pitBuilding.receiveShadow = true;
  const pitRoof = new THREE.Mesh(pitRoofGeo, pitRoofMat);
  pitRoof.position.set(-2.0, 5.7, 0);

  // Race Control Timing Tower behind pit complex
  const towerGeo = new THREE.BoxGeometry(5.5, 14.5, 5.5);
  const towerMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.35, metalness: 0.5 });
  const tower = new THREE.Mesh(towerGeo, towerMat);
  tower.position.set(-4.5, 7.25, 28);
  tower.castShadow = true;
  const towerGlassGeo = new THREE.BoxGeometry(5.8, 2.4, 5.8);
  const towerGlassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.15, metalness: 0.7 });
  const towerGlass = new THREE.Mesh(towerGlassGeo, towerGlassMat);
  towerGlass.position.set(-4.5, 12.6, 28);

  pitGroup.add(pitBuilding, pitRoof, tower, towerGlass);
  group.add(pitGroup);
  disposables.push(
    pitApronGeo,
    pitWallBarrierGeo,
    pitWallBarrierMat,
    pitBuildingGeo,
    pitRoofGeo,
    pitBuildingMat,
    pitRoofMat,
    towerGeo,
    towerMat,
    towerGlassGeo,
    towerGlassMat,
  );

  // 8. Main Grandstand ("Tribun") — placed on +pitSample.nx side; local +X points toward track center (trackDirectionSign = 1)
  const mainStand = buildGrandstand(74, 1, 0xdc2626, 0x0f172a, disposables);
  mainStand.position.set(pitSample.x + pitSample.nx * 24.5, 0, pitSample.z + pitSample.nz * 24.5);
  mainStand.rotation.y = pitHeading;
  group.add(mainStand);

  // Second Corner Grandstand overlooking Turn 1/2 braking zone (-t1Sample.nx side -> trackDirectionSign = -1)
  const t1Sample = sampleTrackAtS(circuit, 275);
  const t1Stand = buildGrandstand(46, -1, 0x2563eb, 0x1e293b, disposables);
  t1Stand.position.set(t1Sample.x - t1Sample.nx * 25.5, 0, t1Sample.z - t1Sample.nz * 25.5);
  t1Stand.rotation.y = Math.atan2(t1Sample.tx, t1Sample.tz);
  group.add(t1Stand);

  // 9. Continuous Steel Armco Guardrails + Trackside Sponsor Boards
  const railDist = TRACK_HALF_WIDTH + CURB_WIDTH + GRAVEL_WIDTH + 0.6;
  const railCount = 160;
  const segLen = circuit.totalLength / railCount + 0.35;
  const beamGeo = new THREE.BoxGeometry(0.18, 0.56, segLen);
  const beamMat = new THREE.MeshStandardMaterial({ color: 0xdbeafe, roughness: 0.35, metalness: 0.78 });
  const postGeo = new THREE.BoxGeometry(0.24, 1.15, 0.24);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5, metalness: 0.65 });

  const railBeams = new THREE.InstancedMesh(beamGeo, beamMat, railCount * 2);
  const railPosts = new THREE.InstancedMesh(postGeo, postMat, railCount * 2);
  const dummy = new THREE.Object3D();
  const cColor = new THREE.Color();

  for (let i = 0; i < railCount; i++) {
    const s = (i / railCount) * circuit.totalLength;
    const smp = sampleTrackAtS(circuit, s);
    const h = Math.atan2(smp.tx, smp.tz);

    // Outer rail
    dummy.position.set(smp.x + smp.nx * railDist, 0.72, smp.z + smp.nz * railDist);
    dummy.rotation.set(0, h, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    railBeams.setMatrixAt(i * 2, dummy.matrix);
    railBeams.setColorAt(i * 2, cColor.setHex(i % 6 === 0 ? 0xdc2626 : 0xe2e8f0));

    dummy.position.y = 0.55;
    dummy.updateMatrix();
    railPosts.setMatrixAt(i * 2, dummy.matrix);

    // Inner rail
    dummy.position.set(smp.x - smp.nx * railDist, 0.72, smp.z - smp.nz * railDist);
    dummy.updateMatrix();
    railBeams.setMatrixAt(i * 2 + 1, dummy.matrix);
    railBeams.setColorAt(i * 2 + 1, cColor.setHex(i % 6 === 0 ? 0x2563eb : 0xe2e8f0));

    dummy.position.y = 0.55;
    dummy.updateMatrix();
    railPosts.setMatrixAt(i * 2 + 1, dummy.matrix);
  }
  railBeams.instanceMatrix.needsUpdate = true;
  if (railBeams.instanceColor) railBeams.instanceColor.needsUpdate = true;
  railBeams.computeBoundingSphere();
  railPosts.instanceMatrix.needsUpdate = true;
  railPosts.computeBoundingSphere();
  group.add(railBeams, railPosts);
  disposables.push(beamGeo, beamMat, postGeo, postMat);

  // 10. FIM Tire Barrier Stacks in High-Speed Corner Run-Offs
  const tireStackGeo = new THREE.CylinderGeometry(0.55, 0.55, 1.15, 12);
  const tireStackMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78 });
  const tireZones = [235, 255, 295, 595, 760, 785]; // Turn 1, Chicane, Hairpin
  const tireStacks = new THREE.InstancedMesh(tireStackGeo, tireStackMat, tireZones.length * 4);
  let tIdx = 0;
  for (const sBase of tireZones) {
    for (let k = 0; k < 4; k++) {
      const smp = sampleTrackAtS(circuit, sBase + k * 2.2);
      const offsetSide = smp.curvature >= 0 ? -1 : 1;
      const dist = TRACK_HALF_WIDTH + CURB_WIDTH + GRAVEL_WIDTH - 0.6;
      dummy.position.set(smp.x + smp.nx * dist * offsetSide, 0.57, smp.z + smp.nz * dist * offsetSide);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      tireStacks.setMatrixAt(tIdx, dummy.matrix);
      tireStacks.setColorAt(tIdx, cColor.setHex(k % 2 === 0 ? 0xdc2626 : 0xf8fafc));
      tIdx++;
    }
  }
  tireStacks.instanceMatrix.needsUpdate = true;
  if (tireStacks.instanceColor) tireStacks.instanceColor.needsUpdate = true;
  tireStacks.computeBoundingSphere();
  group.add(tireStacks);
  disposables.push(tireStackGeo, tireStackMat);

  // 11. Turn 1 Braking Distance Boards (150m, 100m, 50m) + Trackside Sponsor Boards
  const boardGeo = new THREE.BoxGeometry(0.15, 1.5, 1.6);
  const boardPostGeo = new THREE.BoxGeometry(0.12, 1.2, 0.12);
  disposables.push(boardGeo, boardPostGeo);

  const brakeMarkers: Array<{ s: number; map: THREE.Texture }> = [
    { s: 175, map: textures.brakeBoard150Map },
    { s: 195, map: textures.brakeBoard100Map },
    { s: 215, map: textures.brakeBoard50Map },
  ];
  for (const bm of brakeMarkers) {
    const smp = sampleTrackAtS(circuit, bm.s);
    const mat = new THREE.MeshStandardMaterial({ map: bm.map, roughness: 0.45 });
    disposables.push(mat);
    const holder = new THREE.Group();
    holder.position.set(smp.x - smp.nx * (TRACK_HALF_WIDTH + 3.2), 0, smp.z - smp.nz * (TRACK_HALF_WIDTH + 3.2));
    holder.rotation.y = Math.atan2(smp.tx, smp.tz) + Math.PI * 0.5;
    const sign = new THREE.Mesh(boardGeo, mat);
    sign.position.y = 1.4;
    const post = new THREE.Mesh(boardPostGeo, postMat);
    post.position.y = 0.6;
    holder.add(sign, post);
    group.add(holder);
  }

  // Trackside Sponsor Banners along the straight
  const adGeo = new THREE.BoxGeometry(0.3, 1.35, 11);
  const adMat = new THREE.MeshStandardMaterial({ map: textures.sponsorBoardMap, roughness: 0.45 });
  disposables.push(adGeo, adMat);
  for (const sAd of [60, 140, 185]) {
    const smp = sampleTrackAtS(circuit, sAd);
    const ad = new THREE.Mesh(adGeo, adMat);
    ad.position.set(smp.x + smp.nx * (TRACK_HALF_WIDTH + 3.6), 0.72, smp.z + smp.nz * (TRACK_HALF_WIDTH + 3.6));
    ad.rotation.y = Math.atan2(smp.tx, smp.tz);
    group.add(ad);
  }

  // 12. Stadium Floodlight Towers around circuit
  const floodPoleGeo = new THREE.CylinderGeometry(0.28, 0.42, 22, 8);
  const floodHeadGeo = new THREE.BoxGeometry(3.8, 1.4, 0.6);
  const floodHeadMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, emissive: 0xfef3c7, emissiveIntensity: 0.75 });
  disposables.push(floodPoleGeo, floodHeadGeo, floodHeadMat);

  for (const sTower of [95, 260, 480, 740, 980]) {
    const smp = sampleTrackAtS(circuit, sTower);
    const towerGrp = new THREE.Group();
    towerGrp.position.set(smp.x + smp.nx * 32, 0, smp.z + smp.nz * 32);
    towerGrp.rotation.y = Math.atan2(smp.tx, smp.tz);
    const pole = new THREE.Mesh(floodPoleGeo, steelMat);
    pole.position.y = 11;
    const head = new THREE.Mesh(floodHeadGeo, floodHeadMat);
    head.position.set(0, 22, 0);
    head.rotation.y = Math.PI / 2;
    head.rotation.x = 0.35;
    towerGrp.add(pole, head);
    group.add(towerGrp);
  }

  // 13. Instanced Pine Tree Groves & Distant Perimeter Hills
  const treeCount = 180;
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.38, 2.4, 7);
  trunkGeo.translate(0, 1.2, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
  const crownGeo = new THREE.ConeGeometry(2.1, 6.4, 8);
  crownGeo.translate(0, 5.0, 0);
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x2e6f40, roughness: 0.85 });

  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, treeCount);
  crowns.castShadow = true;

  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let placed = 0; placed < treeCount; placed++) {
    const angle = rand() * Math.PI * 2;
    const radius = 215 + rand() * 90;
    const tx = Math.cos(angle) * radius;
    const tz = Math.sin(angle) * radius;
    const scale = 0.85 + rand() * 0.45;
    dummy.position.set(tx, 0, tz);
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    trunks.setMatrixAt(placed, dummy.matrix);
    crowns.setMatrixAt(placed, dummy.matrix);
    crowns.setColorAt(placed, cColor.setHSL(0.32 + (rand() - 0.5) * 0.05, 0.42, 0.28 + rand() * 0.1));
  }
  trunks.instanceMatrix.needsUpdate = true;
  crowns.instanceMatrix.needsUpdate = true;
  if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
  trunks.computeBoundingSphere();
  crowns.computeBoundingSphere();
  group.add(trunks, crowns);
  disposables.push(trunkGeo, trunkMat, crownGeo, crownMat);

  // Rolling distant hills ring
  const hillCount = 26;
  const hillGeo = new THREE.ConeGeometry(68, 38, 10);
  hillGeo.translate(0, 14, 0);
  const hillMat = new THREE.MeshStandardMaterial({ color: 0x3a5f3b, roughness: 0.95, metalness: 0 });
  const hills = new THREE.InstancedMesh(hillGeo, hillMat, hillCount);
  for (let i = 0; i < hillCount; i++) {
    const ang = (i / hillCount) * Math.PI * 2;
    const dist = WORLD_BOUNDARY_RADIUS + 68 + (i % 3) * 28;
    dummy.position.set(Math.cos(ang) * dist, -2, Math.sin(ang) * dist);
    dummy.rotation.set(0, ang, 0);
    dummy.scale.set(1.25 + (i % 4) * 0.25, 0.7 + (i % 3) * 0.4, 1.3);
    dummy.updateMatrix();
    hills.setMatrixAt(i, dummy.matrix);
  }
  hills.instanceMatrix.needsUpdate = true;
  hills.computeBoundingSphere();
  group.add(hills);
  disposables.push(hillGeo, hillMat);

  const setStartLights = (litCount: number, allGreen = false) => {
    for (let i = 0; i < startLights.length; i++) {
      const mat = startLights[i].material as THREE.MeshStandardMaterial;
      if (allGreen) {
        mat.color.setHex(0x22c55e);
        mat.emissive.setHex(0x22c55e);
        mat.emissiveIntensity = 2.0;
      } else if (i < litCount) {
        mat.color.setHex(0xef4444);
        mat.emissive.setHex(0xef4444);
        mat.emissiveIntensity = 2.2;
      } else {
        mat.color.setHex(0x1e293b);
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      }
    }
  };

  return {
    group,
    startLights,
    setStartLights,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
