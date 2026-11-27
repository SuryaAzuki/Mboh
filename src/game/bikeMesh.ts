import * as THREE from 'three';
import { getBikeLiveryTextures, getRiderSuitTextures } from './textures';
import { getRiderFaceStyle, type BikeClassId, type TeamLivery } from './types';

export const UPPER_ARM_LEN = 0.295;
export const FOREARM_LEN = 0.295;

export interface ArmJoints {
  armPivot: THREE.Group;
  elbowPivot: THREE.Group;
  wristPivot: THREE.Group;
  gripFingerPivot: THREE.Group;
  brakeFingerPivot: THREE.Group;
}

export interface LegJoints {
  legPivot: THREE.Group;
  kneePivot: THREE.Group;
  footPivot: THREE.Group;
}

export interface RiderJoints {
  torsoPivot: THREE.Group;
  headPivot: THREE.Group;
  visorPivot: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftArm: ArmJoints;
  rightArm: ArmJoints;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  leftLeg: LegJoints;
  rightLeg: LegJoints;
}

export interface RiderAnimState {
  hipX: number;
  hipY: number;
  hipZ: number;
  riderPitch: number;
  riderYaw: number;
  riderRoll: number;
  torsoX: number;
  torsoY: number;
  torsoZ: number;
  headX: number;
  headY: number;
  headZ: number;
  leftLegX: number;
  leftLegY: number;
  leftLegZ: number;
  rightLegX: number;
  rightLegY: number;
  rightLegZ: number;
  leftKneeX: number;
  leftKneeZ: number;
  rightKneeX: number;
  rightKneeZ: number;
  leftFootX: number;
  leftFootY: number;
  leftFootZ: number;
  rightFootX: number;
  rightFootY: number;
  rightFootZ: number;
  lastGear: number;
  shiftAnimTimer: number;
  shiftDirection: number;
  initialized: boolean;
}

export interface BikeVisualRig {
  root: THREE.Group;
  leanGroup: THREE.Group;
  frontForkGroup: THREE.Group;
  leftGripAnchor: THREE.Vector3;
  rightGripAnchor: THREE.Vector3;
  frontWheel: THREE.Group;
  rearWheel: THREE.Group;
  riderGroup: THREE.Group;
  riderJoints: RiderJoints;
  animState: RiderAnimState;
  exhaustFlame: THREE.Mesh;
  dispose: () => void;
}

export interface StandingRiderRig {
  root: THREE.Group;
  torsoPivot: THREE.Group;
  headPivot: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftArm: ArmJoints;
  rightArm: ArmJoints;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  leftFootPivot: THREE.Group;
  rightFootPivot: THREE.Group;
  dispose: () => void;
}

// ---------------------------------------------------------------------------
// Shared reusable geometries (never disposed per-rig; fast with 22 bikes)
// ---------------------------------------------------------------------------
function markShared<T extends THREE.BufferGeometry>(geo: T): T {
  geo.userData.sharedGeo = true;
  return geo;
}

let sharedGeos: {
  neck: THREE.CylinderGeometry;
  collar: THREE.TorusGeometry;
  skull: THREE.SphereGeometry;
  jaw: THREE.SphereGeometry;
  hairCrown: THREE.SphereGeometry;
  earOuter: THREE.TorusGeometry;
  earConcha: THREE.SphereGeometry;
  sclera: THREE.SphereGeometry;
  iris: THREE.SphereGeometry;
  pupil: THREE.SphereGeometry;
  brow: THREE.BoxGeometry;
  noseBridge: THREE.BoxGeometry;
  noseTip: THREE.SphereGeometry;
  nostril: THREE.SphereGeometry;
  lipUpper: THREE.CapsuleGeometry;
  lipLower: THREE.CapsuleGeometry;
  mouthLine: THREE.BoxGeometry;
  beard: THREE.SphereGeometry;
  helmetCrown: THREE.SphereGeometry;
  helmetRearShell: THREE.SphereGeometry;
  helmetCheek: THREE.BoxGeometry;
  helmetChinStrap: THREE.TorusGeometry;
  helmetSpoiler: THREE.ConeGeometry;
  helmetVisor: THREE.SphereGeometry;
  upperArm: THREE.CapsuleGeometry;
  elbowJoint: THREE.SphereGeometry;
  elbowSlider: THREE.BoxGeometry;
  foreArm: THREE.CapsuleGeometry;
  wristCuff: THREE.CylinderGeometry;
  palm: THREE.BoxGeometry;
  knuckleBar: THREE.BoxGeometry;
  thumbProx: THREE.CapsuleGeometry;
  thumbDist: THREE.CapsuleGeometry;
  fingerProx: THREE.CapsuleGeometry;
  fingerDist: THREE.CapsuleGeometry;
  thigh: THREE.CapsuleGeometry;
  kneeCap: THREE.SphereGeometry;
  kneeSlider: THREE.CylinderGeometry;
  shin: THREE.CapsuleGeometry;
  ankleJoint: THREE.SphereGeometry;
  bootCuff: THREE.CylinderGeometry;
  bootHeel: THREE.BoxGeometry;
  bootInstep: THREE.BoxGeometry;
  bootSole: THREE.BoxGeometry;
  bootToe: THREE.CapsuleGeometry;
  toeSlider: THREE.BoxGeometry;
} | null = null;

function getSharedGeos() {
  if (sharedGeos) return sharedGeos;

  const skull = new THREE.SphereGeometry(0.112, 16, 14);
  skull.scale(0.9, 1.05, 0.96);

  const jaw = new THREE.SphereGeometry(0.088, 12, 10);
  jaw.scale(0.86, 0.92, 0.98);

  const hairCrown = new THREE.SphereGeometry(0.116, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.48);
  hairCrown.scale(0.92, 0.95, 1.0);

  const earOuter = new THREE.TorusGeometry(0.018, 0.006, 6, 12);
  earOuter.scale(0.65, 1.25, 0.75);

  const earConcha = new THREE.SphereGeometry(0.013, 8, 6);
  earConcha.scale(0.5, 1.0, 0.65);

  const sclera = new THREE.SphereGeometry(0.016, 10, 8);
  sclera.scale(1.15, 0.72, 0.55);

  const iris = new THREE.SphereGeometry(0.0095, 8, 6);
  iris.scale(1.0, 1.0, 0.5);

  const pupil = new THREE.SphereGeometry(0.0052, 6, 6);
  pupil.scale(1.0, 1.0, 0.5);

  const helmetCrown = new THREE.SphereGeometry(
    0.142,
    18,
    14,
    -Math.PI * 0.15,
    Math.PI * 1.3,
    0,
    Math.PI * 0.56,
  );
  helmetCrown.scale(0.95, 1.02, 1.12);

  const helmetRearShell = new THREE.SphereGeometry(
    0.143,
    18,
    14,
    Math.PI * 0.62,
    Math.PI * 0.76,
    Math.PI * 0.15,
    Math.PI * 0.68,
  );
  helmetRearShell.scale(0.95, 1.0, 1.12);

  const helmetSpoiler = new THREE.ConeGeometry(0.068, 0.165, 4);
  helmetSpoiler.rotateX(-Math.PI / 2);

  const helmetVisor = new THREE.SphereGeometry(
    0.147,
    16,
    12,
    -Math.PI * 0.34,
    Math.PI * 0.68,
    Math.PI * 0.22,
    Math.PI * 0.34,
  );

  const helmetChinStrap = new THREE.TorusGeometry(0.118, 0.015, 6, 16, Math.PI * 0.92);
  helmetChinStrap.rotateX(Math.PI * 0.5);

  const kneeSlider = new THREE.CylinderGeometry(0.04, 0.04, 0.028, 10);
  kneeSlider.rotateZ(Math.PI / 2);
  kneeSlider.scale(1.0, 1.25, 1.15);

  const lipUpper = new THREE.CapsuleGeometry(0.0065, 0.028, 4, 6);
  lipUpper.rotateZ(Math.PI / 2);

  const lipLower = new THREE.CapsuleGeometry(0.0072, 0.024, 4, 6);
  lipLower.rotateZ(Math.PI / 2);

  const beard = new THREE.SphereGeometry(0.088, 10, 8, 0, Math.PI * 2, Math.PI * 0.54, Math.PI * 0.44);
  beard.scale(0.9, 0.96, 1.02);

  const bootToe = new THREE.CapsuleGeometry(0.036, 0.072, 6, 8);
  bootToe.rotateX(Math.PI / 2);
  bootToe.scale(1.12, 0.78, 1.0);

  sharedGeos = {
    neck: markShared(new THREE.CylinderGeometry(0.048, 0.066, 0.09, 10)),
    collar: markShared(new THREE.TorusGeometry(0.074, 0.018, 6, 14)),
    skull: markShared(skull),
    jaw: markShared(jaw),
    hairCrown: markShared(hairCrown),
    earOuter: markShared(earOuter),
    earConcha: markShared(earConcha),
    sclera: markShared(sclera),
    iris: markShared(iris),
    pupil: markShared(pupil),
    brow: markShared(new THREE.BoxGeometry(0.034, 0.008, 0.014)),
    noseBridge: markShared(new THREE.BoxGeometry(0.016, 0.032, 0.02)),
    noseTip: markShared(new THREE.SphereGeometry(0.013, 8, 8)),
    nostril: markShared(new THREE.SphereGeometry(0.0048, 6, 6)),
    lipUpper: markShared(lipUpper),
    lipLower: markShared(lipLower),
    mouthLine: markShared(new THREE.BoxGeometry(0.03, 0.004, 0.008)),
    beard: markShared(beard),
    helmetCrown: markShared(helmetCrown),
    helmetRearShell: markShared(helmetRearShell),
    helmetCheek: markShared(new THREE.BoxGeometry(0.028, 0.065, 0.082)),
    helmetChinStrap: markShared(helmetChinStrap),
    helmetSpoiler: markShared(helmetSpoiler),
    helmetVisor: markShared(helmetVisor),
    upperArm: markShared(new THREE.CapsuleGeometry(0.043, 0.195, 6, 10)),
    elbowJoint: markShared(new THREE.SphereGeometry(0.041, 8, 8)),
    elbowSlider: markShared(new THREE.BoxGeometry(0.034, 0.05, 0.024)),
    foreArm: markShared(new THREE.CapsuleGeometry(0.036, 0.195, 6, 10)),
    wristCuff: markShared(new THREE.CylinderGeometry(0.032, 0.034, 0.034, 8)),
    palm: markShared(new THREE.BoxGeometry(0.064, 0.062, 0.028)),
    knuckleBar: markShared(new THREE.BoxGeometry(0.068, 0.02, 0.032)),
    thumbProx: markShared(new THREE.CapsuleGeometry(0.011, 0.024, 4, 6)),
    thumbDist: markShared(new THREE.CapsuleGeometry(0.009, 0.02, 4, 6)),
    fingerProx: markShared(new THREE.CapsuleGeometry(0.009, 0.026, 4, 6)),
    fingerDist: markShared(new THREE.CapsuleGeometry(0.008, 0.022, 4, 6)),
    thigh: markShared(new THREE.CapsuleGeometry(0.064, 0.24, 6, 10)),
    kneeCap: markShared(new THREE.SphereGeometry(0.056, 10, 8)),
    kneeSlider: markShared(kneeSlider),
    shin: markShared(new THREE.CapsuleGeometry(0.048, 0.23, 6, 10)),
    ankleJoint: markShared(new THREE.SphereGeometry(0.042, 8, 8)),
    bootCuff: markShared(new THREE.CylinderGeometry(0.046, 0.044, 0.075, 10)),
    bootHeel: markShared(new THREE.BoxGeometry(0.066, 0.055, 0.075)),
    bootInstep: markShared(new THREE.BoxGeometry(0.072, 0.052, 0.095)),
    bootSole: markShared(new THREE.BoxGeometry(0.078, 0.02, 0.22)),
    bootToe: markShared(bootToe),
    toeSlider: markShared(new THREE.BoxGeometry(0.026, 0.022, 0.058)),
  };

  return sharedGeos;
}

// ---------------------------------------------------------------------------
// Pre-allocated scratch math objects (zero allocations per frame)
// ---------------------------------------------------------------------------
const _vGripFork = new THREE.Vector3();
const _vGripLean = new THREE.Vector3();
const _vGripRider = new THREE.Vector3();
const _vGripTorso = new THREE.Vector3();
const _vShoulder = new THREE.Vector3();
const _vToGrip = new THREE.Vector3();
const _vDir = new THREE.Vector3();
const _vPole = new THREE.Vector3();
const _vBendNormal = new THREE.Vector3();
const _vUpperDir = new THREE.Vector3();
const _vElbowPos = new THREE.Vector3();
const _vForeDir = new THREE.Vector3();
const _vForeProj = new THREE.Vector3();
const _vArmRight = new THREE.Vector3();
const _vArmUp = new THREE.Vector3();
const _vArmFwd = new THREE.Vector3();
const _mArmBasis = new THREE.Matrix4();
const _qFork = new THREE.Quaternion();
const _qRiderInv = new THREE.Quaternion();
const _qTorsoInv = new THREE.Quaternion();
const _eulerTmp = new THREE.Euler(0, 0, 0, 'XYZ');

export interface SolvedArmIK {
  armQuaternion: THREE.Quaternion;
  elbowRotationX: number;
  gripReachDist: number;
  wristLocalError: number;
}

/**
 * Pure analytical 2-bone IK solver from shoulder to handlebar grip inside torsoPivot space.
 * Ensures hands hold the exact handlebar grip cleanly through aero tuck, braking, lean, and steering.
 */
export function solveRiderArmIK(
  side: 1 | -1,
  shoulderLocal: THREE.Vector3,
  gripTorsoLocal: THREE.Vector3,
  upperLen = UPPER_ARM_LEN,
  foreLen = FOREARM_LEN,
): SolvedArmIK {
  _vToGrip.subVectors(gripTorsoLocal, shoulderLocal);
  const rawDist = _vToGrip.length();
  const maxReach = upperLen + foreLen - 0.01;
  const dist = Math.min(maxReach, Math.max(0.14, rawDist));
  if (rawDist > 1e-5) {
    _vDir.copy(_vToGrip).divideScalar(rawDist);
  } else {
    _vDir.set(0, 0, 1);
  }

  // Pole hints elbows outward (±X) and back/down (-Y, -Z) in MotoGP athletic stance
  _vPole.set(side * 0.92, -0.35, -0.52);
  _vBendNormal.copy(_vPole).addScaledVector(_vDir, -_vPole.dot(_vDir));
  if (_vBendNormal.lengthSq() < 1e-4) {
    _vBendNormal.set(side, 0, 0);
  } else {
    _vBendNormal.normalize();
  }

  const cosAlpha = Math.max(
    -0.999,
    Math.min(0.999, (upperLen * upperLen + dist * dist - foreLen * foreLen) / (2 * upperLen * dist)),
  );
  const sinAlpha = Math.sqrt(Math.max(0, 1 - cosAlpha * cosAlpha));

  _vUpperDir
    .copy(_vDir)
    .multiplyScalar(cosAlpha)
    .addScaledVector(_vBendNormal, sinAlpha)
    .normalize();

  _vElbowPos.copy(shoulderLocal).addScaledVector(_vUpperDir, upperLen);
  _vForeDir.copy(shoulderLocal).addScaledVector(_vDir, dist).sub(_vElbowPos).normalize();

  // Construct right-handed arm basis so local -Y points along upper arm & +Z faces inside bend
  _vArmUp.copy(_vUpperDir).negate();
  _vForeProj.copy(_vForeDir).addScaledVector(_vUpperDir, -_vForeDir.dot(_vUpperDir));
  if (_vForeProj.lengthSq() > 1e-6) {
    _vArmFwd.copy(_vForeProj).normalize();
  } else {
    _vArmFwd.copy(_vBendNormal).negate().addScaledVector(_vUpperDir, _vBendNormal.dot(_vUpperDir)).normalize();
  }
  _vArmRight.crossVectors(_vArmUp, _vArmFwd).normalize();
  _vArmFwd.crossVectors(_vArmRight, _vArmUp).normalize();

  _mArmBasis.makeBasis(_vArmRight, _vArmUp, _vArmFwd);
  const armQuaternion = new THREE.Quaternion().setFromRotationMatrix(_mArmBasis);

  const elbowDot = Math.max(-0.999, Math.min(0.999, _vUpperDir.dot(_vForeDir)));
  const elbowBend = Math.acos(elbowDot);
  const elbowRotationX = -elbowBend;

  // Verify solved end-effector position against target grip
  const solvedTipInArm = new THREE.Vector3(0, -foreLen, 0).applyAxisAngle(new THREE.Vector3(1, 0, 0), elbowRotationX);
  solvedTipInArm.y -= upperLen;
  solvedTipInArm.applyQuaternion(armQuaternion).add(shoulderLocal);
  const targetClamped = shoulderLocal.clone().addScaledVector(_vDir, dist);
  const wristLocalError = solvedTipInArm.distanceTo(targetClamped);

  return {
    armQuaternion,
    elbowRotationX,
    gripReachDist: rawDist,
    wristLocalError,
  };
}

function createRealisticWheel(
  tireRadius: number,
  tireTube: number,
  tireMat: THREE.Material,
  rimMat: THREE.Material,
  discMat: THREE.Material,
  caliperMat: THREE.Material,
  accentMat: THREE.Material,
  dualDisc: boolean,
): THREE.Group {
  const wheel = new THREE.Group();

  const tireGeo = new THREE.TorusGeometry(tireRadius, tireTube, 20, 36);
  tireGeo.rotateY(Math.PI / 2);
  const tire = new THREE.Mesh(tireGeo, tireMat);
  tire.castShadow = true;
  wheel.add(tire);

  const rimRingGeo = new THREE.TorusGeometry(tireRadius - tireTube * 0.65, 0.011, 8, 30);
  rimRingGeo.rotateY(Math.PI / 2);
  const rimRingL = new THREE.Mesh(rimRingGeo, accentMat);
  rimRingL.position.x = 0.068;
  const rimRingR = new THREE.Mesh(rimRingGeo, accentMat);
  rimRingR.position.x = -0.068;
  wheel.add(rimRingL, rimRingR);

  const barrelGeo = new THREE.CylinderGeometry(
    tireRadius - tireTube * 0.68,
    tireRadius - tireTube * 0.68,
    0.13,
    22,
    1,
    true,
  );
  barrelGeo.rotateZ(Math.PI / 2);
  const barrel = new THREE.Mesh(barrelGeo, rimMat);
  wheel.add(barrel);

  const hubGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.16, 12);
  hubGeo.rotateZ(Math.PI / 2);
  const hub = new THREE.Mesh(hubGeo, rimMat);
  wheel.add(hub);

  const spokeGeo = new THREE.BoxGeometry(0.022, tireRadius - tireTube * 0.72, 0.022);
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const spoke = new THREE.Mesh(spokeGeo, rimMat);
    spoke.rotation.x = angle;
    spoke.position.set(0, Math.cos(angle) * 0.1, Math.sin(angle) * 0.1);
    wheel.add(spoke);
  }

  const discGeo = new THREE.RingGeometry(0.078, 0.172, 24);
  discGeo.rotateY(Math.PI / 2);
  const discLeft = new THREE.Mesh(discGeo, discMat);
  discLeft.position.x = 0.084;
  wheel.add(discLeft);

  if (dualDisc) {
    const discRight = new THREE.Mesh(discGeo, discMat);
    discRight.position.x = -0.084;
    wheel.add(discRight);
  }

  const calGeo = new THREE.BoxGeometry(0.044, 0.08, 0.066);
  const cal = new THREE.Mesh(calGeo, caliperMat);
  cal.position.set(0.088, 0.06, -0.135);
  wheel.add(cal);

  if (dualDisc) {
    const calR = new THREE.Mesh(calGeo, caliperMat);
    calR.position.set(-0.088, 0.06, -0.135);
    wheel.add(calR);
  }

  return wheel;
}

function buildDetailedHeadAndHelmet(
  livery: TeamLivery,
  suitMat: THREE.Material,
  helmetShellMat: THREE.Material,
  balaclavaMat: THREE.Material,
  skinMat: THREE.Material,
  visorMat: THREE.Material,
): { headPivot: THREE.Group; visorPivot: THREE.Group } {
  const g = getSharedGeos();
  const faceStyle = getRiderFaceStyle(livery);
  const headPivot = new THREE.Group();
  headPivot.name = 'headPivot';

  // Local materials for personalized facial features
  const hairMat = new THREE.MeshStandardMaterial({ color: faceStyle.hairHex, roughness: 0.78 });
  const lipMat = new THREE.MeshStandardMaterial({ color: 0xb96c62, roughness: 0.62 });
  const scleraMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
  const irisMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.28 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.2 });
  const earShadowMat = new THREE.MeshStandardMaterial({ color: 0x8b5a44, roughness: 0.8 });

  // 1. Neck & suit collar
  const neck = new THREE.Mesh(g.neck, skinMat);
  neck.name = 'neck';
  neck.position.set(0, 0.032, 0);
  headPivot.add(neck);

  const collar = new THREE.Mesh(g.collar, balaclavaMat);
  collar.rotation.x = Math.PI * 0.5;
  collar.position.set(0, 0.008, 0.004);
  headPivot.add(collar);

  // 2. Sculpted Human Head (Cranium + Cheekbones + Jawline)
  const skull = new THREE.Mesh(g.skull, skinMat);
  skull.name = 'head';
  skull.position.set(0, 0.155, 0.02);
  skull.castShadow = true;
  headPivot.add(skull);

  const jaw = new THREE.Mesh(g.jaw, skinMat);
  jaw.name = 'jaw';
  jaw.position.set(0, 0.112, 0.034);
  headPivot.add(jaw);

  // Hair cap at brow & temples
  const hair = new THREE.Mesh(g.hairCrown, hairMat);
  hair.name = 'hair';
  hair.position.set(0, 0.172, 0.018);
  hair.rotation.x = -0.18;
  headPivot.add(hair);

  // 3. Left & Right Ears (distinct outer pinna + inner concha recessed naturally at helmet ear ports)
  for (const side of [1, -1] as const) {
    const earGroup = new THREE.Group();
    earGroup.name = side === 1 ? 'earL' : 'earR';
    earGroup.position.set(side * 0.104, 0.148, 0.012);
    earGroup.rotation.y = side * 0.24;

    const outer = new THREE.Mesh(g.earOuter, skinMat);
    outer.rotation.y = Math.PI / 2;
    const inner = new THREE.Mesh(g.earConcha, earShadowMat);
    inner.position.x = -side * 0.003;
    earGroup.add(outer, inner);
    headPivot.add(earGroup);
  }

  // 4. Eyes (Sclera + Iris + Pupil) & Eyebrows
  for (const side of [1, -1] as const) {
    const eyeGroup = new THREE.Group();
    eyeGroup.name = side === 1 ? 'eyeL' : 'eyeR';
    eyeGroup.position.set(side * 0.036, 0.165, 0.108);

    const sclera = new THREE.Mesh(g.sclera, scleraMat);
    const iris = new THREE.Mesh(g.iris, irisMat);
    iris.position.z = 0.0068;
    const pupil = new THREE.Mesh(g.pupil, pupilMat);
    pupil.position.z = 0.0095;
    eyeGroup.add(sclera, iris, pupil);

    const brow = new THREE.Mesh(g.brow, hairMat);
    brow.name = side === 1 ? 'eyebrowL' : 'eyebrowR';
    brow.position.set(0, 0.018, 0.004);
    brow.rotation.z = -side * 0.09;
    eyeGroup.add(brow);

    headPivot.add(eyeGroup);
  }

  // 5. Sculpted Nose (bridge + rounded tip + nostrils)
  const noseGroup = new THREE.Group();
  noseGroup.name = 'nose';
  noseGroup.position.set(0, 0.146, 0.118);

  const bridge = new THREE.Mesh(g.noseBridge, skinMat);
  bridge.rotation.x = -0.26;
  bridge.position.set(0, 0.006, 0.004);

  const tip = new THREE.Mesh(g.noseTip, skinMat);
  tip.position.set(0, -0.008, 0.012);

  const nostrilL = new THREE.Mesh(g.nostril, earShadowMat);
  nostrilL.position.set(0.007, -0.013, 0.007);
  const nostrilR = new THREE.Mesh(g.nostril, earShadowMat);
  nostrilR.position.set(-0.007, -0.013, 0.007);

  noseGroup.add(bridge, tip, nostrilL, nostrilR);
  headPivot.add(noseGroup);

  // 6. Sculpted Mouth (upper & lower lips + subtle expression line + optional beard/stubble)
  const mouthGroup = new THREE.Group();
  mouthGroup.name = 'mouth';
  mouthGroup.position.set(0, 0.106, 0.108);

  const upperLip = new THREE.Mesh(g.lipUpper, lipMat);
  upperLip.position.set(0, 0.004, 0.004);

  const lowerLip = new THREE.Mesh(g.lipLower, lipMat);
  lowerLip.position.set(0, -0.005, 0.003);

  const mouthCrevice = new THREE.Mesh(g.mouthLine, earShadowMat);
  mouthCrevice.position.set(0, 0, 0.007);

  mouthGroup.add(upperLip, lowerLip, mouthCrevice);
  headPivot.add(mouthGroup);

  if (faceStyle.beard) {
    const beard = new THREE.Mesh(g.beard, hairMat);
    beard.name = 'beard';
    beard.position.set(0, 0.114, 0.036);
    headPivot.add(beard);
  }

  // 7. Aerodynamic Open-Face / Clear-Port Racing Helmet Shell (leaves ears & face clearly visible)
  const shellCrown = new THREE.Mesh(g.helmetCrown, helmetShellMat);
  shellCrown.name = 'helmetShell';
  shellCrown.position.set(0, 0.156, 0.004);
  shellCrown.rotation.y = Math.PI * 0.5;
  shellCrown.castShadow = true;
  headPivot.add(shellCrown);

  const rearShell = new THREE.Mesh(g.helmetRearShell, helmetShellMat);
  rearShell.position.set(0, 0.148, 0.002);
  rearShell.rotation.y = Math.PI * 0.5;
  headPivot.add(rearShell);

  // Temple cheek pads framing the ears cleanly without covering them
  for (const side of [1, -1] as const) {
    const cheek = new THREE.Mesh(g.helmetCheek, suitMat);
    cheek.position.set(side * 0.115, 0.102, 0.048);
    cheek.rotation.y = side * 0.25;
    headPivot.add(cheek);
  }

  // Low slim chin strap under jawline (keeps nose & mouth 100% unobstructed)
  const chinStrap = new THREE.Mesh(g.helmetChinStrap, balaclavaMat);
  chinStrap.position.set(0, 0.068, 0.03);
  chinStrap.rotation.x = 0.12;
  headPivot.add(chinStrap);

  // Rear MotoGP aero diffuser spoiler fin
  const spoiler = new THREE.Mesh(g.helmetSpoiler, balaclavaMat);
  spoiler.position.set(0, 0.214, -0.158);
  headPivot.add(spoiler);

  // Crystal-clear curved shield hinged at temple ratchets (raised on pre-race/podium, lowered slightly riding)
  const visorPivot = new THREE.Group();
  visorPivot.name = 'visorPivot';
  visorPivot.position.set(0, 0.162, 0.02);

  const visor = new THREE.Mesh(g.helmetVisor, visorMat);
  visor.name = 'visor';
  visor.rotation.y = Math.PI * 0.5;
  visorPivot.add(visor);
  visorPivot.rotation.x = -0.34;
  headPivot.add(visorPivot);

  return { headPivot, visorPivot };
}

/**
 * Builds an articulated upper arm -> elbow -> forearm -> wrist/hand + thumb + 4 segmented fingers.
 * Upper arm & forearm run cleanly along local -Y so 2-bone IK hits the handlebar grip accurately.
 */
function buildArticulatedArm(
  side: 1 | -1,
  solidSuitMat: THREE.Material,
  leatherMat: THREE.Material,
  bootMat: THREE.Material,
  accentMat: THREE.Material,
  sliderMat: THREE.Material,
  upperArmMat: THREE.Material = solidSuitMat,
): ArmJoints {
  const g = getSharedGeos();
  const armPivot = new THREE.Group();
  armPivot.name = side === 1 ? 'leftArmPivot' : 'rightArmPivot';
  armPivot.position.set(side * 0.192, 0.41, 0.07);

  // Upper arm along -Y (0 -> -UPPER_ARM_LEN)
  const upperArm = new THREE.Mesh(g.upperArm, upperArmMat);
  upperArm.position.set(0, -UPPER_ARM_LEN * 0.5, 0);
  upperArm.castShadow = true;
  armPivot.add(upperArm);

  // Elbow pivot at (0, -UPPER_ARM_LEN, 0)
  const elbowPivot = new THREE.Group();
  elbowPivot.name = side === 1 ? 'leftElbowPivot' : 'rightElbowPivot';
  elbowPivot.position.set(0, -UPPER_ARM_LEN, 0);
  armPivot.add(elbowPivot);

  const elbowMesh = new THREE.Mesh(g.elbowJoint, solidSuitMat);
  const elbowSlider = new THREE.Mesh(g.elbowSlider, sliderMat);
  elbowSlider.position.set(0, -0.006, -0.032);
  elbowPivot.add(elbowMesh, elbowSlider);

  // Forearm along -Y (0 -> -FOREARM_LEN)
  const foreArm = new THREE.Mesh(g.foreArm, leatherMat);
  foreArm.position.set(0, -FOREARM_LEN * 0.5, 0);
  foreArm.castShadow = true;
  elbowPivot.add(foreArm);

  // Wrist & Detailed 5-Fingered Hand at (0, -FOREARM_LEN, 0)
  const wristPivot = new THREE.Group();
  wristPivot.name = side === 1 ? 'leftHand' : 'rightHand';
  wristPivot.position.set(0, -FOREARM_LEN, 0);
  elbowPivot.add(wristPivot);

  const cuff = new THREE.Mesh(g.wristCuff, bootMat);
  cuff.position.set(0, 0.012, 0);
  wristPivot.add(cuff);

  // Palm & Knuckle Guard oriented so fingers curl naturally down/forward around handlebar grip
  const palm = new THREE.Mesh(g.palm, bootMat);
  palm.name = side === 1 ? 'leftPalm' : 'rightPalm';
  palm.position.set(0, -0.025, 0.004);
  wristPivot.add(palm);

  const knuckle = new THREE.Mesh(g.knuckleBar, accentMat);
  knuckle.position.set(0, -0.048, -0.01);
  wristPivot.add(knuckle);

  // Opposable Thumb (2 segments wrapping opposite side of bar)
  const thumbBase = new THREE.Group();
  thumbBase.name = side === 1 ? 'leftThumb' : 'rightThumb';
  thumbBase.position.set(-side * 0.032, -0.024, 0.015);
  thumbBase.rotation.set(0.42, 0, -side * 0.55);
  const tProx = new THREE.Mesh(g.thumbProx, bootMat);
  tProx.position.set(0, -0.014, 0);
  const tDist = new THREE.Mesh(g.thumbDist, accentMat);
  tDist.position.set(side * 0.008, -0.034, 0.012);
  tDist.rotation.x = 0.65;
  thumbBase.add(tProx, tDist);
  wristPivot.add(thumbBase);

  // Four Articulated Fingers (index + middle on brake/clutch pivot, ring + pinky on grip pivot)
  const brakeFingerPivot = new THREE.Group();
  brakeFingerPivot.name = side === 1 ? 'leftIndexMiddleFingers' : 'rightIndexMiddleFingers';
  brakeFingerPivot.position.set(0, -0.056, 0.006);
  wristPivot.add(brakeFingerPivot);

  const gripFingerPivot = new THREE.Group();
  gripFingerPivot.name = side === 1 ? 'leftRingPinkyFingers' : 'rightRingPinkyFingers';
  gripFingerPivot.position.set(0, -0.056, 0.006);
  wristPivot.add(gripFingerPivot);

  const fingerOffsets = [
    { name: 'index', x: -side * 0.023, lenScale: 0.98, group: brakeFingerPivot },
    { name: 'middle', x: -side * 0.007, lenScale: 1.05, group: brakeFingerPivot },
    { name: 'ring', x: side * 0.009, lenScale: 0.96, group: gripFingerPivot },
    { name: 'pinky', x: side * 0.024, lenScale: 0.82, group: gripFingerPivot },
  ];

  for (const f of fingerOffsets) {
    const fWrap = new THREE.Group();
    fWrap.name = `${side === 1 ? 'left' : 'right'}_finger_${f.name}`;
    fWrap.position.set(f.x, 0, 0);

    const prox = new THREE.Mesh(g.fingerProx, bootMat);
    prox.scale.y = f.lenScale;
    prox.position.set(0, -0.015 * f.lenScale, 0.014);
    prox.rotation.x = 0.72;

    const dist = new THREE.Mesh(g.fingerDist, accentMat);
    dist.scale.y = f.lenScale;
    dist.position.set(0, -0.022 * f.lenScale, 0.036);
    dist.rotation.x = 1.65;

    fWrap.add(prox, dist);
    f.group.add(fWrap);
  }

  return { armPivot, elbowPivot, wristPivot, gripFingerPivot, brakeFingerPivot };
}

/**
 * Builds an articulated Leg -> Knee (with slider & shin) -> Ankle Foot Pivot (racing boot + sole + toe slider).
 */
function buildArticulatedLeg(
  side: 1 | -1,
  solidSuitMat: THREE.Material,
  leatherMat: THREE.Material,
  bootMat: THREE.Material,
  accentMat: THREE.Material,
  sliderMat: THREE.Material,
): LegJoints {
  const g = getSharedGeos();
  const legPivot = new THREE.Group();
  legPivot.name = side === 1 ? 'leftLegPivot' : 'rightLegPivot';
  legPivot.position.set(side * 0.125, 0.03, 0.02);

  // Thigh from hip to knee
  const thigh = new THREE.Mesh(g.thigh, leatherMat);
  thigh.position.set(side * 0.045, -0.048, 0.145);
  thigh.rotation.set(1.18, side * 0.22, -side * 0.14);
  thigh.castShadow = true;
  legPivot.add(thigh);

  // Articulated Knee Pivot
  const kneePivot = new THREE.Group();
  kneePivot.name = side === 1 ? 'leftKneePivot' : 'rightKneePivot';
  kneePivot.position.set(side * 0.088, -0.105, 0.278);
  legPivot.add(kneePivot);

  const kneeCap = new THREE.Mesh(g.kneeCap, solidSuitMat);
  kneePivot.add(kneeCap);

  const slider = new THREE.Mesh(g.kneeSlider, sliderMat);
  slider.position.set(side * 0.048, -0.01, 0.018);
  slider.rotation.y = side * 0.18;
  kneePivot.add(slider);

  // Shin from knee down-back to rearset ankle
  const shin = new THREE.Mesh(g.shin, solidSuitMat);
  shin.position.set(-side * 0.024, -0.135, -0.115);
  shin.rotation.x = -0.62;
  shin.castShadow = true;
  kneePivot.add(shin);

  // Articulated Ankle / Racing Boot Foot Pivot
  const footPivot = new THREE.Group();
  footPivot.name = side === 1 ? 'leftFoot' : 'rightFoot';
  footPivot.position.set(-side * 0.032, -0.255, -0.215);
  kneePivot.add(footPivot);

  const ankleSphere = new THREE.Mesh(g.ankleJoint, bootMat);
  footPivot.add(ankleSphere);

  const cuff = new THREE.Mesh(g.bootCuff, bootMat);
  cuff.position.set(0, 0.032, 0.005);
  footPivot.add(cuff);

  const heel = new THREE.Mesh(g.bootHeel, bootMat);
  heel.position.set(0, -0.02, -0.02);
  footPivot.add(heel);

  const instep = new THREE.Mesh(g.bootInstep, bootMat);
  instep.position.set(0, -0.015, 0.055);
  instep.rotation.x = 0.2;
  footPivot.add(instep);

  const sole = new THREE.Mesh(g.bootSole, sliderMat);
  sole.position.set(0, -0.048, 0.055);
  footPivot.add(sole);

  const toeBox = new THREE.Mesh(g.bootToe, bootMat);
  toeBox.position.set(0, -0.026, 0.128);
  footPivot.add(toeBox);

  const toeSlider = new THREE.Mesh(g.toeSlider, accentMat);
  toeSlider.position.set(side * 0.034, -0.032, 0.13);
  footPivot.add(toeSlider);

  return { legPivot, kneePivot, footPivot };
}

export function createMotoBikeRig(
  livery: TeamLivery,
  shadowMap: THREE.Texture,
  isSoftwareGl: boolean,
  bikeClass: BikeClassId = 'motogp',
): BikeVisualRig {
  const root = new THREE.Group();
  root.rotation.order = 'YXZ';

  const bodyWidthScale = bikeClass === 'moto3' ? 0.8 : bikeClass === 'moto2' ? 0.92 : 1.0;

  // Ground contact shadow
  const shadowGeo = new THREE.PlaneGeometry(1.55, 2.85);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowMap,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.position.y = 0.02;
  root.add(shadowMesh);

  const leanGroup = new THREE.Group();
  leanGroup.scale.set(bodyWidthScale, 1, 1);
  root.add(leanGroup);

  const liveryTextures = getBikeLiveryTextures(livery);
  const riderTextures = getRiderSuitTextures(livery);

  const fairingMat = new THREE.MeshPhysicalMaterial({
    color: livery.primaryHex,
    roughness: 0.15,
    metalness: 0.3,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
  });
  const sideLiveryMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: liveryTextures.sideMap,
    roughness: 0.16,
    metalness: 0.24,
    clearcoat: 0.95,
    clearcoatRoughness: 0.08,
  });
  const nosePlateMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: liveryTextures.noseMap,
    roughness: 0.18,
    metalness: 0.22,
    clearcoat: 0.9,
  });
  const tankLiveryMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: liveryTextures.tankMap,
    roughness: 0.18,
    metalness: 0.24,
    clearcoat: 0.95,
  });
  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x161b24,
    roughness: 0.52,
    metalness: 0.22,
  });
  const secondaryFairingMat = new THREE.MeshStandardMaterial({
    color: livery.secondaryHex,
    roughness: 0.44,
    metalness: 0.2,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: livery.accentHex,
    roughness: 0.24,
    metalness: 0.38,
  });
  const alloyMat = new THREE.MeshStandardMaterial({
    color: 0xd1d5db,
    roughness: 0.22,
    metalness: 0.92,
  });
  const darkAlloyMat = new THREE.MeshStandardMaterial({
    color: 0x2a3444,
    roughness: 0.32,
    metalness: 0.86,
  });
  const titaniumMat = new THREE.MeshStandardMaterial({
    color: 0xa8b4c4,
    roughness: 0.18,
    metalness: 0.94,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.22,
    metalness: 0.9,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x151519,
    roughness: 0.88,
    metalness: 0.04,
  });
  const windscreenMat = new THREE.MeshPhysicalMaterial({
    color: 0x0a0f1a,
    roughness: 0.06,
    metalness: 0.22,
    transparent: true,
    opacity: isSoftwareGl ? 0.55 : 0.65,
    clearcoat: 1.0,
  });
  const clearVisorMat = new THREE.MeshPhysicalMaterial({
    color: 0xdbeafe,
    roughness: 0.06,
    metalness: 0.1,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    clearcoat: 1.0,
  });
  const drlLedMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    emissive: 0xe0f2fe,
    emissiveIntensity: 1.4,
    roughness: 0.15,
  });
  const tailLedMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 1.6,
    roughness: 0.2,
  });

  // 1. Rear Wheel, Brake Disc, Swingarm, Sprocket & Drive Chain
  const rearWheel = createRealisticWheel(
    0.275,
    0.095,
    tireMat,
    darkAlloyMat,
    titaniumMat,
    goldMat,
    accentMat,
    false,
  );
  rearWheel.position.set(0, 0.35, -0.78);
  leanGroup.add(rearWheel);

  const sprocketGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.016, 18);
  sprocketGeo.rotateZ(Math.PI / 2);
  const sprocket = new THREE.Mesh(sprocketGeo, goldMat);
  sprocket.position.set(0.105, 0.35, -0.78);
  leanGroup.add(sprocket);

  const chainGeo = new THREE.BoxGeometry(0.014, 0.028, 0.72);
  const chainUpper = new THREE.Mesh(chainGeo, darkAlloyMat);
  chainUpper.position.set(0.105, 0.43, -0.44);
  chainUpper.rotation.x = 0.05;
  const chainLower = new THREE.Mesh(chainGeo, darkAlloyMat);
  chainLower.position.set(0.105, 0.27, -0.44);
  chainLower.rotation.x = -0.05;
  leanGroup.add(chainUpper, chainLower);

  const swingBeamGeo = new THREE.BoxGeometry(0.052, 0.115, 0.74);
  const swingL = new THREE.Mesh(swingBeamGeo, alloyMat);
  swingL.position.set(0.132, 0.36, -0.46);
  const swingR = new THREE.Mesh(swingBeamGeo, alloyMat);
  swingR.position.set(-0.132, 0.36, -0.46);
  leanGroup.add(swingL, swingR);

  const huggerGeo = new THREE.CylinderGeometry(0.325, 0.325, 0.2, 16, 1, true, -0.42, 1.48);
  huggerGeo.rotateZ(Math.PI / 2);
  const hugger = new THREE.Mesh(huggerGeo, carbonMat);
  hugger.position.set(0, 0.35, -0.78);
  leanGroup.add(hugger);

  const shockGeo = new THREE.CylinderGeometry(0.036, 0.036, 0.24, 10);
  const shock = new THREE.Mesh(shockGeo, goldMat);
  shock.position.set(0, 0.56, -0.38);
  shock.rotation.x = 0.52;
  leanGroup.add(shock);

  // Rearset footpegs for rider boots
  const pegGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.085, 8);
  pegGeo.rotateZ(Math.PI / 2);
  const pegL = new THREE.Mesh(pegGeo, titaniumMat);
  pegL.position.set(0.21, 0.45, -0.26);
  const pegR = new THREE.Mesh(pegGeo, titaniumMat);
  pegR.position.set(-0.21, 0.45, -0.26);
  const shiftLever = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.016, 0.11), alloyMat);
  shiftLever.position.set(0.19, 0.42, -0.2);
  leanGroup.add(pegL, pegR, shiftLever);

  // 2. Engine & Perimeter Twin-Spar Aluminum Frame
  const engineGeo = new THREE.BoxGeometry(0.34, 0.35, 0.5);
  const engine = new THREE.Mesh(engineGeo, darkAlloyMat);
  engine.position.set(0, 0.44, -0.02);
  engine.castShadow = true;
  leanGroup.add(engine);

  const sparGeo = new THREE.BoxGeometry(0.046, 0.1, 0.78);
  const sparL = new THREE.Mesh(sparGeo, alloyMat);
  sparL.position.set(0.165, 0.67, 0.08);
  sparL.rotation.x = -0.25;
  const sparR = new THREE.Mesh(sparGeo, alloyMat);
  sparR.position.set(-0.165, 0.67, 0.08);
  sparR.rotation.x = -0.25;
  leanGroup.add(sparL, sparR);

  const radiatorGeo = new THREE.BoxGeometry(0.28, 0.26, 0.06);
  const radiator = new THREE.Mesh(radiatorGeo, titaniumMat);
  radiator.position.set(0, 0.48, 0.39);
  radiator.rotation.x = -0.35;
  leanGroup.add(radiator);

  // 3. Sculpted Factory Aero Fairing, Side Livery Decal Panels, Tank, and Tapered Tail
  const frontFairingShape = new THREE.Shape();
  frontFairingShape.moveTo(-0.34, 0.24);
  frontFairingShape.lineTo(0.42, 0.24);
  frontFairingShape.quadraticCurveTo(0.92, 0.48, 0.87, 0.79);
  frontFairingShape.lineTo(0.42, 0.94);
  frontFairingShape.quadraticCurveTo(0.08, 0.92, -0.22, 0.78);
  frontFairingShape.lineTo(-0.46, 0.68);
  frontFairingShape.lineTo(-0.34, 0.24);

  const fairingGeo = new THREE.ExtrudeGeometry(frontFairingShape, {
    depth: 0.2,
    bevelEnabled: true,
    bevelThickness: 0.058,
    bevelSize: 0.046,
    bevelSegments: 4,
  });
  fairingGeo.translate(0, 0, -0.1);
  fairingGeo.rotateY(-Math.PI / 2);
  fairingGeo.computeVertexNormals();
  const fairing = new THREE.Mesh(fairingGeo, fairingMat);
  fairing.castShadow = true;
  leanGroup.add(fairing);

  const sidePanelGeo = new THREE.PlaneGeometry(0.68, 0.34);
  const sidePanelL = new THREE.Mesh(sidePanelGeo, sideLiveryMat);
  sidePanelL.position.set(0.163, 0.54, 0.29);
  sidePanelL.rotation.y = Math.PI / 2;
  const sidePanelR = new THREE.Mesh(sidePanelGeo, sideLiveryMat);
  sidePanelR.position.set(-0.163, 0.54, 0.29);
  sidePanelR.rotation.y = -Math.PI / 2;
  leanGroup.add(sidePanelL, sidePanelR);

  const tankGeo = new THREE.SphereGeometry(0.242, 18, 14);
  tankGeo.scale(0.84, 0.65, 1.46);
  const tank = new THREE.Mesh(tankGeo, tankLiveryMat);
  tank.position.set(0, 0.84, 0.14);
  tank.rotation.x = -0.14;
  tank.castShadow = true;
  leanGroup.add(tank);

  const seatGeo = new THREE.BoxGeometry(0.21, 0.07, 0.42);
  const seat = new THREE.Mesh(seatGeo, carbonMat);
  seat.position.set(0, 0.75, -0.34);
  seat.rotation.x = -0.1;
  leanGroup.add(seat);

  const tailConeGeo = new THREE.ConeGeometry(0.148, 0.64, 6);
  tailConeGeo.scale(0.95, 1.0, 0.52);
  tailConeGeo.rotateX(-Math.PI / 2 + 0.34);
  const tailCone = new THREE.Mesh(tailConeGeo, fairingMat);
  tailCone.position.set(0, 0.84, -0.66);
  tailCone.castShadow = true;
  leanGroup.add(tailCone);

  const tailAccentGeo = new THREE.BoxGeometry(0.095, 0.03, 0.34);
  const tailAccent = new THREE.Mesh(tailAccentGeo, accentMat);
  tailAccent.position.set(0, 0.895, -0.65);
  tailAccent.rotation.x = 0.34;
  leanGroup.add(tailAccent);

  const tailSubGeo = new THREE.BoxGeometry(0.14, 0.07, 0.46);
  const tailSub = new THREE.Mesh(tailSubGeo, carbonMat);
  tailSub.position.set(0, 0.76, -0.62);
  tailSub.rotation.x = -0.32;
  leanGroup.add(tailSub);

  const bellyGeo = new THREE.BoxGeometry(0.28, 0.15, 0.72);
  const belly = new THREE.Mesh(bellyGeo, carbonMat);
  belly.position.set(0, 0.275, 0.04);
  leanGroup.add(belly);

  const ramAirGeo = new THREE.BoxGeometry(0.16, 0.085, 0.11);
  const ramAir = new THREE.Mesh(ramAirGeo, carbonMat);
  ramAir.position.set(0, 0.725, 0.855);
  leanGroup.add(ramAir);

  const drlGeo = new THREE.BoxGeometry(0.075, 0.022, 0.03);
  const drlL = new THREE.Mesh(drlGeo, drlLedMat);
  drlL.position.set(0.125, 0.785, 0.79);
  drlL.rotation.set(-0.35, 0.25, -0.22);
  const drlR = new THREE.Mesh(drlGeo, drlLedMat);
  drlR.position.set(-0.125, 0.785, 0.79);
  drlR.rotation.set(-0.35, -0.25, 0.22);
  leanGroup.add(drlL, drlR);

  const numberPlateGeo = new THREE.PlaneGeometry(0.22, 0.2);
  const numberPlate = new THREE.Mesh(numberPlateGeo, nosePlateMat);
  numberPlate.position.set(0, 0.848, 0.758);
  numberPlate.rotation.x = -0.78;
  leanGroup.add(numberPlate);

  if (bikeClass === 'motogp' || bikeClass === 'moto2') {
    const mainWingGeo = new THREE.BoxGeometry(0.66, 0.024, 0.155);
    const mainWing = new THREE.Mesh(mainWingGeo, carbonMat);
    mainWing.position.set(0, 0.71, 0.62);
    mainWing.rotation.x = 0.16;
    leanGroup.add(mainWing);

    const endplateGeo = new THREE.BoxGeometry(0.02, 0.08, 0.16);
    const endL = new THREE.Mesh(endplateGeo, accentMat);
    endL.position.set(0.325, 0.725, 0.62);
    const endR = new THREE.Mesh(endplateGeo, accentMat);
    endR.position.set(-0.325, 0.725, 0.62);
    leanGroup.add(endL, endR);

    if (bikeClass === 'motogp') {
      const upperWingGeo = new THREE.BoxGeometry(0.54, 0.02, 0.11);
      const upperWing = new THREE.Mesh(upperWingGeo, accentMat);
      upperWing.position.set(0, 0.8, 0.56);
      upperWing.rotation.x = 0.14;
      leanGroup.add(upperWing);
    }
  }

  const rainLightGeo = new THREE.BoxGeometry(0.055, 0.036, 0.03);
  const rainLight = new THREE.Mesh(rainLightGeo, tailLedMat);
  rainLight.position.set(0, 0.89, -0.94);
  leanGroup.add(rainLight);

  const screenGeo = new THREE.SphereGeometry(0.21, 16, 12, 0, Math.PI, 0, Math.PI * 0.58);
  screenGeo.scale(0.82, 0.74, 1.45);
  const windscreen = new THREE.Mesh(screenGeo, windscreenMat);
  windscreen.position.set(0, 0.93, 0.45);
  windscreen.rotation.x = -0.38;
  leanGroup.add(windscreen);

  const dashGeo = new THREE.BoxGeometry(0.12, 0.065, 0.028);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const dash = new THREE.Mesh(dashGeo, dashMat);
  dash.position.set(0, 0.91, 0.44);
  dash.rotation.x = -0.45;
  leanGroup.add(dash);

  // 4. Exhaust & KERS Flame
  const exhaustCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.13, 0.29, 0.16),
    new THREE.Vector3(0.17, 0.31, -0.34),
    new THREE.Vector3(0.18, 0.49, -0.76),
  ]);
  const exhaustGeo = new THREE.TubeGeometry(exhaustCurve, 14, 0.035, 10, false);
  const exhaustPipe = new THREE.Mesh(exhaustGeo, titaniumMat);
  leanGroup.add(exhaustPipe);

  const mufflerGeo = new THREE.CylinderGeometry(0.052, 0.04, 0.27, 14);
  mufflerGeo.rotateX(Math.PI / 2 - 0.32);
  const muffler = new THREE.Mesh(mufflerGeo, carbonMat);
  muffler.position.set(0.18, 0.52, -0.82);
  leanGroup.add(muffler);

  const tipGeo = new THREE.CylinderGeometry(0.044, 0.046, 0.06, 12);
  tipGeo.rotateX(Math.PI / 2 - 0.32);
  const tip = new THREE.Mesh(tipGeo, titaniumMat);
  tip.position.set(0.18, 0.56, -0.95);
  leanGroup.add(tip);

  if (bikeClass === 'motogp') {
    const tailCanGeo = new THREE.CylinderGeometry(0.036, 0.03, 0.2, 12);
    tailCanGeo.rotateX(Math.PI / 2 - 0.22);
    const tailCan = new THREE.Mesh(tailCanGeo, titaniumMat);
    tailCan.position.set(-0.08, 0.8, -0.88);
    leanGroup.add(tailCan);
  }

  const flameGeo = new THREE.ConeGeometry(0.05, 0.42, 8);
  flameGeo.rotateX(-Math.PI / 2);
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.9,
  });
  const exhaustFlame = new THREE.Mesh(flameGeo, flameMat);
  exhaustFlame.position.set(0.18, 0.57, -1.1);
  exhaustFlame.visible = false;
  leanGroup.add(exhaustFlame);

  // 5. Front Forks, Swept Clip-ons, Rubber Grips, Brake/Clutch Levers, Lever Guards & Front Wheel
  const frontForkGroup = new THREE.Group();
  frontForkGroup.position.set(0, 0.82, 0.56);
  leanGroup.add(frontForkGroup);

  const forkLegGeo = new THREE.CylinderGeometry(0.028, 0.024, 0.6, 10);
  const leftFork = new THREE.Mesh(forkLegGeo, goldMat);
  leftFork.position.set(0.105, -0.24, 0.12);
  leftFork.rotation.x = -0.36;
  const rightFork = new THREE.Mesh(forkLegGeo, goldMat);
  rightFork.position.set(-0.105, -0.24, 0.12);
  rightFork.rotation.x = -0.36;
  frontForkGroup.add(leftFork, rightFork);

  const tripleGeo = new THREE.BoxGeometry(0.25, 0.04, 0.1);
  const tripleClamp = new THREE.Mesh(tripleGeo, darkAlloyMat);
  tripleClamp.position.set(0, 0.02, 0.02);
  frontForkGroup.add(tripleClamp);

  const clipOnGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.24, 8);
  clipOnGeo.rotateZ(Math.PI / 2);
  const gripGeo = new THREE.CylinderGeometry(0.021, 0.021, 0.115, 10);
  gripGeo.rotateZ(Math.PI / 2);
  const leverGeo = new THREE.BoxGeometry(0.095, 0.012, 0.014);

  const barL = new THREE.Mesh(clipOnGeo, carbonMat);
  barL.position.set(0.185, 0.03, -0.045);
  barL.rotation.y = 0.24;
  const gripL = new THREE.Mesh(gripGeo, tireMat);
  gripL.position.set(0.038, 0, 0);
  const clutchLever = new THREE.Mesh(leverGeo, alloyMat);
  clutchLever.position.set(0.035, 0.002, 0.04);
  clutchLever.rotation.y = -0.14;
  barL.add(gripL, clutchLever);

  const barR = new THREE.Mesh(clipOnGeo, carbonMat);
  barR.position.set(-0.185, 0.03, -0.045);
  barR.rotation.y = -0.24;
  const gripR = new THREE.Mesh(gripGeo, tireMat);
  gripR.position.set(-0.038, 0, 0);
  const brakeLever = new THREE.Mesh(leverGeo, alloyMat);
  brakeLever.position.set(-0.035, 0.002, 0.04);
  brakeLever.rotation.y = 0.14;
  barR.add(gripR, brakeLever);

  frontForkGroup.add(barL, barR);

  // Exact grip anchor coordinates inside frontForkGroup for hand IK lock
  const leftGripAnchor = new THREE.Vector3(
    0.185 + 0.038 * Math.cos(0.24),
    0.045,
    -0.045 - 0.038 * Math.sin(0.24),
  );
  const rightGripAnchor = new THREE.Vector3(
    -0.185 - 0.038 * Math.cos(0.24),
    0.045,
    -0.045 - 0.038 * Math.sin(0.24),
  );

  // Lever guards on clip-on bar ends
  const guardGeo = new THREE.BoxGeometry(0.02, 0.018, 0.09);
  const guardL = new THREE.Mesh(guardGeo, accentMat);
  guardL.position.set(0.305, 0.03, -0.04);
  const guardR = new THREE.Mesh(guardGeo, accentMat);
  guardR.position.set(-0.305, 0.03, -0.04);
  frontForkGroup.add(guardL, guardR);

  const fenderGeo = new THREE.CylinderGeometry(0.305, 0.305, 0.145, 14, 1, true, -0.6, 1.35);
  fenderGeo.rotateZ(Math.PI / 2);
  const fender = new THREE.Mesh(fenderGeo, fairingMat);
  fender.position.set(0, -0.47, 0.23);
  frontForkGroup.add(fender);

  const frontWheel = createRealisticWheel(
    0.268,
    0.075,
    tireMat,
    darkAlloyMat,
    titaniumMat,
    goldMat,
    accentMat,
    true,
  );
  frontWheel.position.set(0, -0.47, 0.23);
  frontForkGroup.add(frontWheel);

  // 6. Detailed Anatomical Articulated MotoGP Rider
  const riderGroup = new THREE.Group();
  riderGroup.name = 'riderGroup';
  riderGroup.position.set(0, 0.79, -0.19);
  leanGroup.add(riderGroup);

  const suitMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: riderTextures.suitMap,
    roughness: 0.44,
    metalness: 0.08,
  });
  const helmetShellMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: riderTextures.helmetMap,
    roughness: 0.14,
    metalness: 0.26,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
  });
  const solidSuitMat = new THREE.MeshStandardMaterial({
    color: livery.primaryHex,
    roughness: 0.46,
    metalness: 0.1,
  });
  const leatherMat = new THREE.MeshStandardMaterial({
    color: livery.secondaryHex,
    roughness: 0.58,
    metalness: 0.06,
  });
  const balaclavaMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.85,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: getRiderFaceStyle(livery).skinHex,
    roughness: 0.72,
  });
  const bootMat = new THREE.MeshStandardMaterial({
    color: 0x11151d,
    roughness: 0.42,
    metalness: 0.2,
  });
  const sliderMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.32,
  });

  // Pelvis / Hip Seat Base
  const pelvisGeo = new THREE.CapsuleGeometry(0.105, 0.13, 6, 10);
  pelvisGeo.rotateZ(Math.PI / 2);
  const pelvis = new THREE.Mesh(pelvisGeo, leatherMat);
  pelvis.name = 'pelvis';
  pelvis.position.set(0, 0.04, -0.02);
  riderGroup.add(pelvis);

  // Body / Torso Pivot
  const torsoPivot = new THREE.Group();
  torsoPivot.name = 'bodyTorso';
  torsoPivot.position.set(0, 0.08, 0.0);
  riderGroup.add(torsoPivot);

  const waistGeo = new THREE.CapsuleGeometry(0.11, 0.16, 6, 12);
  const waist = new THREE.Mesh(waistGeo, leatherMat);
  waist.name = 'waist';
  waist.position.set(0, 0.15, 0.02);
  waist.scale.set(1.06, 1.0, 0.82);
  waist.rotation.x = 0.25;
  torsoPivot.add(waist);

  const chestGeo = new THREE.CapsuleGeometry(0.142, 0.25, 8, 14);
  const chest = new THREE.Mesh(chestGeo, suitMat);
  chest.name = 'bodyChest';
  chest.position.set(0, 0.33, 0.07);
  chest.scale.set(1.16, 1.0, 0.82);
  chest.rotation.x = 0.25;
  chest.castShadow = true;
  torsoPivot.add(chest);

  const shoulderGeo = new THREE.SphereGeometry(0.072, 12, 10);
  shoulderGeo.scale(1.0, 0.82, 1.08);
  const shoulderL = new THREE.Mesh(shoulderGeo, carbonMat);
  shoulderL.position.set(0.185, 0.43, 0.07);
  const shoulderR = new THREE.Mesh(shoulderGeo, carbonMat);
  shoulderR.position.set(-0.185, 0.43, 0.07);
  torsoPivot.add(shoulderL, shoulderR);

  const humpGeo = new THREE.CapsuleGeometry(0.066, 0.19, 6, 10);
  const hump = new THREE.Mesh(humpGeo, solidSuitMat);
  hump.position.set(0, 0.38, -0.072);
  hump.rotation.x = 0.28;
  torsoPivot.add(hump);

  const humpFin = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.18, 0.03), accentMat);
  humpFin.position.set(0, 0.39, -0.12);
  humpFin.rotation.x = 0.28;
  torsoPivot.add(humpFin);

  const spineGeo = new THREE.BoxGeometry(0.055, 0.22, 0.036);
  const spine = new THREE.Mesh(spineGeo, secondaryFairingMat);
  spine.position.set(0, 0.21, -0.075);
  spine.rotation.x = 0.24;
  torsoPivot.add(spine);

  // Detailed Head / Ears / Eyes / Nose / Mouth / Open-Face Aero Helmet
  const { headPivot, visorPivot } = buildDetailedHeadAndHelmet(
    livery,
    solidSuitMat,
    helmetShellMat,
    balaclavaMat,
    skinMat,
    clearVisorMat,
  );
  headPivot.position.set(0, 0.48, 0.11);
  torsoPivot.add(headPivot);

  // Articulated 2-Bone IK Arms + 5-Fingered Hands Holding Handlebars
  const leftArm = buildArticulatedArm(1, solidSuitMat, leatherMat, bootMat, accentMat, sliderMat);
  const rightArm = buildArticulatedArm(-1, solidSuitMat, leatherMat, bootMat, accentMat, sliderMat);
  torsoPivot.add(leftArm.armPivot, rightArm.armPivot);

  // Articulated Legs + Knee Pivot + Articulated Foot / Racing Boot Pivot
  const leftLeg = buildArticulatedLeg(1, solidSuitMat, leatherMat, bootMat, accentMat, sliderMat);
  const rightLeg = buildArticulatedLeg(-1, solidSuitMat, leatherMat, bootMat, accentMat, sliderMat);
  riderGroup.add(leftLeg.legPivot, rightLeg.legPivot);

  torsoPivot.rotation.x = 0.72;

  const animState: RiderAnimState = {
    hipX: 0,
    hipY: 0.79,
    hipZ: -0.19,
    riderPitch: 0,
    riderYaw: 0,
    riderRoll: 0,
    torsoX: 0.72,
    torsoY: 0,
    torsoZ: 0,
    headX: -0.35,
    headY: 0,
    headZ: 0,
    leftLegX: 0,
    leftLegY: 0,
    leftLegZ: 0,
    rightLegX: 0,
    rightLegY: 0,
    rightLegZ: 0,
    leftKneeX: 0,
    leftKneeZ: 0,
    rightKneeX: 0,
    rightKneeZ: 0,
    leftFootX: 0,
    leftFootY: 0,
    leftFootZ: 0,
    rightFootX: 0,
    rightFootY: 0,
    rightFootZ: 0,
    lastGear: 1,
    shiftAnimTimer: 0,
    shiftDirection: 1,
    initialized: false,
  };

  const dispose = () => {
    root.traverse((obj) => {
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

  return {
    root,
    leanGroup,
    frontForkGroup,
    leftGripAnchor,
    rightGripAnchor,
    frontWheel,
    rearWheel,
    riderGroup,
    riderJoints: {
      torsoPivot,
      headPivot,
      visorPivot,
      leftArmPivot: leftArm.armPivot,
      rightArmPivot: rightArm.armPivot,
      leftArm,
      rightArm,
      leftLegPivot: leftLeg.legPivot,
      rightLegPivot: rightLeg.legPivot,
      leftLeg,
      rightLeg,
    },
    animState,
    exhaustFlame,
    dispose,
  };
}

function damp(current: number, target: number, rate: number, dt: number): number {
  const alpha = 1 - Math.exp(-rate * Math.max(0.001, dt));
  return current + (target - current) * alpha;
}

export function animateBikeRiderPose(
  rig: BikeVisualRig,
  params: {
    speed: number;
    leanAngle: number;
    steerVisual?: number;
    gear?: number;
    brake: number;
    isBoosting: boolean;
    crashed: boolean;
    crashType?: 'lowside' | 'highside' | null;
    crashAge?: number;
    crashDirSign?: 1 | -1;
    riderCrashPos?: { x: number; y: number; z: number };
    riderCrashSpin?: { x: number; y: number; z: number };
    preRaceIdle: boolean;
    timeSec: number;
    riderSeed: number;
    dt?: number;
  },
): void {
  const {
    torsoPivot,
    headPivot,
    visorPivot,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
  } = rig.riderJoints;
  const st = rig.animState;
  const dt = params.dt && params.dt > 0 ? Math.min(0.08, params.dt) : 0.033;
  const currentGear = params.gear ?? st.lastGear;

  if (currentGear !== st.lastGear && !params.crashed && !params.preRaceIdle) {
    st.shiftDirection = currentGear > st.lastGear ? -1 : 1;
    st.shiftAnimTimer = 0.24;
    st.lastGear = currentGear;
  } else if (st.shiftAnimTimer > 0) {
    st.shiftAnimTimer = Math.max(0, st.shiftAnimTimer - dt);
  }

  let tHipX = 0;
  let tHipY = 0.79;
  let tHipZ = -0.19;
  let tRiderPitch = 0;
  let tRiderYaw = 0;
  let tRiderRoll = 0;
  let tTorsoX = 0.68;
  let tTorsoY = 0;
  let tTorsoZ = 0;
  let tHeadX = -0.35;
  let tHeadY = 0;
  let tHeadZ = 0;

  let tLeftLegX = 0;
  let tLeftLegY = 0;
  let tLeftLegZ = 0;
  let tRightLegX = 0;
  let tRightLegY = 0;
  let tRightLegZ = 0;

  let tLeftKneeX = 0;
  let tLeftKneeZ = 0;
  let tRightKneeX = 0;
  let tRightKneeZ = 0;

  let tLeftFootX = 0;
  let tLeftFootY = 0;
  let tLeftFootZ = 0;
  let tRightFootX = 0;
  let tRightFootY = 0;
  let tRightFootZ = 0;
  let dampRate = 11.5;

  if (params.crashed) {
    // Detach rider cleanly into bike root space so rider falls/slides independently of the sliding motorcycle!
    if (rig.riderGroup.parent !== rig.root) {
      rig.root.add(rig.riderGroup);
    }

    const dir = params.crashDirSign ?? (params.leanAngle >= 0 ? 1 : -1);
    const age = params.crashAge ?? 0.2;
    const isHighside = params.crashType === 'highside';
    const rcPos = params.riderCrashPos;
    const rcSpin = params.riderCrashSpin;

    if (isHighside) {
      // Violent high-side airborne ragdoll somersault & bounce limbs
      const ragPhase = age * 9.5 + params.riderSeed;
      const flailA = Math.sin(ragPhase);
      const flailB = Math.cos(ragPhase * 1.37);
      const airborne = (rcPos?.y ?? 0.5) > 0.36;
      const settle = Math.min(1, age / 1.85);

      tHipX = rcPos ? rcPos.x : dir * 0.6;
      tHipY = rcPos ? rcPos.y : 0.45;
      tHipZ = rcPos ? rcPos.z : 0.85;
      tRiderPitch = (rcSpin ? rcSpin.x : 6.2) * Math.min(1.4, age) + Math.PI * 0.48 * settle;
      tRiderYaw = (rcSpin ? rcSpin.y : dir * 3.0) * Math.min(1.2, age);
      tRiderRoll = (rcSpin ? rcSpin.z : -dir * 4.5) * Math.min(1.3, age);

      tTorsoX = 0.28 + flailA * (airborne ? 0.52 : 0.16);
      tTorsoY = flailB * (airborne ? 0.34 : 0.12);
      tTorsoZ = flailB * (airborne ? 0.42 : 0.15);
      tHeadX = -0.3 + flailB * 0.48;
      tHeadY = flailA * 0.46;
      tHeadZ = flailB * 0.28;

      tLeftLegX = -0.45 + flailA * (airborne ? 0.72 : 0.22);
      tLeftLegY = 0.22 + flailB * 0.25;
      tLeftLegZ = 0.36 + flailA * 0.24;
      tRightLegX = -0.35 - flailB * (airborne ? 0.68 : 0.24);
      tRightLegY = -0.22 - flailA * 0.25;
      tRightLegZ = -0.36 - flailB * 0.24;

      tLeftKneeX = -0.48 - Math.abs(flailA) * 0.62;
      tRightKneeX = -0.42 - Math.abs(flailB) * 0.65;
      tLeftFootX = 0.48 * flailB;
      tRightFootX = -0.48 * flailA;
      dampRate = 24.0;
    } else {
      // Low-side tarmac slide: rider drops onto inside hip/shoulder beside bike and curls/braces smoothly
      const skidOsc = Math.sin(age * 6.5 + params.riderSeed);
      tHipX = rcPos ? rcPos.x : -dir * 0.85;
      tHipY = rcPos ? rcPos.y : 0.24;
      tHipZ = rcPos ? rcPos.z : -0.42;
      tRiderPitch = 1.18 + Math.min(0.35, age * 0.3);
      tRiderYaw = dir * (0.45 + Math.min(0.65, age * 0.5));
      tRiderRoll = dir * 1.48;

      tTorsoX = 0.42 + skidOsc * 0.08;
      tTorsoY = dir * 0.25;
      tTorsoZ = -dir * 0.22;
      tHeadX = -0.28 + skidOsc * 0.14;
      tHeadY = -dir * 0.35;
      tHeadZ = -dir * 0.18;

      // Tuck legs into slide posture
      tLeftLegX = 0.28 + skidOsc * 0.12;
      tLeftLegZ = 0.24;
      tRightLegX = -0.18 - skidOsc * 0.12;
      tRightLegZ = -0.24;
      tLeftKneeX = -0.52;
      tRightKneeX = -0.44;
      tLeftFootX = 0.28;
      tRightFootX = -0.22;
      dampRate = 20.0;
    }
  } else {
    if (rig.riderGroup.parent !== rig.leanGroup) {
      rig.leanGroup.add(rig.riderGroup);
    }

    if (params.preRaceIdle) {
      const breath = Math.sin(params.timeSec * 2.2 + params.riderSeed) * 0.025;
      const glance = Math.sin(params.timeSec * 1.1 + params.riderSeed * 2.1) * 0.26;
      const footTap = Math.sin(params.timeSec * 3.8 + params.riderSeed) * 0.07;
      tTorsoX = 0.54 + breath;
      tHeadX = -0.32;
      tHeadY = glance;
      // Left foot planted down stabilizing motorcycle on starting grid; right foot resting on rearset peg
      tLeftLegX = 0.28;
      tLeftLegZ = 0.22;
      tLeftKneeX = -0.26;
      tLeftFootX = -0.06;
      tLeftFootY = 0.12;
      tRightLegZ = -0.06;
      tRightFootX = footTap;
      dampRate = 8.5;
    } else {
      const speedTuck = Math.min(1, Math.max(0, (params.speed - 18) / 48)) + (params.isBoosting ? 0.14 : 0);
      const brakeLift = Math.min(1, Math.max(0, params.brake)) * 0.34;
      const leanNorm = Math.max(-1, Math.min(1, params.leanAngle / 0.85));
      const absLean = Math.abs(leanNorm);
      const microShift = Math.sin(params.timeSec * 3.1 + params.riderSeed) * 0.012;

      tHipX = -Math.sin(params.leanAngle) * 0.22;
      tHipY = 0.79 - absLean * 0.045;
      tHipZ = -0.19;
      tRiderRoll = params.leanAngle * 0.24;

      tTorsoX = Math.max(0.42, Math.min(1.12, 0.68 + speedTuck * 0.34 - brakeLift - absLean * 0.1 + microShift));
      tTorsoY = -leanNorm * 0.18;
      tTorsoZ = leanNorm * 0.26;

      tHeadX = -tTorsoX * 0.64 + 0.05;
      tHeadY = -leanNorm * 0.42;
      tHeadZ = -leanNorm * 0.32;

      const rightInside = Math.max(0, leanNorm);
      const leftInside = Math.max(0, -leanNorm);
      const dangleRight = params.brake > 0.32 && rightInside > 0.08 ? params.brake * 0.34 : 0;
      const dangleLeft = params.brake > 0.32 && leftInside > 0.08 ? params.brake * 0.34 : 0;

      tRightLegX = dangleRight * 0.56;
      tRightLegY = -rightInside * 0.42;
      tRightLegZ = -rightInside * 0.46 - dangleRight * 0.24;
      tRightKneeX = -dangleRight * 0.42;
      tRightKneeZ = -rightInside * 0.14;

      tLeftLegX = dangleLeft * 0.56;
      tLeftLegY = leftInside * 0.42;
      tLeftLegZ = leftInside * 0.46 + dangleLeft * 0.24;
      tLeftKneeX = -dangleLeft * 0.42;
      tLeftKneeZ = leftInside * 0.14;

      // Realistic Foot Animation: inside ankle pivots & tilts along peg/dangle,
      // outside boot counter-rotates flat onto rearset, gear changes flick left ankle on shifter!
      const shiftWave =
        st.shiftAnimTimer > 0 ? Math.sin((st.shiftAnimTimer / 0.24) * Math.PI) * 0.36 * st.shiftDirection : 0;
      const rearBrakeToe = params.brake > 0.12 ? -params.brake * 0.22 : 0;
      const roadBuzz = Math.sin(params.timeSec * 14 + params.riderSeed) * Math.min(1, params.speed / 65) * 0.02;

      tLeftFootX = shiftWave + dangleLeft * 0.48 + roadBuzz;
      tLeftFootY = leftInside * 0.32;
      tLeftFootZ = leftInside * 0.18 - rightInside * 0.12;

      tRightFootX = rearBrakeToe + dangleRight * 0.48 - roadBuzz;
      tRightFootY = -rightInside * 0.32;
      tRightFootZ = -rightInside * 0.18 + leftInside * 0.12;
    }
  }

  if (!st.initialized) {
    st.hipX = tHipX;
    st.hipY = tHipY;
    st.hipZ = tHipZ;
    st.riderPitch = tRiderPitch;
    st.riderYaw = tRiderYaw;
    st.riderRoll = tRiderRoll;
    st.torsoX = tTorsoX;
    st.torsoY = tTorsoY;
    st.torsoZ = tTorsoZ;
    st.headX = tHeadX;
    st.headY = tHeadY;
    st.headZ = tHeadZ;
    st.leftLegX = tLeftLegX;
    st.leftLegY = tLeftLegY;
    st.leftLegZ = tLeftLegZ;
    st.rightLegX = tRightLegX;
    st.rightLegY = tRightLegY;
    st.rightLegZ = tRightLegZ;
    st.leftKneeX = tLeftKneeX;
    st.leftKneeZ = tLeftKneeZ;
    st.rightKneeX = tRightKneeX;
    st.rightKneeZ = tRightKneeZ;
    st.leftFootX = tLeftFootX;
    st.leftFootY = tLeftFootY;
    st.leftFootZ = tLeftFootZ;
    st.rightFootX = tRightFootX;
    st.rightFootY = tRightFootY;
    st.rightFootZ = tRightFootZ;
    st.initialized = true;
  } else {
    // During crashed fall/ragdoll, drive position strictly from physical crash projectile coordinates
    st.hipX = params.crashed ? tHipX : damp(st.hipX, tHipX, dampRate, dt);
    st.hipY = params.crashed ? tHipY : damp(st.hipY, tHipY, dampRate, dt);
    st.hipZ = params.crashed ? tHipZ : damp(st.hipZ, tHipZ, dampRate, dt);
    st.riderPitch = damp(st.riderPitch, tRiderPitch, dampRate, dt);
    st.riderYaw = damp(st.riderYaw, tRiderYaw, dampRate, dt);
    st.riderRoll = damp(st.riderRoll, tRiderRoll, dampRate, dt);
    st.torsoX = damp(st.torsoX, tTorsoX, dampRate, dt);
    st.torsoY = damp(st.torsoY, tTorsoY, dampRate, dt);
    st.torsoZ = damp(st.torsoZ, tTorsoZ, dampRate, dt);
    st.headX = damp(st.headX, tHeadX, dampRate + 2.5, dt);
    st.headY = damp(st.headY, tHeadY, dampRate + 2.5, dt);
    st.headZ = damp(st.headZ, tHeadZ, dampRate + 2.5, dt);
    st.leftLegX = damp(st.leftLegX, tLeftLegX, dampRate + 1.5, dt);
    st.leftLegY = damp(st.leftLegY, tLeftLegY, dampRate + 1.5, dt);
    st.leftLegZ = damp(st.leftLegZ, tLeftLegZ, dampRate + 1.5, dt);
    st.rightLegX = damp(st.rightLegX, tRightLegX, dampRate + 1.5, dt);
    st.rightLegY = damp(st.rightLegY, tRightLegY, dampRate + 1.5, dt);
    st.rightLegZ = damp(st.rightLegZ, tRightLegZ, dampRate + 1.5, dt);
    st.leftKneeX = damp(st.leftKneeX, tLeftKneeX, dampRate + 2.5, dt);
    st.leftKneeZ = damp(st.leftKneeZ, tLeftKneeZ, dampRate + 2.5, dt);
    st.rightKneeX = damp(st.rightKneeX, tRightKneeX, dampRate + 2.5, dt);
    st.rightKneeZ = damp(st.rightKneeZ, tRightKneeZ, dampRate + 2.5, dt);
    st.leftFootX = damp(st.leftFootX, tLeftFootX, 18.0, dt);
    st.leftFootY = damp(st.leftFootY, tLeftFootY, 14.0, dt);
    st.leftFootZ = damp(st.leftFootZ, tLeftFootZ, 14.0, dt);
    st.rightFootX = damp(st.rightFootX, tRightFootX, 18.0, dt);
    st.rightFootY = damp(st.rightFootY, tRightFootY, 14.0, dt);
    st.rightFootZ = damp(st.rightFootZ, tRightFootZ, 14.0, dt);
  }

  rig.riderGroup.position.set(st.hipX, st.hipY, st.hipZ);
  rig.riderGroup.rotation.set(st.riderPitch, st.riderYaw, st.riderRoll);
  torsoPivot.rotation.set(st.torsoX, st.torsoY, st.torsoZ);
  headPivot.rotation.set(st.headX, st.headY, st.headZ);
  visorPivot.rotation.x = params.preRaceIdle ? -0.44 : -0.18;

  leftLeg.legPivot.rotation.set(st.leftLegX, st.leftLegY, st.leftLegZ);
  leftLeg.kneePivot.rotation.set(st.leftKneeX, 0, st.leftKneeZ);
  leftLeg.footPivot.rotation.set(st.leftFootX, st.leftFootY, st.leftFootZ);

  rightLeg.legPivot.rotation.set(st.rightLegX, st.rightLegY, st.rightLegZ);
  rightLeg.kneePivot.rotation.set(st.rightKneeX, 0, st.rightKneeZ);
  rightLeg.footPivot.rotation.set(st.rightFootX, st.rightFootY, st.rightFootZ);

  // Arms & Hands: When riding or idling on grid, solve exact 2-bone IK onto clip-on grips!
  // On crash, differentiate High-Side splayed airborne ragdoll arms vs Low-Side protective brace!
  if (params.crashed) {
    if (params.crashType === 'highside') {
      const flail = Math.sin((params.crashAge ?? 0) * 10.5 + params.riderSeed);
      const flail2 = Math.cos((params.crashAge ?? 0) * 8.4 + params.riderSeed);
      leftArm.armPivot.rotation.set(-0.95 + flail * 0.85, flail2 * 0.4, 0.88 + flail * 0.45);
      leftArm.elbowPivot.rotation.set(-0.42 - Math.abs(flail2) * 0.55, 0, 0);
      leftArm.wristPivot.rotation.set(flail * 0.35, 0, 0);
      leftArm.gripFingerPivot.rotation.x = -0.75;
      leftArm.brakeFingerPivot.rotation.x = -0.75;

      rightArm.armPivot.rotation.set(-0.85 - flail2 * 0.85, -flail * 0.4, -0.88 - flail2 * 0.45);
      rightArm.elbowPivot.rotation.set(-0.48 - Math.abs(flail) * 0.55, 0, 0);
      rightArm.wristPivot.rotation.set(-flail2 * 0.35, 0, 0);
      rightArm.gripFingerPivot.rotation.x = -0.75;
      rightArm.brakeFingerPivot.rotation.x = -0.75;
    } else {
      // Low-side: arms tuck in defensively across chest/asphalt
      leftArm.armPivot.rotation.set(0.45, 0.25, 0.42);
      leftArm.elbowPivot.rotation.set(-1.15, 0, 0);
      leftArm.wristPivot.rotation.set(0.2, 0, 0);
      leftArm.gripFingerPivot.rotation.x = -0.25;
      leftArm.brakeFingerPivot.rotation.x = -0.25;

      rightArm.armPivot.rotation.set(0.55, -0.25, -0.42);
      rightArm.elbowPivot.rotation.set(-1.15, 0, 0);
      rightArm.wristPivot.rotation.set(0.2, 0, 0);
      rightArm.gripFingerPivot.rotation.x = -0.25;
      rightArm.brakeFingerPivot.rotation.x = -0.25;
    }
  } else {
    const forkYaw = rig.frontForkGroup.rotation.y || -(params.steerVisual ?? 0) * 0.45;
    _qFork.setFromAxisAngle(_vDir.set(0, 1, 0), forkYaw);
    _qRiderInv.setFromEuler(_eulerTmp.set(st.riderPitch, st.riderYaw, st.riderRoll)).invert();
    _qTorsoInv.setFromEuler(_eulerTmp.set(st.torsoX, st.torsoY, st.torsoZ)).invert();

    const applyGripIK = (side: 1 | -1, arm: ArmJoints, gripAnchor: THREE.Vector3) => {
      // Transform handlebar grip anchor: frontForkGroup -> leanGroup -> riderGroup -> torsoPivot
      _vGripFork.copy(gripAnchor).applyQuaternion(_qFork);
      _vGripLean.set(
        _vGripFork.x + rig.frontForkGroup.position.x,
        _vGripFork.y + rig.frontForkGroup.position.y,
        _vGripFork.z + rig.frontForkGroup.position.z,
      );
      _vGripRider
        .set(_vGripLean.x - st.hipX, _vGripLean.y - st.hipY, _vGripLean.z - st.hipZ)
        .applyQuaternion(_qRiderInv);
      _vGripTorso.set(_vGripRider.x, _vGripRider.y - 0.08, _vGripRider.z).applyQuaternion(_qTorsoInv);

      _vShoulder.copy(arm.armPivot.position);
      const solved = solveRiderArmIK(side, _vShoulder, _vGripTorso);
      arm.armPivot.quaternion.copy(solved.armQuaternion);
      arm.elbowPivot.rotation.set(solved.elbowRotationX, 0, 0);

      // Wrap palm & fingers cleanly around bar cylinder
      arm.wristPivot.rotation.set(0.28, side * 0.12, 0);
      arm.gripFingerPivot.rotation.x = 0.42; // tight grip on handlebar
      // Right hand extends index + middle fingers onto brake lever under braking
      const brakeReach = side === -1 && params.brake > 0.14 ? -Math.min(1, params.brake) * 0.62 : 0;
      arm.brakeFingerPivot.rotation.x = 0.42 + brakeReach;
    };

    applyGripIK(1, leftArm, rig.leftGripAnchor);
    applyGripIK(-1, rightArm, rig.rightGripAnchor);
  }
}

export function createStandingRiderMesh(livery: TeamLivery): StandingRiderRig {
  const root = new THREE.Group();
  const riderTextures = getRiderSuitTextures(livery);

  const suitMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: riderTextures.suitMap,
    roughness: 0.44,
    metalness: 0.08,
  });
  const helmetShellMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: riderTextures.helmetMap,
    roughness: 0.14,
    metalness: 0.26,
    clearcoat: 1.0,
  });
  const solidSuitMat = new THREE.MeshStandardMaterial({
    color: livery.primaryHex,
    roughness: 0.46,
    metalness: 0.1,
  });
  const leatherMat = new THREE.MeshStandardMaterial({
    color: livery.secondaryHex,
    roughness: 0.58,
    metalness: 0.06,
  });
  const bootMat = new THREE.MeshStandardMaterial({
    color: 0x11151d,
    roughness: 0.42,
    metalness: 0.2,
  });
  const balaclavaMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.85,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: getRiderFaceStyle(livery).skinHex,
    roughness: 0.72,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: livery.accentHex,
    roughness: 0.28,
    metalness: 0.35,
  });
  const sliderMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.32,
  });
  const clearVisorMat = new THREE.MeshPhysicalMaterial({
    color: 0xdbeafe,
    roughness: 0.06,
    metalness: 0.1,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    clearcoat: 1.0,
  });

  const g = getSharedGeos();

  // Standing Legs + Articulated Feet / Racing Boots
  const buildStandingLeg = (side: 1 | -1) => {
    const leg = new THREE.Group();
    leg.name = side === 1 ? 'leftStandingLeg' : 'rightStandingLeg';
    leg.position.set(side * 0.12, 0.78, 0);

    const thighGeo = new THREE.CapsuleGeometry(0.068, 0.3, 6, 10);
    const thigh = new THREE.Mesh(thighGeo, leatherMat);
    thigh.position.set(0, -0.18, 0);
    leg.add(thigh);

    const sliderGeo = new THREE.BoxGeometry(0.045, 0.085, 0.08);
    const slider = new THREE.Mesh(sliderGeo, accentMat);
    slider.position.set(side * 0.04, -0.35, 0.05);
    leg.add(slider);

    const shinGeo = new THREE.CapsuleGeometry(0.056, 0.28, 6, 10);
    const shin = new THREE.Mesh(shinGeo, suitMat);
    shin.position.set(0, -0.52, 0);
    leg.add(shin);

    const footPivot = new THREE.Group();
    footPivot.name = side === 1 ? 'leftFoot' : 'rightFoot';
    footPivot.position.set(0, -0.71, 0);

    const heel = new THREE.Mesh(g.bootHeel, bootMat);
    heel.position.set(0, -0.015, -0.015);
    const instep = new THREE.Mesh(g.bootInstep, bootMat);
    instep.position.set(0, -0.01, 0.045);
    const sole = new THREE.Mesh(g.bootSole, sliderMat);
    sole.position.set(0, -0.042, 0.045);
    const toe = new THREE.Mesh(g.bootToe, bootMat);
    toe.position.set(0, -0.02, 0.115);
    const toeSld = new THREE.Mesh(g.toeSlider, accentMat);
    toeSld.position.set(side * 0.032, -0.026, 0.118);

    footPivot.add(heel, instep, sole, toe, toeSld);
    leg.add(footPivot);

    return { leg, footPivot };
  };

  const leftStandLeg = buildStandingLeg(1);
  const rightStandLeg = buildStandingLeg(-1);
  root.add(leftStandLeg.leg, rightStandLeg.leg);

  // Pelvis
  const pelvisGeo = new THREE.CapsuleGeometry(0.11, 0.15, 6, 10);
  pelvisGeo.rotateZ(Math.PI / 2);
  const pelvis = new THREE.Mesh(pelvisGeo, leatherMat);
  pelvis.position.set(0, 0.84, 0);
  root.add(pelvis);

  // Upright celebratory Torso
  const torsoPivot = new THREE.Group();
  torsoPivot.name = 'bodyTorso';
  torsoPivot.position.set(0, 0.9, 0);
  root.add(torsoPivot);

  const chestGeo = new THREE.CapsuleGeometry(0.148, 0.34, 8, 14);
  const chest = new THREE.Mesh(chestGeo, suitMat);
  chest.name = 'bodyChest';
  chest.position.set(0, 0.24, 0);
  chest.scale.set(1.16, 1.0, 0.82);
  torsoPivot.add(chest);

  const { headPivot, visorPivot } = buildDetailedHeadAndHelmet(
    livery,
    solidSuitMat,
    helmetShellMat,
    balaclavaMat,
    skinMat,
    clearVisorMat,
  );
  headPivot.position.set(0, 0.48, 0.02);
  visorPivot.rotation.x = -0.46; // Visor raised high on podium so full face/ears/eyes/nose/mouth shine clearly
  torsoPivot.add(headPivot);

  // Articulated Raised Victory Arms with 5-Fingered Hands
  const leftArm = buildArticulatedArm(1, solidSuitMat, leatherMat, bootMat, accentMat, sliderMat, suitMat);
  leftArm.armPivot.position.set(0.22, 0.41, 0);
  const rightArm = buildArticulatedArm(-1, solidSuitMat, leatherMat, bootMat, accentMat, sliderMat, suitMat);
  rightArm.armPivot.position.set(-0.22, 0.41, 0);
  torsoPivot.add(leftArm.armPivot, rightArm.armPivot);

  const dispose = () => {
    root.traverse((obj) => {
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

  return {
    root,
    torsoPivot,
    headPivot,
    leftArmPivot: leftArm.armPivot,
    rightArmPivot: rightArm.armPivot,
    leftArm,
    rightArm,
    leftLegPivot: leftStandLeg.leg,
    rightLegPivot: rightStandLeg.leg,
    leftFootPivot: leftStandLeg.footPivot,
    rightFootPivot: rightStandLeg.footPivot,
    dispose,
  };
}
