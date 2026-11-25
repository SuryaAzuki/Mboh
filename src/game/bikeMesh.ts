import * as THREE from 'three';
import type { BikeClassId, TeamLivery } from './types';

export interface BikeVisualRig {
  root: THREE.Group;
  leanGroup: THREE.Group;
  frontForkGroup: THREE.Group;
  frontWheel: THREE.Group;
  rearWheel: THREE.Group;
  riderGroup: THREE.Group;
  exhaustFlame: THREE.Mesh;
  dispose: () => void;
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

  // Racing slick tire profile
  const tireGeo = new THREE.TorusGeometry(tireRadius, tireTube, 18, 32);
  tireGeo.rotateY(Math.PI / 2);
  const tire = new THREE.Mesh(tireGeo, tireMat);
  tire.castShadow = true;
  wheel.add(tire);

  // Colored rim pinstripe ring
  const rimRingGeo = new THREE.TorusGeometry(tireRadius - tireTube * 0.65, 0.011, 8, 28);
  rimRingGeo.rotateY(Math.PI / 2);
  const rimRingL = new THREE.Mesh(rimRingGeo, accentMat);
  rimRingL.position.x = 0.068;
  const rimRingR = new THREE.Mesh(rimRingGeo, accentMat);
  rimRingR.position.x = -0.068;
  wheel.add(rimRingL, rimRingR);

  // Outer alloy barrel & center hub
  const barrelGeo = new THREE.CylinderGeometry(tireRadius - tireTube * 0.68, tireRadius - tireTube * 0.68, 0.13, 20, 1, true);
  barrelGeo.rotateZ(Math.PI / 2);
  const barrel = new THREE.Mesh(barrelGeo, rimMat);
  wheel.add(barrel);

  const hubGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.16, 12);
  hubGeo.rotateZ(Math.PI / 2);
  const hub = new THREE.Mesh(hubGeo, rimMat);
  wheel.add(hub);

  // 5-spoke Y alloy spokes
  const spokeGeo = new THREE.BoxGeometry(0.025, tireRadius - tireTube * 0.72, 0.024);
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const spoke = new THREE.Mesh(spokeGeo, rimMat);
    spoke.rotation.x = angle;
    spoke.position.set(0, Math.cos(angle) * 0.1, Math.sin(angle) * 0.1);
    wheel.add(spoke);
  }

  // Carbon/Steel Brake Rotors
  const discGeo = new THREE.RingGeometry(0.075, 0.165, 22);
  discGeo.rotateY(Math.PI / 2);
  const discLeft = new THREE.Mesh(discGeo, discMat);
  discLeft.position.x = 0.082;
  wheel.add(discLeft);

  if (dualDisc) {
    const discRight = new THREE.Mesh(discGeo, discMat);
    discRight.position.x = -0.082;
    wheel.add(discRight);
  }

  // Radial Brembo caliper accent (static relative to wheel hub look)
  const calGeo = new THREE.BoxGeometry(0.04, 0.075, 0.06);
  const cal = new THREE.Mesh(calGeo, caliperMat);
  cal.position.set(0.085, 0.06, -0.13);
  wheel.add(cal);

  return wheel;
}

export function createMotoBikeRig(
  livery: TeamLivery,
  shadowMap: THREE.Texture,
  isSoftwareGl: boolean,
  bikeClass: BikeClassId = 'motogp',
): BikeVisualRig {
  const root = new THREE.Group();
  root.rotation.order = 'YXZ';

  // Class visual scaling (Moto3 is slimmer/lighter, MotoGP is muscular with full bi-plane aero)
  const bodyWidthScale = bikeClass === 'moto3' ? 0.78 : bikeClass === 'moto2' ? 0.9 : 1.0;

  // Ground contact shadow directly beneath bike
  const shadowGeo = new THREE.PlaneGeometry(1.55, 2.85);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowMap,
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.position.y = 0.02;
  root.add(shadowMesh);

  const leanGroup = new THREE.Group();
  leanGroup.scale.set(bodyWidthScale, 1, 1);
  root.add(leanGroup);

  // High-contrast PBR materials
  const fairingMat = new THREE.MeshPhysicalMaterial({
    color: livery.primaryHex,
    roughness: 0.16,
    metalness: 0.28,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
  });
  const carbonMat = new THREE.MeshStandardMaterial({
    color: livery.secondaryHex,
    roughness: 0.56,
    metalness: 0.18,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: livery.accentHex,
    roughness: 0.25,
    metalness: 0.4,
  });
  const alloyMat = new THREE.MeshStandardMaterial({
    color: 0xd1d5db,
    roughness: 0.24,
    metalness: 0.92,
  });
  const darkAlloyMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.34,
    metalness: 0.85,
  });
  const titaniumMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.2,
    metalness: 0.94,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.22,
    metalness: 0.9,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x16161a,
    roughness: 0.88,
    metalness: 0.05,
  });
  const visorMat = new THREE.MeshPhysicalMaterial({
    color: 0x090d16,
    roughness: 0.06,
    metalness: 0.2,
    transparent: true,
    opacity: isSoftwareGl ? 0.62 : 0.76,
    clearcoat: 1.0,
  });
  const tailLedMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 1.6,
    roughness: 0.2,
  });

  // 1. Rear Wheel, Brake Disc, & Sculpted Gull-Wing Swingarm
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

  // Twin-sided aluminum swingarm + rear hugger fender
  const swingBeamGeo = new THREE.BoxGeometry(0.055, 0.11, 0.72);
  const swingL = new THREE.Mesh(swingBeamGeo, alloyMat);
  swingL.position.set(0.13, 0.36, -0.46);
  const swingR = new THREE.Mesh(swingBeamGeo, alloyMat);
  swingR.position.set(-0.13, 0.36, -0.46);
  leanGroup.add(swingL, swingR);

  // Rear carbon tire hugger
  const huggerGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.2, 14, 1, true, -0.4, 1.45);
  huggerGeo.rotateZ(Math.PI / 2);
  const hugger = new THREE.Mesh(huggerGeo, carbonMat);
  hugger.position.set(0, 0.35, -0.78);
  leanGroup.add(hugger);

  // Yellow rear monoshock coilover visible under seat
  const shockGeo = new THREE.CylinderGeometry(0.036, 0.036, 0.24, 10);
  const shock = new THREE.Mesh(shockGeo, goldMat);
  shock.position.set(0, 0.56, -0.38);
  shock.rotation.x = 0.52;
  leanGroup.add(shock);

  // 2. Twin-Spar Perimeter Frame, Engine Block & Curved Radiator
  const engineGeo = new THREE.BoxGeometry(0.34, 0.35, 0.5);
  const engine = new THREE.Mesh(engineGeo, darkAlloyMat);
  engine.position.set(0, 0.44, -0.02);
  engine.castShadow = true;
  leanGroup.add(engine);

  const sparGeo = new THREE.BoxGeometry(0.045, 0.1, 0.76);
  const sparL = new THREE.Mesh(sparGeo, alloyMat);
  sparL.position.set(0.16, 0.67, 0.08);
  sparL.rotation.x = -0.25;
  const sparR = new THREE.Mesh(sparGeo, alloyMat);
  sparR.position.set(-0.16, 0.67, 0.08);
  sparR.rotation.x = -0.25;
  leanGroup.add(sparL, sparR);

  const radiatorGeo = new THREE.BoxGeometry(0.28, 0.26, 0.06);
  const radiator = new THREE.Mesh(radiatorGeo, titaniumMat);
  radiator.position.set(0, 0.48, 0.39);
  radiator.rotation.x = -0.35;
  leanGroup.add(radiator);

  // 3. Sculpted Front Cowl, Bellypan, Tank, and Slim Tapered Tail Unit
  // Front & mid side fairing silhouette (ends smoothly at seat pocket, NOT a slab at the tail!)
  const frontFairingShape = new THREE.Shape();
  frontFairingShape.moveTo(-0.34, 0.24);
  frontFairingShape.lineTo(0.42, 0.24); // lower belly pan
  frontFairingShape.quadraticCurveTo(0.9, 0.48, 0.85, 0.79); // sharp MotoGP ram-air nose
  frontFairingShape.lineTo(0.42, 0.94); // upper cowl & dash brow
  frontFairingShape.quadraticCurveTo(0.08, 0.92, -0.22, 0.78); // transition to tank/seat
  frontFairingShape.lineTo(-0.46, 0.68); // seat base
  frontFairingShape.lineTo(-0.34, 0.24);

  const fairingGeo = new THREE.ExtrudeGeometry(frontFairingShape, {
    depth: 0.19,
    bevelEnabled: true,
    bevelThickness: 0.055,
    bevelSize: 0.045,
    bevelSegments: 4,
  });
  fairingGeo.translate(0, 0, -0.095);
  fairingGeo.rotateY(-Math.PI / 2);
  fairingGeo.computeVertexNormals();
  const fairing = new THREE.Mesh(fairingGeo, fairingMat);
  fairing.castShadow = true;
  leanGroup.add(fairing);

  // Sculpted Fuel Tank Dome (knee-grip recesses & rounded upper profile)
  const tankGeo = new THREE.SphereGeometry(0.24, 16, 12);
  tankGeo.scale(0.84, 0.64, 1.45);
  const tank = new THREE.Mesh(tankGeo, fairingMat);
  tank.position.set(0, 0.84, 0.14);
  tank.rotation.x = -0.14;
  tank.castShadow = true;
  leanGroup.add(tank);

  // Slim Racing Seat & Tapered Pointed Tail Section (no square box rear!)
  const seatGeo = new THREE.BoxGeometry(0.21, 0.07, 0.42);
  const seat = new THREE.Mesh(seatGeo, carbonMat);
  seat.position.set(0, 0.75, -0.34);
  seat.rotation.x = -0.1;
  leanGroup.add(seat);

  const tailConeGeo = new THREE.ConeGeometry(0.145, 0.62, 6);
  tailConeGeo.scale(0.95, 1.0, 0.52);
  tailConeGeo.rotateX(-Math.PI / 2 + 0.34);
  const tailCone = new THREE.Mesh(tailConeGeo, fairingMat);
  tailCone.position.set(0, 0.84, -0.66);
  tailCone.castShadow = true;
  leanGroup.add(tailCone);

  const tailSubGeo = new THREE.BoxGeometry(0.14, 0.07, 0.46);
  const tailSub = new THREE.Mesh(tailSubGeo, carbonMat);
  tailSub.position.set(0, 0.76, -0.62);
  tailSub.rotation.x = -0.32;
  leanGroup.add(tailSub);

  // Dark lower belly pan contrast & ram-air nose mouth
  const bellyGeo = new THREE.BoxGeometry(0.28, 0.15, 0.7);
  const belly = new THREE.Mesh(bellyGeo, carbonMat);
  belly.position.set(0, 0.28, 0.04);
  leanGroup.add(belly);

  const ramAirGeo = new THREE.BoxGeometry(0.15, 0.08, 0.1);
  const ramAir = new THREE.Mesh(ramAirGeo, carbonMat);
  ramAir.position.set(0, 0.73, 0.84);
  leanGroup.add(ramAir);

  // Accent livery stripes along flanks & nose number plate
  const flankStripeGeo = new THREE.BoxGeometry(0.32, 0.075, 0.56);
  const flankStripe = new THREE.Mesh(flankStripeGeo, accentMat);
  flankStripe.position.set(0, 0.64, 0.26);
  flankStripe.rotation.x = -0.25;
  leanGroup.add(flankStripe);

  const numberPlateGeo = new THREE.BoxGeometry(0.17, 0.14, 0.25);
  const numberPlate = new THREE.Mesh(numberPlateGeo, accentMat);
  numberPlate.position.set(0, 0.86, 0.59);
  numberPlate.rotation.x = 0.58;
  leanGroup.add(numberPlate);

  // Bi-plane carbon aero winglets (full MotoGP downforce wings)
  if (bikeClass === 'motogp' || bikeClass === 'moto2') {
    const mainWingGeo = new THREE.BoxGeometry(0.64, 0.024, 0.15);
    const mainWing = new THREE.Mesh(mainWingGeo, carbonMat);
    mainWing.position.set(0, 0.71, 0.62);
    mainWing.rotation.x = 0.16;
    leanGroup.add(mainWing);

    if (bikeClass === 'motogp') {
      const upperWingGeo = new THREE.BoxGeometry(0.52, 0.02, 0.11);
      const upperWing = new THREE.Mesh(upperWingGeo, carbonMat);
      upperWing.position.set(0, 0.8, 0.56);
      upperWing.rotation.x = 0.14;
      leanGroup.add(upperWing);
    }
  }

  // Rear rain light LED tucked neatly under the pointed tail stinger
  const rainLightGeo = new THREE.BoxGeometry(0.055, 0.036, 0.03);
  const rainLight = new THREE.Mesh(rainLightGeo, tailLedMat);
  rainLight.position.set(0, 0.89, -0.94);
  leanGroup.add(rainLight);

  // Double-bubble tinted windscreen + TFT dash
  const screenGeo = new THREE.SphereGeometry(0.21, 16, 12, 0, Math.PI, 0, Math.PI * 0.58);
  screenGeo.scale(0.82, 0.74, 1.45);
  const windscreen = new THREE.Mesh(screenGeo, visorMat);
  windscreen.position.set(0, 0.93, 0.45);
  windscreen.rotation.x = -0.38;
  leanGroup.add(windscreen);

  const dashGeo = new THREE.BoxGeometry(0.12, 0.065, 0.028);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const dash = new THREE.Mesh(dashGeo, dashMat);
  dash.position.set(0, 0.91, 0.44);
  dash.rotation.x = -0.45;
  leanGroup.add(dash);

  // 4. Swept Titanium Exhaust + Akrapovic-style Carbon Tip Canister
  const exhaustCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.13, 0.29, 0.16),
    new THREE.Vector3(0.17, 0.31, -0.34),
    new THREE.Vector3(0.18, 0.49, -0.76),
  ]);
  const exhaustGeo = new THREE.TubeGeometry(exhaustCurve, 14, 0.035, 10, false);
  const exhaustPipe = new THREE.Mesh(exhaustGeo, titaniumMat);
  leanGroup.add(exhaustPipe);

  const mufflerGeo = new THREE.CylinderGeometry(0.052, 0.04, 0.26, 12);
  mufflerGeo.rotateX(Math.PI / 2 - 0.32);
  const muffler = new THREE.Mesh(mufflerGeo, carbonMat);
  muffler.position.set(0.18, 0.52, -0.82);
  leanGroup.add(muffler);

  // KERS Boost flame cone
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

  // 5. USD Gold Front Forks, Triple Clamp, Clip-Ons, & Front Wheel
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

  // Angled clip-on handlebars + grips + brake lever guard
  const clipOnGeo = new THREE.CylinderGeometry(0.017, 0.017, 0.25, 8);
  clipOnGeo.rotateZ(Math.PI / 2);
  const barL = new THREE.Mesh(clipOnGeo, carbonMat);
  barL.position.set(0.18, 0.03, -0.02);
  barL.rotation.y = -0.22;
  const barR = new THREE.Mesh(clipOnGeo, carbonMat);
  barR.position.set(-0.18, 0.03, -0.02);
  barR.rotation.y = 0.22;
  frontForkGroup.add(barL, barR);

  // Front carbon fender
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

  // 6. Articulated Realistic MotoGP Rider
  const riderGroup = new THREE.Group();
  riderGroup.position.set(0, 0.82, -0.22);
  leanGroup.add(riderGroup);

  const suitMat = new THREE.MeshStandardMaterial({
    color: livery.primaryHex,
    roughness: 0.52,
    metalness: 0.1,
  });
  const leatherMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.65,
    metalness: 0.08,
  });
  const sliderMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.4,
  });

  // Rider torso + contoured aerodynamic hump
  const torsoGeo = new THREE.CapsuleGeometry(0.145, 0.34, 6, 12);
  const torso = new THREE.Mesh(torsoGeo, suitMat);
  torso.position.set(0, 0.2, 0.14);
  torso.rotation.x = 1.06;
  torso.castShadow = true;
  riderGroup.add(torso);

  const humpGeo = new THREE.CapsuleGeometry(0.07, 0.18, 4, 8);
  const hump = new THREE.Mesh(humpGeo, accentMat);
  hump.position.set(0, 0.31, 0.04);
  hump.rotation.x = 1.24;
  riderGroup.add(hump);

  // Aerodynamic GP Helmet with rear spoiler & dark visor
  const helmetGeo = new THREE.SphereGeometry(0.148, 18, 16);
  const helmet = new THREE.Mesh(helmetGeo, accentMat);
  helmet.position.set(0, 0.41, 0.43);
  helmet.scale.set(0.95, 1.0, 1.12);
  helmet.castShadow = true;
  riderGroup.add(helmet);

  const helmetSpoilerGeo = new THREE.ConeGeometry(0.065, 0.14, 4);
  helmetSpoilerGeo.rotateX(-Math.PI / 2);
  const helmetSpoiler = new THREE.Mesh(helmetSpoilerGeo, fairingMat);
  helmetSpoiler.position.set(0, 0.47, 0.27);
  riderGroup.add(helmetSpoiler);

  const helmetVisorGeo = new THREE.SphereGeometry(0.151, 14, 12, -Math.PI * 0.36, Math.PI * 0.72, Math.PI * 0.24, Math.PI * 0.34);
  const helmetVisor = new THREE.Mesh(helmetVisorGeo, visorMat);
  helmetVisor.position.copy(helmet.position);
  helmetVisor.rotation.y = Math.PI * 0.5;
  riderGroup.add(helmetVisor);

  // Articulated arms gripping the clip-ons
  const armGeo = new THREE.CapsuleGeometry(0.052, 0.26, 4, 8);
  const armL = new THREE.Mesh(armGeo, suitMat);
  armL.position.set(0.21, 0.22, 0.44);
  armL.rotation.set(0.65, -0.35, -0.32);
  const armR = new THREE.Mesh(armGeo, suitMat);
  armR.position.set(-0.21, 0.22, 0.44);
  armR.rotation.set(0.65, 0.35, 0.32);
  riderGroup.add(armL, armR);

  // Bent legs + knee sliders + racing boots
  const thighGeo = new THREE.CapsuleGeometry(0.068, 0.24, 4, 8);
  const thighL = new THREE.Mesh(thighGeo, leatherMat);
  thighL.position.set(0.19, 0.01, 0.08);
  thighL.rotation.set(0.62, 0, -0.28);
  const thighR = new THREE.Mesh(thighGeo, leatherMat);
  thighR.position.set(-0.19, 0.01, 0.08);
  thighR.rotation.set(0.62, 0, 0.28);

  const sliderGeo = new THREE.BoxGeometry(0.04, 0.09, 0.09);
  const sliderL = new THREE.Mesh(sliderGeo, sliderMat);
  sliderL.position.set(0.25, -0.08, 0.16);
  const sliderR = new THREE.Mesh(sliderGeo, sliderMat);
  sliderR.position.set(-0.25, -0.08, 0.16);

  const bootGeo = new THREE.BoxGeometry(0.085, 0.1, 0.2);
  const bootL = new THREE.Mesh(bootGeo, accentMat);
  bootL.position.set(0.18, -0.28, -0.05);
  const bootR = new THREE.Mesh(bootGeo, accentMat);
  bootR.position.set(-0.18, -0.28, -0.05);
  riderGroup.add(thighL, thighR, sliderL, sliderR, bootL, bootR);

  const dispose = () => {
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry?.dispose();
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
    frontWheel,
    rearWheel,
    riderGroup,
    exhaustFlame,
    dispose,
  };
}
