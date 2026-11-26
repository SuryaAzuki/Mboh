import {
  CircuitData,
  CURB_WIDTH,
  GRAVEL_WIDTH,
  isInsideCircuitLoop,
  projectToTrack,
  sampleTrackAtS,
  START_LINE_S,
  TRACK_HALF_WIDTH,
} from './trackMath';
import type { SolidCollider } from './types';

export interface GrandstandPlacement {
  id: string;
  s: number;
  x: number;
  z: number;
  heading: number;
  lengthZ: number;
  sideSign: 1 | -1;
  seatColorHex: number;
  canopyColorHex: number;
}

export interface SpectatorSpec {
  x: number;
  y: number;
  z: number;
  yaw: number;
  phase: number;
  speed: number;
  jumpAmp: number;
  armAmp: number;
  scale: number;
  shirtHex: number;
  pantsHex: number;
  skinHex: number;
  capHex: number;
  hasCap: boolean;
  seated: boolean;
}

export interface CrowdFlagSpec {
  x: number;
  y: number;
  z: number;
  yaw: number;
  phase: number;
  colorHex: number;
  scale: number;
}

export interface BillboardPlacement {
  s: number;
  x: number;
  z: number;
  yaw: number;
  width: number;
  height: number;
  brandIndex: number;
}

export interface OverheadBridgePlacement {
  s: number;
  x: number;
  z: number;
  heading: number;
  brandIndex: number;
}

export interface PaddockPavilionPlacement {
  x: number;
  z: number;
  heading: number;
}

export interface TracksideLayout {
  grandstands: GrandstandPlacement[];
  spectators: SpectatorSpec[];
  flags: CrowdFlagSpec[];
  billboards: BillboardPlacement[];
  bridges: OverheadBridgePlacement[];
  pavilion: PaddockPavilionPlacement;
  colliders: SolidCollider[];
  t1EntryS: number;
}

const SHIRT_PALETTE = [
  0xdc2626, // Racing Red
  0x2563eb, // Factory Blue
  0xf59e0b, // Paddock Gold
  0xf8fafc, // Crisp White
  0x16a34a, // Lime
  0xea580c, // KTM Orange
  0x06b6d4, // Cyan
  0x7c3aed, // Violet
  0xe11d48, // Crimson
];

const PANTS_PALETTE = [0x0f172a, 0x1e293b, 0x334155, 0x1e3a8a, 0x18181b];
const SKIN_PALETTE = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
const CAP_PALETTE = [0xdc2626, 0x2563eb, 0xfacc15, 0x111827, 0xea580c, 0xf8fafc];

function seededRand(seedInit: number): () => number {
  let s = seedInit;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function makeObbCollider(
  id: string,
  kind: SolidCollider['kind'],
  centerX: number,
  centerZ: number,
  heading: number,
  halfX: number,
  halfZ: number,
): SolidCollider {
  return {
    id,
    kind,
    x: centerX,
    z: centerZ,
    halfX,
    halfZ,
    cosH: Math.cos(heading),
    sinH: Math.sin(heading),
  };
}

export function buildTracksideLayout(circuit: CircuitData): TracksideLayout {
  const rand = seededRand(42069);

  // Locate Turn 1 braking entry dynamically after main straight
  let t1EntryS = START_LINE_S + 320;
  for (let probe = START_LINE_S + 140; probe < circuit.totalLength; probe += 8) {
    if (Math.abs(sampleTrackAtS(circuit, probe).curvature) > 0.0045) {
      t1EntryS = probe;
      break;
    }
  }

  const pickOutsideSide = (s: number, dist: number): 1 | -1 => {
    const smp = sampleTrackAtS(circuit, s);
    const posX = smp.x + smp.nx * dist;
    const posZ = smp.z + smp.nz * dist;
    return isInsideCircuitLoop(circuit, posX, posZ) ? -1 : 1;
  };

  // 4 Major Grandstands ("Tribun") around the long GP circuit
  const standDefs: Array<{
    id: string;
    s: number;
    lengthZ: number;
    dist: number;
    forcedSide?: 1 | -1;
    seatColorHex: number;
    canopyColorHex: number;
  }> = [
    {
      id: 'main-pit-stand',
      s: START_LINE_S - 18,
      lengthZ: 88,
      dist: 25.5,
      forcedSide: 1, // Opposite pit complex on main straight
      seatColorHex: 0xdc2626,
      canopyColorHex: 0x0f172a,
    },
    {
      id: 'turn1-sweeper-stand',
      s: t1EntryS + 48,
      lengthZ: 58,
      dist: 28.0,
      seatColorHex: 0x2563eb,
      canopyColorHex: 0x1e293b,
    },
    {
      id: 'sector2-esses-stand',
      s: circuit.totalLength * 0.45,
      lengthZ: 52,
      dist: 28.5,
      seatColorHex: 0xd97706,
      canopyColorHex: 0x0f172a,
    },
    {
      id: 'stadium-hairpin-stand',
      s: circuit.totalLength * 0.8,
      lengthZ: 58,
      dist: 28.0,
      seatColorHex: 0x059669,
      canopyColorHex: 0x1e293b,
    },
  ];

  const grandstands: GrandstandPlacement[] = standDefs.map((def) => {
    const smp = sampleTrackAtS(circuit, def.s);
    const sideSign = def.forcedSide ?? pickOutsideSide(def.s, def.dist);
    return {
      id: def.id,
      s: def.s,
      x: smp.x + smp.nx * def.dist * sideSign,
      z: smp.z + smp.nz * def.dist * sideSign,
      heading: Math.atan2(smp.tx, smp.tz),
      lengthZ: def.lengthZ,
      sideSign,
      seatColorHex: def.seatColorHex,
      canopyColorHex: def.canopyColorHex,
    };
  });

  // Solid colliders list for Tribuns, Pit Buildings, Tower, Hospitality Pavilion & Bridge Pillars
  const colliders: SolidCollider[] = [];

  for (const gs of grandstands) {
    const cosH = Math.cos(gs.heading);
    const sinH = Math.sin(gs.heading);
    const localCenterX = -gs.sideSign * 4.4;
    const worldCx = gs.x + localCenterX * cosH;
    const worldCz = gs.z - localCenterX * sinH;
    colliders.push(
      makeObbCollider(
        `tribun-${gs.id}`,
        'tribun',
        worldCx,
        worldCz,
        gs.heading,
        6.8,
        gs.lengthZ * 0.5 + 0.6,
      ),
    );
  }

  // Pit Lane Building, Divider Wall, Timing Tower & Hospitality Pavilion colliders
  const pitSample = sampleTrackAtS(circuit, START_LINE_S - 18);
  const pitHeading = Math.atan2(pitSample.tx, pitSample.tz);
  const pitBaseX = pitSample.x - pitSample.nx * 23;
  const pitBaseZ = pitSample.z - pitSample.nz * 23;
  const pitCos = Math.cos(pitHeading);
  const pitSin = Math.sin(pitHeading);

  const pitToWorld = (lx: number, lz: number) => ({
    x: pitBaseX + lx * pitCos + lz * pitSin,
    z: pitBaseZ - lx * pitSin + lz * pitCos,
  });

  const pitBldgCenter = pitToWorld(3.5, 0);
  colliders.push(makeObbCollider('pit-garage', 'building', pitBldgCenter.x, pitBldgCenter.z, pitHeading, 5.2, 39.2));

  const pitWallCenter = pitToWorld(-9.5, 0);
  colliders.push(makeObbCollider('pit-wall', 'wall', pitWallCenter.x, pitWallCenter.z, pitHeading, 0.45, 31.2));

  const towerCenter = pitToWorld(6.5, 28);
  colliders.push(makeObbCollider('race-control-tower', 'building', towerCenter.x, towerCenter.z, pitHeading, 3.0, 3.0));

  const pavilionPos = pitToWorld(18.5, -10);
  const pavilion: PaddockPavilionPlacement = {
    x: pavilionPos.x,
    z: pavilionPos.z,
    heading: pitHeading,
  };
  colliders.push(makeObbCollider('paddock-pavilion', 'building', pavilionPos.x, pavilionPos.z, pitHeading, 6.4, 18.4));

  // Start/Finish Gantry Pillars solid colliders
  const startSmp = sampleTrackAtS(circuit, START_LINE_S);
  const startHeading = Math.atan2(startSmp.tx, startSmp.tz);
  const startCos = Math.cos(startHeading);
  const startSin = Math.sin(startHeading);
  const pDist = TRACK_HALF_WIDTH + 2.6;
  colliders.push(
    makeObbCollider('gantry-left', 'pillar', startSmp.x - pDist * startCos, startSmp.z + pDist * startSin, startHeading, 0.75, 0.75),
    makeObbCollider('gantry-right', 'pillar', startSmp.x + pDist * startCos, startSmp.z - pDist * startSin, startHeading, 0.75, 0.75),
  );

  // Upgraded 3D Spectators & Waving Flags across Grandstands + Pit Roof VIP Terrace
  const spectators: SpectatorSpec[] = [];
  const flags: CrowdFlagSpec[] = [];

  for (const gs of grandstands) {
    const cosH = Math.cos(gs.heading);
    const sinH = Math.sin(gs.heading);
    const faceYaw = gs.heading + (gs.sideSign > 0 ? Math.PI * 0.5 : -Math.PI * 0.5);
    const cols = Math.floor(gs.lengthZ / 2.05);

    for (let t = 0; t < 5; t++) {
      const localX = -gs.sideSign * t * 2.3 + gs.sideSign * 0.35;
      const seatY = 0.6 + t * 1.15 + 0.88;
      for (let c = 0; c < cols; c++) {
        if (rand() < 0.08) continue;
        const frac = cols <= 1 ? 0 : c / (cols - 1) - 0.5;
        const localZ = frac * (gs.lengthZ - 2.6) + (rand() - 0.5) * 0.35;

        const worldX = gs.x + localX * cosH + localZ * sinH;
        const worldZ = gs.z - localX * sinH + localZ * cosH;
        const shirtHex = SHIRT_PALETTE[Math.floor(rand() * SHIRT_PALETTE.length)];

        spectators.push({
          x: worldX,
          y: seatY,
          z: worldZ,
          yaw: faceYaw + (rand() - 0.5) * 0.25,
          phase: c * 0.38 + t * 0.52 + rand() * 0.7,
          speed: 3.5 + rand() * 2.2,
          jumpAmp: 0.1 + rand() * 0.14,
          armAmp: 0.42 + rand() * 0.48,
          scale: 0.94 + rand() * 0.18,
          shirtHex,
          pantsHex: PANTS_PALETTE[Math.floor(rand() * PANTS_PALETTE.length)],
          skinHex: SKIN_PALETTE[Math.floor(rand() * SKIN_PALETTE.length)],
          capHex: CAP_PALETTE[Math.floor(rand() * CAP_PALETTE.length)],
          hasCap: rand() < 0.65,
          seated: true,
        });

        // Scatter bright supporter flags along top tiers
        if (t >= 3 && rand() < 0.11) {
          flags.push({
            x: worldX,
            y: seatY + 1.05,
            z: worldZ,
            yaw: faceYaw,
            phase: rand() * Math.PI * 2,
            colorHex: shirtHex,
            scale: 0.95 + rand() * 0.35,
          });
        }
      }
    }
  }

  // VIP Spectators watching from top of the Pit Garage Roof Terrace
  for (let i = 0; i < 24; i++) {
    const lz = -34 + i * 2.95 + (rand() - 0.5) * 0.4;
    const wp = pitToWorld(1.2 + (i % 2) * 1.1, lz);
    const shirtHex = SHIRT_PALETTE[Math.floor(rand() * SHIRT_PALETTE.length)];
    spectators.push({
      x: wp.x,
      y: 6.02,
      z: wp.z,
      yaw: pitHeading - Math.PI * 0.5 + (rand() - 0.5) * 0.2,
      phase: i * 0.45 + rand(),
      speed: 3.6 + rand() * 1.6,
      jumpAmp: 0.1 + rand() * 0.12,
      armAmp: 0.45 + rand() * 0.4,
      scale: 0.98 + rand() * 0.12,
      shirtHex,
      pantsHex: PANTS_PALETTE[Math.floor(rand() * PANTS_PALETTE.length)],
      skinHex: SKIN_PALETTE[Math.floor(rand() * SKIN_PALETTE.length)],
      capHex: CAP_PALETTE[Math.floor(rand() * CAP_PALETTE.length)],
      hasCap: true,
      seated: false,
    });
  }

  // Standing Fan Clusters behind Armco Guardrails around corners & straights
  const railClearance = TRACK_HALF_WIDTH + CURB_WIDTH + GRAVEL_WIDTH + 2.4;
  const fanClusterS = [
    START_LINE_S + 100,
    START_LINE_S + 185,
    t1EntryS - 30,
    t1EntryS + 140,
    circuit.totalLength * 0.26,
    circuit.totalLength * 0.37,
    circuit.totalLength * 0.55,
    circuit.totalLength * 0.67,
    circuit.totalLength * 0.74,
    circuit.totalLength * 0.9,
  ];
  for (const baseS of fanClusterS) {
    const side = pickOutsideSide(baseS, railClearance);
    for (let k = 0; k < 16; k++) {
      const smp = sampleTrackAtS(circuit, baseS + k * 1.85);
      const lat = railClearance + 0.55 + (k % 2) * 1.05;
      const fx = smp.x + smp.nx * lat * side;
      const fz = smp.z + smp.nz * lat * side;
      if (projectToTrack(circuit, fx, fz, smp.s).absOffset < TRACK_HALF_WIDTH + CURB_WIDTH + GRAVEL_WIDTH + 1.3) {
        continue;
      }
      const h = Math.atan2(smp.tx, smp.tz);
      const faceYaw = h + (side > 0 ? Math.PI * 0.5 : -Math.PI * 0.5);
      const shirtHex = SHIRT_PALETTE[Math.floor(rand() * SHIRT_PALETTE.length)];
      spectators.push({
        x: fx,
        y: 0,
        z: fz,
        yaw: faceYaw + (rand() - 0.5) * 0.25,
        phase: k * 0.45 + rand() * 2.0,
        speed: 4.0 + rand() * 2.2,
        jumpAmp: 0.14 + rand() * 0.16,
        armAmp: 0.5 + rand() * 0.5,
        scale: 0.95 + rand() * 0.16,
        shirtHex,
        pantsHex: PANTS_PALETTE[Math.floor(rand() * PANTS_PALETTE.length)],
        skinHex: SKIN_PALETTE[Math.floor(rand() * SKIN_PALETTE.length)],
        capHex: CAP_PALETTE[Math.floor(rand() * CAP_PALETTE.length)],
        hasCap: rand() < 0.7,
        seated: false,
      });

      if (k % 6 === 2) {
        flags.push({
          x: fx,
          y: 1.0,
          z: fz,
          yaw: faceYaw,
          phase: rand() * Math.PI * 2,
          colorHex: shirtHex,
          scale: 1.0 + rand() * 0.25,
        });
      }
    }
  }

  // Trackside Advertising Billboards (34 spaced along the longer 4km+ circuits)
  const billboards: BillboardPlacement[] = [];
  const boardDist = TRACK_HALF_WIDTH + CURB_WIDTH + GRAVEL_WIDTH + 2.4;
  const boardCount = 34;
  const pitS = START_LINE_S - 18;

  for (let i = 0; i < boardCount; i++) {
    const s = ((i + 0.5) / boardCount) * circuit.totalLength;
    const smp = sampleTrackAtS(circuit, s);
    let side: 1 | -1 = i % 2 === 0 ? 1 : -1;
    if (Math.abs(s - pitS) < 62 && side === -1) {
      side = 1;
    }
    const candX = smp.x + smp.nx * boardDist * side;
    const candZ = smp.z + smp.nz * boardDist * side;

    let nearStand = false;
    for (const gs of grandstands) {
      if (Math.hypot(candX - gs.x, candZ - gs.z) < gs.lengthZ * 0.55) {
        nearStand = true;
        break;
      }
    }
    if (nearStand) {
      side = (side * -1) as 1 | -1;
      if (Math.abs(s - pitS) < 62 && side === -1) continue;
    }

    const bx = smp.x + smp.nx * boardDist * side;
    const bz = smp.z + smp.nz * boardDist * side;
    if (projectToTrack(circuit, bx, bz, s).absOffset < TRACK_HALF_WIDTH + CURB_WIDTH + GRAVEL_WIDTH + 1.1) {
      continue;
    }

    const h = Math.atan2(smp.tx, smp.tz);
    const yaw = h + (side > 0 ? -0.14 : 0.14);

    billboards.push({
      s,
      x: bx,
      z: bz,
      yaw,
      width: 11.5,
      height: 2.3,
      brandIndex: i % 5,
    });
  }

  // 2 Overhead Sponsor Bridges with solid Pillar colliders
  const bridgePositions = [circuit.totalLength * 0.4, circuit.totalLength * 0.72];
  const bridges: OverheadBridgePlacement[] = bridgePositions.map((bs, idx) => {
    const smp = sampleTrackAtS(circuit, bs);
    const bh = Math.atan2(smp.tx, smp.tz);
    const bCos = Math.cos(bh);
    const bSin = Math.sin(bh);
    colliders.push(
      makeObbCollider(`bridge-${idx}-l`, 'pillar', smp.x - pDist * bCos, smp.z + pDist * bSin, bh, 0.7, 0.7),
      makeObbCollider(`bridge-${idx}-r`, 'pillar', smp.x + pDist * bCos, smp.z - pDist * bSin, bh, 0.7, 0.7),
    );
    return {
      s: bs,
      x: smp.x,
      z: smp.z,
      heading: bh,
      brandIndex: (idx + 1) % 5,
    };
  });

  return {
    grandstands,
    spectators,
    flags,
    billboards,
    bridges,
    pavilion,
    colliders,
    t1EntryS,
  };
}
