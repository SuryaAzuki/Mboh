import * as THREE from 'three';
import {
  createMotoBikeRig,
  createStandingRiderMesh,
  type BikeVisualRig,
  type StandingRiderRig,
} from './bikeMesh';
import type { BikeClassId, TeamLivery } from './types';

export interface PodiumWinnerSlot {
  rank: 1 | 2 | 3;
  name: string;
  livery: TeamLivery;
}

export interface PodiumStage {
  group: THREE.Group;
  riders: Array<{ rank: 1 | 2 | 3; rig: StandingRiderRig }>;
  bikes: BikeVisualRig[];
  dispose: () => void;
}

function makeStepNumberTexture(num: string, bg: string, fg: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = fg;
  ctx.font = '900 italic 78px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(num, 64, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeBackdropTexture(title: string, sub: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, 512, 256);

  ctx.fillStyle = '#dc2626';
  ctx.fillRect(0, 0, 512, 18);
  ctx.fillRect(0, 238, 512, 18);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '900 italic 44px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, 256, 40);

  ctx.fillStyle = '#facc15';
  ctx.font = '800 20px system-ui, sans-serif';
  ctx.fillText(sub, 256, 74);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createPodiumStage(
  winners: PodiumWinnerSlot[],
  shadowMap: THREE.Texture,
  isSoftwareGl: boolean,
  bikeClass: BikeClassId,
): PodiumStage {
  const group = new THREE.Group();
  const riders: Array<{ rank: 1 | 2 | 3; rig: StandingRiderRig }> = [];
  const bikes: BikeVisualRig[] = [];
  const extraTextures: THREE.Texture[] = [];

  // Parc Ferme red/slate podium carpet base
  const carpetGeo = new THREE.BoxGeometry(10.5, 0.06, 7.2);
  const carpetMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.85,
  });
  const carpet = new THREE.Mesh(carpetGeo, carpetMat);
  carpet.position.set(0, 0.03, 0.8);
  group.add(carpet);

  // Red Parc Ferme border trim
  const trimGeo = new THREE.BoxGeometry(10.7, 0.04, 7.4);
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.45 });
  const trim = new THREE.Mesh(trimGeo, trimMat);
  trim.position.set(0, 0.02, 0.8);
  group.add(trim);

  // Championship Podium Backdrop Wall (tall so headline stays cleanly above P1 helmet & fists)
  const backdropTex = makeBackdropTexture('APEX GP', 'PODIUM CEREMONY');
  extraTextures.push(backdropTex);
  const wallGeo = new THREE.BoxGeometry(8.2, 4.75, 0.28);
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: backdropTex,
    roughness: 0.4,
  });
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.position.set(0, 2.42, -1.55);
  group.add(wall);

  // Side pillars framing podium backdrop
  const pillarGeo = new THREE.BoxGeometry(0.36, 4.9, 0.45);
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.35, metalness: 0.6 });
  const pillarL = new THREE.Mesh(pillarGeo, pillarMat);
  pillarL.position.set(-4.2, 2.45, -1.55);
  const pillarR = new THREE.Mesh(pillarGeo, pillarMat);
  pillarR.position.set(4.2, 2.45, -1.55);
  group.add(pillarL, pillarR);

  // 3 Stepped Podium Platforms: P2 (left), P1 (center high), P3 (right)
  const stepSpecs: Array<{
    rank: 1 | 2 | 3;
    x: number;
    height: number;
    bg: string;
    fg: string;
    trophyHex: number;
  }> = [
    { rank: 1, x: 0, height: 1.05, bg: '#facc15', fg: '#0f172a', trophyHex: 0xfacc15 },
    { rank: 2, x: -1.85, height: 0.68, bg: '#e2e8f0', fg: '#0f172a', trophyHex: 0xe2e8f0 },
    { rank: 3, x: 1.85, height: 0.46, bg: '#d97706', fg: '#ffffff', trophyHex: 0xd97706 },
  ];

  const stepBodyMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.38, metalness: 0.35 });
  const stepTopMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });

  for (const spec of stepSpecs) {
    const stepGeo = new THREE.BoxGeometry(1.65, spec.height, 1.45);
    const stepMesh = new THREE.Mesh(stepGeo, stepBodyMat);
    stepMesh.position.set(spec.x, spec.height * 0.5 + 0.05, -0.35);
    group.add(stepMesh);

    const topCapGeo = new THREE.BoxGeometry(1.72, 0.06, 1.52);
    const topCap = new THREE.Mesh(topCapGeo, stepTopMat);
    topCap.position.set(spec.x, spec.height + 0.05, -0.35);
    group.add(topCap);

    // Front Rank Plaque (1, 2, 3)
    const numTex = makeStepNumberTexture(`${spec.rank}`, spec.bg, spec.fg);
    extraTextures.push(numTex);
    const plaqueGeo = new THREE.PlaneGeometry(0.46, 0.42);
    const plaqueMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: numTex, roughness: 0.3 });
    const plaque = new THREE.Mesh(plaqueGeo, plaqueMat);
    plaque.position.set(spec.x, spec.height * 0.5 + 0.05, 0.39);
    group.add(plaque);

    // Winner standing on step + Trophy
    const winner = winners.find((w) => w.rank === spec.rank);
    if (winner) {
      const standing = createStandingRiderMesh(winner.livery);
      standing.root.position.set(spec.x, spec.height + 0.08, -0.4);
      group.add(standing.root);
      riders.push({ rank: spec.rank, rig: standing });

      // Championship Trophy Cup beside rider
      const trophyMat = new THREE.MeshStandardMaterial({
        color: spec.trophyHex,
        roughness: 0.18,
        metalness: 0.92,
      });
      const cupBase = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.1, 10), stepBodyMat);
      cupBase.position.set(spec.x + 0.42, spec.height + 0.13, -0.05);
      const cupStem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.18, 10), trophyMat);
      cupStem.position.set(spec.x + 0.42, spec.height + 0.26, -0.05);
      const cupBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.05, 0.22, 12), trophyMat);
      cupBowl.position.set(spec.x + 0.42, spec.height + 0.42, -0.05);
      group.add(cupBase, cupStem, cupBowl);

      // Park Winner's Livery Bike in Parc Ferme right in front of the podium
      const parkedBike = createMotoBikeRig(winner.livery, shadowMap, isSoftwareGl, bikeClass);
      parkedBike.riderGroup.visible = false; // rider is up on the podium!
      parkedBike.leanGroup.rotation.z = 0.14; // leaning neatly on paddock stand
      const bikeX = spec.rank === 1 ? 0 : spec.rank === 2 ? -2.9 : 2.9;
      const bikeZ = spec.rank === 1 ? 1.65 : 1.5;
      const bikeRot = spec.rank === 1 ? 0.52 : spec.rank === 2 ? 0.72 : -0.72;
      parkedBike.root.position.set(bikeX, 0.06, bikeZ);
      parkedBike.root.rotation.y = bikeRot;
      group.add(parkedBike.root);
      bikes.push(parkedBike);
    }
  }

  const dispose = () => {
    for (const r of riders) r.rig.dispose();
    for (const b of bikes) b.dispose();
    extraTextures.forEach((t) => t.dispose());
    group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        if (m.geometry && !m.geometry.userData?.sharedGeo) {
          m.geometry.dispose();
        }
        if (Array.isArray(m.material)) {
          m.material.forEach((mat) => mat.dispose());
        } else {
          m.material?.dispose();
        }
      }
    });
  };

  return { group, riders, bikes, dispose };
}

export function animatePodiumCeremony(stage: PodiumStage, timeSec: number): void {
  for (const { rank, rig } of stage.riders) {
    if (rank === 1) {
      // Champion: double fist-pump, joyful bounce & animated heel taps
      const pump = Math.sin(timeSec * 4.5);
      const cheer = Math.sin(timeSec * 2.2);
      const hop = Math.abs(pump) * 0.04;
      rig.torsoPivot.position.y = 0.9 + hop;
      rig.torsoPivot.rotation.set(0.05, cheer * 0.2, 0);
      rig.headPivot.rotation.set(-0.15, Math.sin(timeSec * 1.8) * 0.25, 0);

      rig.leftArmPivot.rotation.set(-0.2, 0, 2.55 + pump * 0.25);
      rig.leftArm.elbowPivot.rotation.set(-0.55 - pump * 0.18, 0, 0);
      rig.leftArm.gripFingerPivot.rotation.x = 0.65;
      rig.leftArm.brakeFingerPivot.rotation.x = 0.65;

      rig.rightArmPivot.rotation.set(-0.2, 0, -2.55 - pump * 0.25);
      rig.rightArm.elbowPivot.rotation.set(-0.55 - pump * 0.18, 0, 0);
      rig.rightArm.gripFingerPivot.rotation.x = 0.65;
      rig.rightArm.brakeFingerPivot.rotation.x = 0.65;

      rig.leftLegPivot.rotation.set(-hop * 1.1, 0, 0.05);
      rig.rightLegPivot.rotation.set(-hop * 1.1, 0, -0.05);
      rig.leftFootPivot.rotation.set(0.16 * Math.max(0, pump), 0.1, 0);
      rig.rightFootPivot.rotation.set(0.16 * Math.max(0, -pump), -0.1, 0);
    } else if (rank === 2) {
      // P2: enthusiastic open-hand crowd wave & weight shift
      const wave = Math.sin(timeSec * 3.8 + 1.1);
      const shift = Math.sin(timeSec * 1.9 + 1.1);
      rig.torsoPivot.rotation.set(0.04, 0.18 + shift * 0.08, 0);
      rig.headPivot.rotation.set(-0.08, 0.15 + wave * 0.12, 0);

      rig.leftArmPivot.rotation.set(-0.15, 0, 2.25 + wave * 0.28);
      rig.leftArm.elbowPivot.rotation.set(-0.35 + wave * 0.15, 0, 0);
      rig.leftArm.gripFingerPivot.rotation.x = -0.35; // open waving hand
      rig.leftArm.brakeFingerPivot.rotation.x = -0.35;

      rig.rightArmPivot.rotation.set(-0.4, 0.3, -0.35);
      rig.rightArm.elbowPivot.rotation.set(-0.4, 0, 0);
      rig.rightArm.gripFingerPivot.rotation.x = 0.3;
      rig.rightArm.brakeFingerPivot.rotation.x = 0.3;

      rig.leftFootPivot.rotation.set(shift * 0.1, 0.08, 0);
      rig.rightFootPivot.rotation.set(-shift * 0.1, -0.08, 0);
    } else {
      // P3: celebrating open-finger salute & relaxed stance
      const wave = Math.sin(timeSec * 3.4 + 2.3);
      const shift = Math.sin(timeSec * 1.7 + 2.3);
      rig.torsoPivot.rotation.set(0.04, -0.18 + shift * 0.08, 0);
      rig.headPivot.rotation.set(-0.08, -0.15 + wave * 0.12, 0);

      rig.leftArmPivot.rotation.set(-0.4, -0.3, 0.35);
      rig.leftArm.elbowPivot.rotation.set(-0.38, 0, 0);

      rig.rightArmPivot.rotation.set(-0.15, 0, -2.2 - wave * 0.28);
      rig.rightArm.elbowPivot.rotation.set(-0.35 - wave * 0.15, 0, 0);
      rig.rightArm.gripFingerPivot.rotation.x = -0.35;
      rig.rightArm.brakeFingerPivot.rotation.x = -0.35;

      rig.leftFootPivot.rotation.set(-shift * 0.09, 0.06, 0);
      rig.rightFootPivot.rotation.set(shift * 0.09, -0.06, 0);
    }
  }
}
