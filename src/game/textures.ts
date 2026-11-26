import * as THREE from 'three';

export interface ProceduralTextures {
  asphaltMap: THREE.CanvasTexture;
  asphaltBump: THREE.CanvasTexture;
  curbMap: THREE.CanvasTexture;
  grassMap: THREE.CanvasTexture;
  gravelMap: THREE.CanvasTexture;
  checkeredMap: THREE.CanvasTexture;
  radialShadowMap: THREE.CanvasTexture;
  gantryBannerMap: THREE.CanvasTexture;
  pitGarageMap: THREE.CanvasTexture;
  sponsorBoardMap: THREE.CanvasTexture;
  brakeBoard150Map: THREE.CanvasTexture;
  brakeBoard100Map: THREE.CanvasTexture;
  brakeBoard50Map: THREE.CanvasTexture;
  billboardMaps: THREE.CanvasTexture[];
  dispose: () => void;
}

function makeTextBoardTexture(
  bg: string,
  fg: string,
  accent: string,
  mainText: string,
  subText: string,
  w = 512,
  h = 128,
  aniso = 4,
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 18, h);
  ctx.fillRect(w - 18, 0, 18, h);

  ctx.fillStyle = fg;
  ctx.font = `900 italic ${Math.round(h * 0.44)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(mainText, w / 2, subText ? h * 0.42 : h * 0.52);

  if (subText) {
    ctx.fillStyle = accent;
    ctx.font = `700 ${Math.round(h * 0.18)}px system-ui, sans-serif`;
    ctx.fillText(subText, w / 2, h * 0.77);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = aniso;
  return tex;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextures {
  const aniso = Math.max(1, Math.min(8, maxAnisotropy));

  // 1. Track Asphalt Albedo + Bump (dark charcoal aggregate + rubber racing line + crisp edge lines)
  const asphaltCanvas = document.createElement('canvas');
  asphaltCanvas.width = 512;
  asphaltCanvas.height = 512;
  const actx = asphaltCanvas.getContext('2d')!;
  actx.fillStyle = '#20242c';
  actx.fillRect(0, 0, 512, 512);

  const groove = actx.createLinearGradient(0, 0, 512, 0);
  groove.addColorStop(0, 'rgba(0,0,0,0.25)');
  groove.addColorStop(0.15, 'rgba(0,0,0,0.03)');
  groove.addColorStop(0.38, 'rgba(8,10,14,0.3)');
  groove.addColorStop(0.5, 'rgba(18,22,28,0.12)');
  groove.addColorStop(0.62, 'rgba(8,10,14,0.3)');
  groove.addColorStop(0.85, 'rgba(0,0,0,0.03)');
  groove.addColorStop(1, 'rgba(0,0,0,0.25)');
  actx.fillStyle = groove;
  actx.fillRect(0, 0, 512, 512);

  // White edge track boundary lines + subtle longitudinal rubber streaks
  actx.fillStyle = '#f1f5f9';
  actx.fillRect(10, 0, 10, 512);
  actx.fillRect(492, 0, 10, 512);

  for (let i = 0; i < 8000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 24 + Math.floor(Math.random() * 34);
    actx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
    actx.fillRect(x, y, 2, 2);
  }
  const asphaltMap = new THREE.CanvasTexture(asphaltCanvas);
  asphaltMap.colorSpace = THREE.SRGBColorSpace;
  asphaltMap.wrapS = THREE.RepeatWrapping;
  asphaltMap.wrapT = THREE.RepeatWrapping;
  asphaltMap.anisotropy = aniso;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 256;
  bumpCanvas.height = 256;
  const bctx = bumpCanvas.getContext('2d')!;
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4500; i++) {
    const v = 90 + Math.floor(Math.random() * 80);
    bctx.fillStyle = `rgb(${v},${v},${v})`;
    bctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const asphaltBump = new THREE.CanvasTexture(bumpCanvas);
  asphaltBump.wrapS = THREE.RepeatWrapping;
  asphaltBump.wrapT = THREE.RepeatWrapping;
  asphaltBump.anisotropy = aniso;

  // 2. Red & White FIA Curbing with subtle concrete bevel
  const curbCanvas = document.createElement('canvas');
  curbCanvas.width = 128;
  curbCanvas.height = 256;
  const cctx = curbCanvas.getContext('2d')!;
  cctx.fillStyle = '#f8fafc';
  cctx.fillRect(0, 0, 128, 128);
  cctx.fillStyle = '#dc2626';
  cctx.fillRect(0, 128, 128, 128);
  cctx.fillStyle = 'rgba(0,0,0,0.16)';
  cctx.fillRect(0, 0, 12, 256);
  const curbMap = new THREE.CanvasTexture(curbCanvas);
  curbMap.colorSpace = THREE.SRGBColorSpace;
  curbMap.wrapS = THREE.RepeatWrapping;
  curbMap.wrapT = THREE.RepeatWrapping;
  curbMap.anisotropy = aniso;

  // 3. Grass infield / outfield texture
  const grassCanvas = document.createElement('canvas');
  grassCanvas.width = 256;
  grassCanvas.height = 256;
  const gctx = grassCanvas.getContext('2d')!;
  gctx.fillStyle = '#2d5a27';
  gctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3600; i++) {
    const g = 74 + Math.floor(Math.random() * 44);
    gctx.fillStyle = `rgb(${Math.floor(g * 0.44)},${g},${Math.floor(g * 0.36)})`;
    gctx.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
  }
  const grassMap = new THREE.CanvasTexture(grassCanvas);
  grassMap.colorSpace = THREE.SRGBColorSpace;
  grassMap.wrapS = THREE.RepeatWrapping;
  grassMap.wrapT = THREE.RepeatWrapping;
  grassMap.repeat.set(120, 120);
  grassMap.anisotropy = aniso;

  // 4. Gravel trap texture (raked FIM pebble pattern)
  const gravelCanvas = document.createElement('canvas');
  gravelCanvas.width = 256;
  gravelCanvas.height = 256;
  const grctx = gravelCanvas.getContext('2d')!;
  grctx.fillStyle = '#b9aa95';
  grctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 8) {
    grctx.fillStyle = 'rgba(0,0,0,0.06)';
    grctx.fillRect(0, y, 256, 2);
  }
  for (let i = 0; i < 4500; i++) {
    const v = 135 + Math.floor(Math.random() * 65);
    grctx.fillStyle = `rgb(${v},${v - 10},${v - 24})`;
    grctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const gravelMap = new THREE.CanvasTexture(gravelCanvas);
  gravelMap.colorSpace = THREE.SRGBColorSpace;
  gravelMap.wrapS = THREE.RepeatWrapping;
  gravelMap.wrapT = THREE.RepeatWrapping;
  gravelMap.anisotropy = aniso;

  // 5. Checkered Start/Finish Line
  const chkCanvas = document.createElement('canvas');
  chkCanvas.width = 256;
  chkCanvas.height = 64;
  const chctx = chkCanvas.getContext('2d')!;
  const sq = 16;
  for (let y = 0; y < 64; y += sq) {
    for (let x = 0; x < 256; x += sq) {
      const dark = ((x / sq + y / sq) & 1) === 0;
      chctx.fillStyle = dark ? '#0f172a' : '#f8fafc';
      chctx.fillRect(x, y, sq, sq);
    }
  }
  const checkeredMap = new THREE.CanvasTexture(chkCanvas);
  checkeredMap.colorSpace = THREE.SRGBColorSpace;
  checkeredMap.anisotropy = aniso;

  // 6. Radial contact shadow disc
  const shCanvas = document.createElement('canvas');
  shCanvas.width = 128;
  shCanvas.height = 128;
  const sctx = shCanvas.getContext('2d')!;
  const grad = sctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0,0,0,0.74)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.34)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 128, 128);
  const radialShadowMap = new THREE.CanvasTexture(shCanvas);
  radialShadowMap.colorSpace = THREE.SRGBColorSpace;

  // 7. Pit Garage Facade Texture (6 numbered pit garage bays)
  const pitCanvas = document.createElement('canvas');
  pitCanvas.width = 1024;
  pitCanvas.height = 256;
  const pctx = pitCanvas.getContext('2d')!;
  pctx.fillStyle = '#e2e8f0';
  pctx.fillRect(0, 0, 1024, 256);
  pctx.fillStyle = '#dc2626';
  pctx.fillRect(0, 0, 1024, 34);
  for (let b = 0; b < 6; b++) {
    const bx = 24 + b * 166;
    // Garage bay doorway
    pctx.fillStyle = '#0f172a';
    pctx.fillRect(bx, 72, 134, 184);
    pctx.fillStyle = '#1e293b';
    pctx.fillRect(bx + 8, 80, 118, 176);
    // Bay number header
    pctx.fillStyle = '#0f172a';
    pctx.font = '900 24px system-ui, sans-serif';
    pctx.textAlign = 'center';
    pctx.fillText(`BOX 0${b + 1}`, bx + 67, 56);
  }
  const pitGarageMap = new THREE.CanvasTexture(pitCanvas);
  pitGarageMap.colorSpace = THREE.SRGBColorSpace;
  pitGarageMap.anisotropy = aniso;

  const gantryBannerMap = makeTextBoardTexture(
    '#0f172a',
    '#f8fafc',
    '#dc2626',
    'APEX GP',
    'FIM WORLD CHAMPIONSHIP CIRCUIT',
    512,
    128,
    aniso,
  );
  const sponsorBoardMap = makeTextBoardTexture(
    '#1e293b',
    '#f8fafc',
    '#f59e0b',
    'APEX RACING // MOTO3 · MOTO2 · MOTOGP',
    '',
    512,
    96,
    aniso,
  );
  const brakeBoard150Map = makeTextBoardTexture('#f8fafc', '#0f172a', '#dc2626', '150', 'M', 128, 128, aniso);
  const brakeBoard100Map = makeTextBoardTexture('#f8fafc', '#0f172a', '#dc2626', '100', 'M', 128, 128, aniso);
  const brakeBoard50Map = makeTextBoardTexture('#f8fafc', '#0f172a', '#dc2626', '50', 'M', 128, 128, aniso);

  const billboardMaps: THREE.CanvasTexture[] = [
    makeTextBoardTexture('#0f172a', '#f8fafc', '#dc2626', 'APEX GP', 'WORLD CHAMPIONSHIP', 512, 128, aniso),
    makeTextBoardTexture('#18181b', '#facc15', '#ef4444', 'VORTEX TIRES', 'ULTRA COMPOUND GRIP', 512, 128, aniso),
    makeTextBoardTexture('#0c192c', '#f8fafc', '#06b6d4', 'VOLT KERS', 'HYBRID BOOST SYSTEMS', 512, 128, aniso),
    makeTextBoardTexture('#f8fafc', '#0f172a', '#16a34a', 'MOTOCRONO', 'OFFICIAL RACE TIMING', 512, 128, aniso),
    makeTextBoardTexture('#1e1b4b', '#f8fafc', '#f97316', 'APEX OIL', 'RACING 4T SYNTHETIC', 512, 128, aniso),
  ];

  return {
    asphaltMap,
    asphaltBump,
    curbMap,
    grassMap,
    gravelMap,
    checkeredMap,
    radialShadowMap,
    gantryBannerMap,
    pitGarageMap,
    sponsorBoardMap,
    brakeBoard150Map,
    brakeBoard100Map,
    brakeBoard50Map,
    billboardMaps,
    dispose: () => {
      asphaltMap.dispose();
      asphaltBump.dispose();
      curbMap.dispose();
      grassMap.dispose();
      gravelMap.dispose();
      checkeredMap.dispose();
      radialShadowMap.dispose();
      gantryBannerMap.dispose();
      pitGarageMap.dispose();
      sponsorBoardMap.dispose();
      brakeBoard150Map.dispose();
      brakeBoard100Map.dispose();
      brakeBoard50Map.dispose();
      billboardMaps.forEach((b) => b.dispose());
    },
  };
}
