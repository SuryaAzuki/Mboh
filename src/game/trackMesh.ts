import * as THREE from 'three';
import {
  CircuitData,
  CURB_WIDTH,
  GRAVEL_WIDTH,
  isInsideCircuitLoop,
  projectToTrack,
  sampleTrackAtS,
  START_LINE_S,
  TRACK_HALF_WIDTH,
  WORLD_BOUNDARY_RADIUS,
} from './trackMath';
import type { ProceduralTextures } from './textures';
import { buildTracksideLayout } from './tracksideLayout';
import type { RainPatch, SolidCollider } from './types';

export interface TrackWorld {
  group: THREE.Group;
  startLights: THREE.Mesh[];
  colliders: SolidCollider[];
  setStartLights: (litCount: number, allGreen?: boolean) => void;
  syncRainPatches: (patches: RainPatch[], rainIntensity: number) => void;
  updateCrowd: (timeSec: number, focusX: number, focusZ: number) => void;
  updateMarshals: (timeSec: number, preRaceActive: boolean) => void;
  dispose: () => void;
}

const _crowdDummy = new THREE.Object3D();

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

  // Solid front concrete safety wall facing the track
  const frontWallGeo = new THREE.BoxGeometry(0.5, 1.5, lengthZ);
  const frontWall = new THREE.Mesh(frontWallGeo, railMat);
  frontWall.position.set(trackDirectionSign * 1.4, 0.75, 0);
  stand.add(frontWall);
  disposables.push(frontWallGeo);

  // Solid concrete side walls enclosing grandstand structure
  const sideWallGeo = new THREE.BoxGeometry(11.8, 5.4, 0.45);
  const leftEndWall = new THREE.Mesh(sideWallGeo, concreteMat);
  leftEndWall.position.set(-trackDirectionSign * 4.6, 2.7, -lengthZ * 0.5);
  const rightEndWall = new THREE.Mesh(sideWallGeo, concreteMat);
  rightEndWall.position.set(-trackDirectionSign * 4.6, 2.7, lengthZ * 0.5);
  stand.add(leftEndWall, rightEndWall);
  disposables.push(sideWallGeo);

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
  const backWallGeo = new THREE.BoxGeometry(0.55, 8.8, lengthZ);
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
  const groundGeo = new THREE.PlaneGeometry(3400, 3400);
  groundGeo.rotateX(-Math.PI / 2);
  const groundMat = new THREE.MeshStandardMaterial({
    map: textures.grassMap,
    roughness: 0.92,
    metalness: 0.0,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.position.y = -0.18;
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
    -0.08,
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
  const leftCurbGeo = buildRibbonGeometry(circuit, -(TRACK_HALF_WIDTH + CURB_WIDTH), -TRACK_HALF_WIDTH, 0.03, 1, 0.35);
  const rightCurbGeo = buildRibbonGeometry(circuit, TRACK_HALF_WIDTH, TRACK_HALF_WIDTH + CURB_WIDTH, 0.03, 1, 0.35);
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
  finishLine.position.set(startSample.x, 0.04, startSample.z);
  finishLine.rotation.y = startHeading;
  finishLine.receiveShadow = true;
  group.add(finishLine);
  disposables.push(finishLineGeo, finishLineMat);

  // Starting grid white U-brackets for 22 3-wide MotoGP grid slots
  const gridLineMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
  const gridFrontGeo = new THREE.PlaneGeometry(1.7, 0.16);
  gridFrontGeo.rotateX(-Math.PI / 2);
  const gridSideGeo = new THREE.PlaneGeometry(0.14, 1.8);
  gridSideGeo.rotateX(-Math.PI / 2);
  disposables.push(gridLineMat, gridFrontGeo, gridSideGeo);

  for (let slot = 0; slot < 22; slot++) {
    const row = Math.floor(slot / 3);
    const col = slot % 3;
    const sBack = START_LINE_S - 10 - row * 6.5 - col * 1.1 + 1.0;
    const lat = (col - 1) * 3.8;
    const smp = sampleTrackAtS(circuit, sBack);
    const box = new THREE.Group();
    box.position.set(smp.x + smp.nx * lat, 0.035, smp.z + smp.nz * lat);
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
  const pillarGeo = new THREE.BoxGeometry(1.0, 9.6, 1.1);
  const leftPillar = new THREE.Mesh(pillarGeo, steelMat);
  leftPillar.position.set(-(TRACK_HALF_WIDTH + 2.6), 4.8, 0);
  leftPillar.castShadow = true;
  const rightPillar = new THREE.Mesh(pillarGeo, steelMat);
  rightPillar.position.set(TRACK_HALF_WIDTH + 2.6, 4.8, 0);
  rightPillar.castShadow = true;

  const bridgeGeo = new THREE.BoxGeometry(TRACK_HALF_WIDTH * 2 + 6.2, 2.1, 1.3);
  const bridge = new THREE.Mesh(bridgeGeo, bannerMat);
  bridge.position.set(0, 8.7, 0);
  bridge.castShadow = true;

  const lightHousingGeo = new THREE.BoxGeometry(6.0, 0.95, 0.45);
  const lightHousingMat = new THREE.MeshStandardMaterial({ color: 0x090d14, roughness: 0.45 });
  const lightHousing = new THREE.Mesh(lightHousingGeo, lightHousingMat);
  lightHousing.position.set(0, 7.2, -0.58);

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
    pod.position.set(2.0 - i * 1.0, 7.2, -0.82);
    gantry.add(pod);
    startLights.push(pod);
    disposables.push(podMat);
  }

  gantry.add(leftPillar, rightPillar, bridge, lightHousing);
  group.add(gantry);
  disposables.push(pillarGeo, bridgeGeo, lightHousingGeo, podGeo, steelMat, bannerMat, lightHousingMat);

  // 7. Pit Lane Complex (Pit Apron + Pit Wall + Garage Bays + Race Control Tower + VIP Roof Fence)
  const pitSample = sampleTrackAtS(circuit, START_LINE_S - 18);
  const pitHeading = Math.atan2(pitSample.tx, pitSample.tz);
  const pitGroup = new THREE.Group();
  pitGroup.position.set(pitSample.x - pitSample.nx * 23, 0, pitSample.z - pitSample.nz * 23);
  pitGroup.rotation.y = pitHeading;

  const pitApronGeo = new THREE.PlaneGeometry(14, 92);
  pitApronGeo.rotateX(-Math.PI / 2);
  const pitApron = new THREE.Mesh(pitApronGeo, asphaltMat);
  pitApron.position.set(-2.5, 0.015, 0);
  pitGroup.add(pitApron);

  // Pit lane concrete divider wall separating track and pit apron
  const pitWallBarrierGeo = new THREE.BoxGeometry(0.7, 1.2, 62);
  const pitWallBarrierMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.65 });
  const pitWallBarrier = new THREE.Mesh(pitWallBarrierGeo, pitWallBarrierMat);
  pitWallBarrier.position.set(-9.5, 0.6, 0);
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
  pitBuilding.position.set(3.5, 2.7, 0);
  pitBuilding.castShadow = true;
  pitBuilding.receiveShadow = true;
  const pitRoof = new THREE.Mesh(pitRoofGeo, pitRoofMat);
  pitRoof.position.set(3.0, 5.7, 0);

  // Race Control Timing Tower behind pit complex
  const towerGeo = new THREE.BoxGeometry(5.5, 14.5, 5.5);
  const towerMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.35, metalness: 0.5 });
  const tower = new THREE.Mesh(towerGeo, towerMat);
  tower.position.set(6.5, 7.25, 28);
  tower.castShadow = true;
  const towerGlassGeo = new THREE.BoxGeometry(5.8, 2.4, 5.8);
  const towerGlassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.15, metalness: 0.7 });
  const towerGlass = new THREE.Mesh(towerGlassGeo, towerGlassMat);
  towerGlass.position.set(6.5, 12.6, 28);

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

  const layout = buildTracksideLayout(circuit);

  // 7b. Paddock Hospitality Pavilion Building behind pit lane
  const pavGrp = new THREE.Group();
  pavGrp.position.set(layout.pavilion.x, 0, layout.pavilion.z);
  pavGrp.rotation.y = layout.pavilion.heading;
  const pavBodyGeo = new THREE.BoxGeometry(12.2, 6.2, 36);
  const pavBodyMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.65 });
  const pavRoofGeo = new THREE.BoxGeometry(13.2, 0.7, 37.5);
  const pavRoofMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.45 });
  const pavBody = new THREE.Mesh(pavBodyGeo, pavBodyMat);
  pavBody.position.y = 3.1;
  pavBody.castShadow = true;
  pavBody.receiveShadow = true;
  const pavRoof = new THREE.Mesh(pavRoofGeo, pavRoofMat);
  pavRoof.position.y = 6.5;
  pavGrp.add(pavBody, pavRoof);
  group.add(pavGrp);
  disposables.push(pavBodyGeo, pavBodyMat, pavRoofGeo, pavRoofMat);

  // 8. 4 Realistic Tiered Grandstands ("Tribun") around iconic circuit corners & straights
  for (const gs of layout.grandstands) {
    const stand = buildGrandstand(gs.lengthZ, gs.sideSign, gs.seatColorHex, gs.canopyColorHex, disposables);
    stand.position.set(gs.x, 0, gs.z);
    stand.rotation.y = gs.heading;
    group.add(stand);
  }
  const t1EntryS = layout.t1EntryS;
  const mainStandPos = layout.grandstands[0];

  // 8b. Upgraded Animated 3D Spectators (6-part InstancedMesh: Trousers + Jersey + Head + Team Cap + Left/Right Arms) + Waving Flags
  const specCount = layout.spectators.length;
  const legsGeo = new THREE.BoxGeometry(0.3, 0.34, 0.22);
  legsGeo.translate(0, 0.17, 0);
  const legsMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });

  const torsoGeo = new THREE.CapsuleGeometry(0.18, 0.32, 4, 6);
  torsoGeo.translate(0, 0.48, 0);
  const torsoMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72 });

  const headGeo = new THREE.SphereGeometry(0.14, 8, 6);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65 });

  const capGeo = new THREE.CylinderGeometry(0.145, 0.15, 0.1, 8);
  const capMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });

  const armGeo = new THREE.BoxGeometry(0.09, 0.38, 0.09);
  armGeo.translate(0, -0.16, 0);
  const armMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72 });

  const crowdLegs = new THREE.InstancedMesh(legsGeo, legsMat, specCount);
  const crowdTorsos = new THREE.InstancedMesh(torsoGeo, torsoMat, specCount);
  const crowdHeads = new THREE.InstancedMesh(headGeo, headMat, specCount);
  const crowdCaps = new THREE.InstancedMesh(capGeo, capMat, specCount);
  const crowdLeftArms = new THREE.InstancedMesh(armGeo, armMat, specCount);
  const crowdRightArms = new THREE.InstancedMesh(armGeo, armMat, specCount);

  crowdLegs.frustumCulled = false;
  crowdTorsos.frustumCulled = false;
  crowdHeads.frustumCulled = false;
  crowdCaps.frustumCulled = false;
  crowdLeftArms.frustumCulled = false;
  crowdRightArms.frustumCulled = false;

  const spColor = new THREE.Color();
  for (let i = 0; i < specCount; i++) {
    const sp = layout.spectators[i];
    crowdLegs.setColorAt(i, spColor.setHex(sp.pantsHex));
    crowdTorsos.setColorAt(i, spColor.setHex(sp.shirtHex));
    crowdHeads.setColorAt(i, spColor.setHex(sp.skinHex));
    crowdCaps.setColorAt(i, spColor.setHex(sp.capHex));
    crowdLeftArms.setColorAt(i, spColor.setHex(sp.shirtHex));
    crowdRightArms.setColorAt(i, spColor.setHex(sp.shirtHex));
  }
  if (crowdLegs.instanceColor) crowdLegs.instanceColor.needsUpdate = true;
  if (crowdTorsos.instanceColor) crowdTorsos.instanceColor.needsUpdate = true;
  if (crowdHeads.instanceColor) crowdHeads.instanceColor.needsUpdate = true;
  if (crowdCaps.instanceColor) crowdCaps.instanceColor.needsUpdate = true;
  if (crowdLeftArms.instanceColor) crowdLeftArms.instanceColor.needsUpdate = true;
  if (crowdRightArms.instanceColor) crowdRightArms.instanceColor.needsUpdate = true;

  group.add(crowdLegs, crowdTorsos, crowdHeads, crowdCaps, crowdLeftArms, crowdRightArms);
  disposables.push(legsGeo, legsMat, torsoGeo, torsoMat, headGeo, headMat, capGeo, capMat, armGeo, armMat);

  // Animated Supporter Flags waving in the stands & fan barriers
  const flagCount = layout.flags.length;
  const flagClothGeo = new THREE.BoxGeometry(0.05, 0.68, 1.05);
  flagClothGeo.translate(0, 0.72, 0.52);
  const flagClothMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 });
  const flagPoleGeo = new THREE.CylinderGeometry(0.025, 0.03, 1.4, 5);
  flagPoleGeo.translate(0, 0.45, 0);
  const flagPoleMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.6, roughness: 0.4 });

  const crowdFlags = new THREE.InstancedMesh(flagClothGeo, flagClothMat, Math.max(1, flagCount));
  const crowdFlagPoles = new THREE.InstancedMesh(flagPoleGeo, flagPoleMat, Math.max(1, flagCount));
  crowdFlags.frustumCulled = false;
  crowdFlagPoles.frustumCulled = false;
  crowdFlags.count = flagCount;
  crowdFlagPoles.count = flagCount;

  for (let i = 0; i < flagCount; i++) {
    const fl = layout.flags[i];
    crowdFlags.setColorAt(i, spColor.setHex(fl.colorHex));
    _crowdDummy.position.set(fl.x, fl.y, fl.z);
    _crowdDummy.rotation.set(0, fl.yaw, 0);
    _crowdDummy.scale.setScalar(fl.scale);
    _crowdDummy.updateMatrix();
    crowdFlagPoles.setMatrixAt(i, _crowdDummy.matrix);
  }
  if (crowdFlags.instanceColor) crowdFlags.instanceColor.needsUpdate = true;
  crowdFlagPoles.instanceMatrix.needsUpdate = true;
  group.add(crowdFlags, crowdFlagPoles);
  disposables.push(flagClothGeo, flagClothMat, flagPoleGeo, flagPoleMat);

  const updateCrowd = (timeSec: number, focusX: number, focusZ: number) => {
    for (let i = 0; i < specCount; i++) {
      const sp = layout.spectators[i];
      const dx = sp.x - focusX;
      const dz = sp.z - focusZ;
      const distSq = dx * dx + dz * dz;
      const nearBoost = distSq < 8100 ? 1 + (1 - Math.sqrt(distSq) / 90) * 1.55 : 1.0;

      const wave = Math.sin(timeSec * sp.speed * nearBoost + sp.phase);
      const jump = Math.max(0, wave) * sp.jumpAmp * nearBoost;
      const lean = Math.cos(timeSec * sp.speed * 0.65 + sp.phase) * 0.09;
      const baseY = sp.y + jump;
      const sc = sp.scale;

      // Trousers / lower silhouette
      _crowdDummy.position.set(sp.x, baseY, sp.z);
      _crowdDummy.rotation.set(0, sp.yaw, 0);
      _crowdDummy.scale.set(sc, sp.seated ? sc * 0.72 : sc, sc);
      _crowdDummy.updateMatrix();
      crowdLegs.setMatrixAt(i, _crowdDummy.matrix);

      // Torso
      _crowdDummy.position.set(sp.x, baseY, sp.z);
      _crowdDummy.rotation.set(lean, sp.yaw, 0);
      _crowdDummy.scale.setScalar(sc);
      _crowdDummy.updateMatrix();
      crowdTorsos.setMatrixAt(i, _crowdDummy.matrix);

      // Head
      _crowdDummy.position.set(sp.x, baseY + 0.84 * sc, sp.z);
      _crowdDummy.rotation.set(lean * 1.2, sp.yaw + wave * 0.16, 0);
      _crowdDummy.scale.setScalar(sc);
      _crowdDummy.updateMatrix();
      crowdHeads.setMatrixAt(i, _crowdDummy.matrix);

      // Racing Cap
      if (sp.hasCap) {
        _crowdDummy.position.set(sp.x, baseY + 0.94 * sc, sp.z);
        _crowdDummy.rotation.set(lean * 1.2, sp.yaw + wave * 0.16, 0);
        _crowdDummy.scale.setScalar(sc);
      } else {
        _crowdDummy.position.set(0, -80, 0);
        _crowdDummy.scale.setScalar(0.001);
      }
      _crowdDummy.updateMatrix();
      crowdCaps.setMatrixAt(i, _crowdDummy.matrix);

      // Shoulder offsets in world space
      const cosY = Math.cos(sp.yaw);
      const sinY = Math.sin(sp.yaw);
      const shoulderY = baseY + 0.66 * sc;
      const shoulderOffset = 0.22 * sc;

      // Left arm raised & cheering
      const lCheer = 1.95 + wave * sp.armAmp * nearBoost;
      _crowdDummy.position.set(sp.x - cosY * shoulderOffset, shoulderY, sp.z + sinY * shoulderOffset);
      _crowdDummy.rotation.set(0, sp.yaw, lCheer);
      _crowdDummy.scale.setScalar(sc);
      _crowdDummy.updateMatrix();
      crowdLeftArms.setMatrixAt(i, _crowdDummy.matrix);

      // Right arm raised & cheering out of phase
      const rCheer = -1.95 - Math.sin(timeSec * sp.speed * nearBoost + sp.phase + 0.9) * sp.armAmp * nearBoost;
      _crowdDummy.position.set(sp.x + cosY * shoulderOffset, shoulderY, sp.z - sinY * shoulderOffset);
      _crowdDummy.rotation.set(0, sp.yaw, rCheer);
      _crowdDummy.scale.setScalar(sc);
      _crowdDummy.updateMatrix();
      crowdRightArms.setMatrixAt(i, _crowdDummy.matrix);
    }

    for (let i = 0; i < flagCount; i++) {
      const fl = layout.flags[i];
      const sway = Math.sin(timeSec * 5.2 + fl.phase) * 0.34;
      const tilt = Math.cos(timeSec * 3.1 + fl.phase) * 0.16;
      _crowdDummy.position.set(fl.x, fl.y, fl.z);
      _crowdDummy.rotation.set(tilt, fl.yaw + sway, sway * 0.45);
      _crowdDummy.scale.setScalar(fl.scale);
      _crowdDummy.updateMatrix();
      crowdFlags.setMatrixAt(i, _crowdDummy.matrix);
    }

    crowdLegs.instanceMatrix.needsUpdate = true;
    crowdTorsos.instanceMatrix.needsUpdate = true;
    crowdHeads.instanceMatrix.needsUpdate = true;
    crowdCaps.instanceMatrix.needsUpdate = true;
    crowdLeftArms.instanceMatrix.needsUpdate = true;
    crowdRightArms.instanceMatrix.needsUpdate = true;
    if (flagCount > 0) crowdFlags.instanceMatrix.needsUpdate = true;
  };
  updateCrowd(0, startSample.x, startSample.z);

  // 9. Continuous Steel Armco Guardrails (with Pit Entry Opening along -nx pit straight)
  const railDist = TRACK_HALF_WIDTH + CURB_WIDTH + GRAVEL_WIDTH + 0.6;
  const railCount = 460;
  const segLen = circuit.totalLength / railCount + 0.4;
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

    // Inner rail (open along Pit Lane complex so pit wall separates pit lane cleanly)
    const inPitOpening = s > START_LINE_S - 64 && s < START_LINE_S + 28;
    if (inPitOpening) {
      dummy.position.set(0, -50, 0);
      dummy.scale.setScalar(0.001);
      dummy.updateMatrix();
      railBeams.setMatrixAt(i * 2 + 1, dummy.matrix);
      railPosts.setMatrixAt(i * 2 + 1, dummy.matrix);
    } else {
      dummy.position.set(smp.x - smp.nx * railDist, 0.72, smp.z - smp.nz * railDist);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      railBeams.setMatrixAt(i * 2 + 1, dummy.matrix);
      railBeams.setColorAt(i * 2 + 1, cColor.setHex(i % 6 === 0 ? 0x2563eb : 0xe2e8f0));

      dummy.position.y = 0.55;
      dummy.updateMatrix();
      railPosts.setMatrixAt(i * 2 + 1, dummy.matrix);
    }
  }
  railBeams.instanceMatrix.needsUpdate = true;
  if (railBeams.instanceColor) railBeams.instanceColor.needsUpdate = true;
  railBeams.computeBoundingSphere();
  railPosts.instanceMatrix.needsUpdate = true;
  railPosts.computeBoundingSphere();
  group.add(railBeams, railPosts);
  disposables.push(beamGeo, beamMat, postGeo, postMat);

  // 10. FIM Tire Barrier Stacks dynamically placed in High-Speed Corner Run-Offs
  const tireStackGeo = new THREE.CylinderGeometry(0.55, 0.55, 1.15, 12);
  const tireStackMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78 });
  const tireZones: number[] = [];
  for (let s = 340; s < circuit.totalLength - 80; s += 160) {
    let bestS = s;
    let bestCurv = 0;
    for (let p = s; p < s + 150; p += 10) {
      const c = Math.abs(sampleTrackAtS(circuit, p).curvature);
      if (c > bestCurv) {
        bestCurv = c;
        bestS = p;
      }
    }
    if (bestCurv > 0.0045) tireZones.push(bestS);
  }
  if (tireZones.length > 0) {
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
  }
  disposables.push(tireStackGeo, tireStackMat);

  // 11. Turn 1 Braking Distance Boards (150m, 100m, 50m) + Trackside Sponsor Boards
  const boardGeo = new THREE.BoxGeometry(0.15, 1.5, 1.6);
  const boardPostGeo = new THREE.BoxGeometry(0.12, 1.2, 0.12);
  disposables.push(boardGeo, boardPostGeo);

  const brakeMarkers: Array<{ s: number; map: THREE.Texture }> = [
    { s: t1EntryS - 95, map: textures.brakeBoard150Map },
    { s: t1EntryS - 60, map: textures.brakeBoard100Map },
    { s: t1EntryS - 25, map: textures.brakeBoard50Map },
  ];
  for (const bm of brakeMarkers) {
    const smp = sampleTrackAtS(circuit, bm.s);
    const mat = new THREE.MeshStandardMaterial({ map: bm.map, roughness: 0.45 });
    disposables.push(mat);
    const holder = new THREE.Group();
    holder.position.set(smp.x + smp.nx * (TRACK_HALF_WIDTH + 3.2), 0, smp.z + smp.nz * (TRACK_HALF_WIDTH + 3.2));
    holder.rotation.y = Math.atan2(smp.tx, smp.tz) + Math.PI * 0.5;
    const sign = new THREE.Mesh(boardGeo, mat);
    sign.position.y = 1.4;
    const post = new THREE.Mesh(boardPostGeo, postMat);
    post.position.y = 0.6;
    holder.add(sign, post);
    group.add(holder);
  }

  // Trackside Advertising Billboards (34 multi-part steel-framed sponsor signs around the circuit)
  const billboardFrameGeo = new THREE.BoxGeometry(0.28, 2.35, 11.6);
  const billboardFrameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.65 });
  const billboardPanelGeo = new THREE.PlaneGeometry(11.3, 2.1);
  const billboardLegGeo = new THREE.BoxGeometry(0.22, 1.35, 0.22);
  const billboardMats = textures.billboardMaps.map(
    (map) => new THREE.MeshStandardMaterial({ color: 0xffffff, map, roughness: 0.42, metalness: 0.05 }),
  );
  disposables.push(billboardFrameGeo, billboardFrameMat, billboardPanelGeo, billboardLegGeo, ...billboardMats);

  for (const bb of layout.billboards) {
    const holder = new THREE.Group();
    holder.position.set(bb.x, 0, bb.z);
    holder.rotation.y = bb.yaw;

    const frame = new THREE.Mesh(billboardFrameGeo, billboardFrameMat);
    frame.position.y = 1.65;
    frame.castShadow = true;

    const panelMat = billboardMats[bb.brandIndex % billboardMats.length];
    const frontFace = new THREE.Mesh(billboardPanelGeo, panelMat);
    frontFace.position.set(0.16, 1.65, 0);
    frontFace.rotation.y = Math.PI / 2;

    const backFace = new THREE.Mesh(billboardPanelGeo, panelMat);
    backFace.position.set(-0.16, 1.65, 0);
    backFace.rotation.y = -Math.PI / 2;

    const legA = new THREE.Mesh(billboardLegGeo, postMat);
    legA.position.set(0, 0.65, -4.2);
    const legB = new THREE.Mesh(billboardLegGeo, postMat);
    legB.position.set(0, 0.65, 4.2);

    holder.add(frame, frontFace, backFace, legA, legB);
    group.add(holder);
  }

  // Overhead Sponsor Bridges across Back Straight & Final Sector
  const spanPillarGeo = new THREE.BoxGeometry(0.85, 8.8, 0.95);
  const spanBridgeGeo = new THREE.BoxGeometry(TRACK_HALF_WIDTH * 2 + 6.0, 2.0, 1.1);
  const spanPanelGeo = new THREE.PlaneGeometry(TRACK_HALF_WIDTH * 2 + 4.8, 1.85);
  disposables.push(spanPillarGeo, spanBridgeGeo, spanPanelGeo);

  for (const br of layout.bridges) {
    const brGrp = new THREE.Group();
    brGrp.position.set(br.x, 0, br.z);
    brGrp.rotation.y = br.heading;

    const lp = new THREE.Mesh(spanPillarGeo, steelMat);
    lp.position.set(-(TRACK_HALF_WIDTH + 2.6), 4.4, 0);
    const rp = new THREE.Mesh(spanPillarGeo, steelMat);
    rp.position.set(TRACK_HALF_WIDTH + 2.6, 4.4, 0);

    const beam = new THREE.Mesh(spanBridgeGeo, billboardFrameMat);
    beam.position.set(0, 8.2, 0);

    const pMat = billboardMats[br.brandIndex % billboardMats.length];
    const frontSign = new THREE.Mesh(spanPanelGeo, pMat);
    frontSign.position.set(0, 8.2, -0.58);
    frontSign.rotation.y = Math.PI;
    const backSign = new THREE.Mesh(spanPanelGeo, pMat);
    backSign.position.set(0, 8.2, 0.58);

    brGrp.add(lp, rp, beam, frontSign, backSign);
    group.add(brGrp);
  }

  // 12. Stadium Floodlight Towers outside circuit perimeter
  const floodPoleGeo = new THREE.CylinderGeometry(0.28, 0.42, 22, 8);
  const floodHeadGeo = new THREE.BoxGeometry(3.8, 1.4, 0.6);
  const floodHeadMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, emissive: 0xfef3c7, emissiveIntensity: 0.75 });
  disposables.push(floodPoleGeo, floodHeadGeo, floodHeadMat);

  for (let i = 0; i < 10; i++) {
    const sTower = (i / 10) * circuit.totalLength + 90;
    const smp = sampleTrackAtS(circuit, sTower);
    const candX = smp.x + smp.nx * 36;
    const candZ = smp.z + smp.nz * 36;
    const side: 1 | -1 = isInsideCircuitLoop(circuit, candX, candZ) ? -1 : 1;
    const towerGrp = new THREE.Group();
    towerGrp.position.set(smp.x + smp.nx * 36 * side, 0, smp.z + smp.nz * 36 * side);
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

  // 13. Instanced Pine Tree Groves — STRICTLY outside the circuit loop and clear of asphalt/gravel/grandstands
  const treeCount = 300;
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

  const minTrackClearance = TRACK_HALF_WIDTH + CURB_WIDTH + GRAVEL_WIDTH + 20;
  let placedTrees = 0;
  for (let attempt = 0; attempt < 5500 && placedTrees < treeCount; attempt++) {
    const angle = rand() * Math.PI * 2;
    const radius = 280 + rand() * (WORLD_BOUNDARY_RADIUS - 120);
    const tx = circuit.centroid.x + Math.cos(angle) * radius;
    const tz = circuit.centroid.z + Math.sin(angle) * radius;

    if (isInsideCircuitLoop(circuit, tx, tz)) continue;
    if (projectToTrack(circuit, tx, tz).absOffset < minTrackClearance) continue;
    if (Math.hypot(tx - mainStandPos.x, tz - mainStandPos.z) < 70) continue;

    const scale = 0.9 + rand() * 0.55;
    dummy.position.set(tx, 0, tz);
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    trunks.setMatrixAt(placedTrees, dummy.matrix);
    crowns.setMatrixAt(placedTrees, dummy.matrix);
    crowns.setColorAt(placedTrees, cColor.setHSL(0.32 + (rand() - 0.5) * 0.05, 0.42, 0.28 + rand() * 0.1));
    placedTrees++;
  }
  trunks.count = placedTrees;
  crowns.count = placedTrees;
  trunks.instanceMatrix.needsUpdate = true;
  crowns.instanceMatrix.needsUpdate = true;
  if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
  trunks.computeBoundingSphere();
  crowns.computeBoundingSphere();
  group.add(trunks, crowns);
  disposables.push(trunkGeo, trunkMat, crownGeo, crownMat);

  // Rolling distant hills ring well outside track bounds
  const hillCount = 34;
  const hillGeo = new THREE.ConeGeometry(92, 54, 10);
  hillGeo.translate(0, 18, 0);
  const hillMat = new THREE.MeshStandardMaterial({ color: 0x3a5f3b, roughness: 0.95, metalness: 0 });
  const hills = new THREE.InstancedMesh(hillGeo, hillMat, hillCount);
  let placedHills = 0;
  for (let i = 0; i < hillCount; i++) {
    const ang = (i / hillCount) * Math.PI * 2;
    const dist = WORLD_BOUNDARY_RADIUS + 40 + (i % 3) * 65;
    const hx = circuit.centroid.x + Math.cos(ang) * dist;
    const hz = circuit.centroid.z + Math.sin(ang) * dist;
    if (isInsideCircuitLoop(circuit, hx, hz)) continue;
    if (projectToTrack(circuit, hx, hz).absOffset < 110) continue;
    dummy.position.set(hx, -2, hz);
    dummy.rotation.set(0, ang, 0);
    dummy.scale.set(1.3 + (i % 4) * 0.25, 0.75 + (i % 3) * 0.4, 1.35);
    dummy.updateMatrix();
    hills.setMatrixAt(placedHills, dummy.matrix);
    placedHills++;
  }
  hills.count = placedHills;
  hills.instanceMatrix.needsUpdate = true;
  hills.computeBoundingSphere();
  group.add(hills);
  disposables.push(hillGeo, hillMat);

  // 14. Animated 3D Track Marshals Waving Flags along Grid & Corner Posts
  interface MarshalRig {
    root: THREE.Group;
    torso: THREE.Group;
    flagArm: THREE.Group;
    flagCloth: THREE.Mesh;
    phase: number;
    isGridMarshal: boolean;
  }

  const marshals: MarshalRig[] = [];
  const mSuitMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.58 }); // Hi-vis FIA orange marshal suit
  const mStripeMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.45 }); // Reflective yellow vest band
  const mHelmetMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25 });
  const mBootMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.72 });
  const mPoleMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.65, roughness: 0.35 });
  const mGreenFlagMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.48, side: THREE.DoubleSide });
  const mCheckFlagMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.checkeredMap,
    roughness: 0.48,
    side: THREE.DoubleSide,
  });

  const mLegGeo = new THREE.CapsuleGeometry(0.085, 0.48, 4, 8);
  const mTorsoGeo = new THREE.CapsuleGeometry(0.17, 0.38, 6, 10);
  const mVestGeo = new THREE.BoxGeometry(0.36, 0.14, 0.26);
  const mHeadGeo = new THREE.SphereGeometry(0.145, 10, 8);
  const mArmGeo = new THREE.CapsuleGeometry(0.055, 0.34, 4, 8);
  const mPoleGeo = new THREE.CylinderGeometry(0.022, 0.024, 1.45, 6);
  const mClothGeo = new THREE.PlaneGeometry(0.86, 0.56, 4, 2);

  disposables.push(
    mSuitMat,
    mStripeMat,
    mHelmetMat,
    mBootMat,
    mPoleMat,
    mGreenFlagMat,
    mCheckFlagMat,
    mLegGeo,
    mTorsoGeo,
    mVestGeo,
    mHeadGeo,
    mArmGeo,
    mPoleGeo,
    mClothGeo,
  );

  const marshalPosts: Array<{ s: number; lat: number; grid: boolean; checkered: boolean }> = [
    { s: START_LINE_S - 6, lat: -(TRACK_HALF_WIDTH + 2.5), grid: true, checkered: false },
    { s: START_LINE_S - 18, lat: TRACK_HALF_WIDTH + 2.5, grid: true, checkered: false },
    { s: START_LINE_S + 8, lat: TRACK_HALF_WIDTH + 2.7, grid: true, checkered: true },
    { s: t1EntryS + 16, lat: TRACK_HALF_WIDTH + 2.9, grid: false, checkered: false },
    { s: circuit.totalLength * 0.42, lat: -(TRACK_HALF_WIDTH + 2.9), grid: false, checkered: false },
    { s: circuit.totalLength * 0.72, lat: TRACK_HALF_WIDTH + 2.9, grid: false, checkered: false },
  ];

  marshalPosts.forEach((post, idx) => {
    const smp = sampleTrackAtS(circuit, post.s);
    const root = new THREE.Group();
    root.position.set(smp.x + smp.nx * post.lat, 0, smp.z + smp.nz * post.lat);
    // Face track centerline
    const trackDirX = -smp.nx * Math.sign(post.lat);
    const trackDirZ = -smp.nz * Math.sign(post.lat);
    root.rotation.y = Math.atan2(trackDirX, trackDirZ);

    const legL = new THREE.Mesh(mLegGeo, mBootMat);
    legL.position.set(0.11, 0.36, 0);
    const legR = new THREE.Mesh(mLegGeo, mBootMat);
    legR.position.set(-0.11, 0.36, 0);
    root.add(legL, legR);

    const torso = new THREE.Group();
    torso.position.set(0, 0.68, 0);
    root.add(torso);

    const body = new THREE.Mesh(mTorsoGeo, mSuitMat);
    body.position.y = 0.28;
    body.scale.set(1.1, 1.0, 0.85);
    body.castShadow = true;
    torso.add(body);

    const vest = new THREE.Mesh(mVestGeo, mStripeMat);
    vest.position.y = 0.3;
    torso.add(vest);

    const helmet = new THREE.Mesh(mHeadGeo, mHelmetMat);
    helmet.position.set(0, 0.68, 0.02);
    torso.add(helmet);

    const restArm = new THREE.Mesh(mArmGeo, mSuitMat);
    restArm.position.set(-0.24, 0.26, 0.05);
    restArm.rotation.z = -0.2;
    torso.add(restArm);

    const flagArm = new THREE.Group();
    flagArm.position.set(0.24, 0.48, 0.02);
    torso.add(flagArm);

    const waveArm = new THREE.Mesh(mArmGeo, mSuitMat);
    waveArm.position.set(0.06, 0.2, 0.08);
    waveArm.rotation.x = -0.35;
    flagArm.add(waveArm);

    const pole = new THREE.Mesh(mPoleGeo, mPoleMat);
    pole.position.set(0.08, 0.82, 0.16);
    flagArm.add(pole);

    const flagCloth = new THREE.Mesh(mClothGeo, post.checkered ? mCheckFlagMat : mGreenFlagMat);
    flagCloth.position.set(0.08, 1.24, 0.58);
    flagCloth.rotation.y = Math.PI / 2;
    flagArm.add(flagCloth);

    group.add(root);
    marshals.push({
      root,
      torso,
      flagArm,
      flagCloth,
      phase: idx * 1.15,
      isGridMarshal: post.grid,
    });
  });

  const updateMarshals = (timeSec: number, preRaceActive: boolean) => {
    const vigor = preRaceActive ? 1.35 : 0.85;
    const speed = preRaceActive ? 5.6 : 3.8;
    for (const m of marshals) {
      const wave = Math.sin(timeSec * speed + m.phase);
      const flutter = Math.cos(timeSec * (speed * 1.9) + m.phase);
      const amp = (m.isGridMarshal ? 0.55 : 0.38) * vigor;
      m.torso.rotation.z = wave * 0.07;
      m.flagArm.rotation.z = -0.25 + wave * amp;
      m.flagArm.rotation.x = Math.sin(timeSec * speed * 0.7 + m.phase) * 0.22;
      m.flagCloth.rotation.y = Math.PI / 2 + flutter * 0.28;
      m.flagCloth.rotation.z = wave * 0.14;
    }
  };
  updateMarshals(0, true);

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

  // 15. Pooled 3D Wet Asphalt Rain Patch Decals (rendered dynamically when weather shifts to clouds/rain)
  const maxPuddleCount = 16;
  const puddleGeo = new THREE.PlaneGeometry(2, 2);
  puddleGeo.rotateX(-Math.PI / 2);
  const puddleMat = new THREE.MeshBasicMaterial({
    map: textures.wetPuddleMap,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  disposables.push(puddleGeo, puddleMat);

  const puddleMeshes: THREE.Mesh[] = [];
  for (let i = 0; i < maxPuddleCount; i++) {
    const pm = new THREE.Mesh(puddleGeo, puddleMat);
    pm.visible = false;
    pm.position.set(0, 0.025, 0);
    group.add(pm);
    puddleMeshes.push(pm);
  }

  const syncRainPatches = (patches: RainPatch[], rainIntensity: number) => {
    puddleMat.opacity = Math.min(0.88, 0.42 + rainIntensity * 0.48);
    for (let i = 0; i < maxPuddleCount; i++) {
      const mesh = puddleMeshes[i];
      if (i < patches.length) {
        const p = patches[i];
        mesh.visible = true;
        mesh.position.set(p.x, 0.026, p.z);
        mesh.rotation.y = p.heading;
        mesh.scale.set(p.radiusLat, 1, p.radiusS);
      } else {
        mesh.visible = false;
      }
    }
  };

  return {
    group,
    startLights,
    colliders: layout.colliders,
    setStartLights,
    syncRainPatches,
    updateCrowd,
    updateMarshals,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
