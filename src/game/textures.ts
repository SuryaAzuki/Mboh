import * as THREE from 'three';
import { getRiderFaceStyle, type NationalityCode, type TeamLivery } from './types';

const NATIONAL_FLAG_PALETTES: Record<NationalityCode, [string, string, string]> = {
  IT: ['#16a34a', '#f8fafc', '#dc2626'],
  ES: ['#dc2626', '#facc15', '#dc2626'],
  FR: ['#1d4ed8', '#f8fafc', '#dc2626'],
  ZA: ['#16a34a', '#facc15', '#1d4ed8'],
  AU: ['#1e3a8a', '#f8fafc', '#dc2626'],
  PT: ['#15803d', '#dc2626', '#facc15'],
  JP: ['#f8fafc', '#dc2626', '#f8fafc'],
  US: ['#1d4ed8', '#f8fafc', '#dc2626'],
  TH: ['#dc2626', '#1e3a8a', '#f8fafc'],
  BR: ['#16a34a', '#facc15', '#1d4ed8'],
  CZ: ['#1d4ed8', '#f8fafc', '#dc2626'],
  GB: ['#1e3a8a', '#dc2626', '#f8fafc'],
  NL: ['#dc2626', '#f8fafc', '#1d4ed8'],
  BE: ['#0f172a', '#facc15', '#dc2626'],
  TR: ['#dc2626', '#f8fafc', '#dc2626'],
  CO: ['#facc15', '#1d4ed8', '#dc2626'],
  ID: ['#dc2626', '#dc2626', '#f8fafc'],
};

export interface BikeLiveryTextures {
  sideMap: THREE.CanvasTexture;
  noseMap: THREE.CanvasTexture;
  tankMap: THREE.CanvasTexture;
}

export interface RiderSuitTextures {
  suitMap: THREE.CanvasTexture;
  helmetMap: THREE.CanvasTexture;
}

const liveryTextureCache = new Map<string, BikeLiveryTextures>();
const riderSuitCache = new Map<string, RiderSuitTextures>();

function drawCarbonWeave(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = '#11151d';
  ctx.fillRect(x, y, w, h);
  for (let py = y; py < y + h; py += 8) {
    for (let px = x; px < x + w; px += 8) {
      const odd = ((px / 8 + py / 8) & 1) === 0;
      ctx.fillStyle = odd ? '#1d2432' : '#0b0e14';
      ctx.fillRect(px, py, 6, 4);
      ctx.fillStyle = odd ? '#262f40' : '#141923';
      ctx.fillRect(px + 2, py + 4, 6, 4);
    }
  }
  ctx.restore();
}

export function getBikeLiveryTextures(livery: TeamLivery): BikeLiveryTextures {
  const existing = liveryTextureCache.get(livery.id);
  if (existing) return existing;

  // 1. High-Res Side Fairing Factory Livery (512x256)
  const sideCanvas = document.createElement('canvas');
  sideCanvas.width = 512;
  sideCanvas.height = 256;
  const sctx = sideCanvas.getContext('2d')!;

  // Gloss metallic primary coat with vertical studio highlight
  const baseGrad = sctx.createLinearGradient(0, 0, 0, 256);
  baseGrad.addColorStop(0, livery.primaryHex);
  baseGrad.addColorStop(0.28, '#ffffff30');
  baseGrad.addColorStop(0.55, livery.primaryHex);
  baseGrad.addColorStop(1, livery.secondaryHex);
  sctx.fillStyle = livery.primaryHex;
  sctx.fillRect(0, 0, 512, 256);
  sctx.fillStyle = baseGrad;
  sctx.fillRect(0, 0, 512, 256);

  // Subtle diagonal speed highlight across upper cowl
  sctx.fillStyle = 'rgba(255,255,255,0.12)';
  sctx.beginPath();
  sctx.moveTo(0, 28);
  sctx.lineTo(512, 0);
  sctx.lineTo(512, 34);
  sctx.lineTo(0, 62);
  sctx.closePath();
  sctx.fill();

  // Woven carbon-fiber lower bellypan section
  sctx.save();
  sctx.beginPath();
  sctx.moveTo(0, 174);
  sctx.lineTo(512, 114);
  sctx.lineTo(512, 256);
  sctx.lineTo(0, 256);
  sctx.closePath();
  sctx.clip();
  drawCarbonWeave(sctx, 0, 110, 512, 146);
  sctx.restore();

  // Secondary team flank wedge between carbon belly & primary upper
  sctx.fillStyle = livery.secondaryHex;
  sctx.beginPath();
  sctx.moveTo(0, 152);
  sctx.lineTo(512, 90);
  sctx.lineTo(512, 120);
  sctx.lineTo(0, 180);
  sctx.closePath();
  sctx.fill();

  // Crisp double-stripe factory livery swoosh
  sctx.fillStyle = livery.accentHex;
  sctx.beginPath();
  sctx.moveTo(0, 134);
  sctx.lineTo(512, 72);
  sctx.lineTo(512, 92);
  sctx.lineTo(0, 154);
  sctx.closePath();
  sctx.fill();

  sctx.fillStyle = '#f8fafc';
  sctx.beginPath();
  sctx.moveTo(0, 126);
  sctx.lineTo(512, 64);
  sctx.lineTo(512, 71);
  sctx.lineTo(0, 133);
  sctx.closePath();
  sctx.fill();

  // Heat extraction gill vents near engine bay
  for (let g = 0; g < 4; g++) {
    sctx.fillStyle = '#090d14';
    sctx.beginPath();
    sctx.moveTo(154 + g * 18, 122 - g * 3);
    sctx.lineTo(164 + g * 18, 120 - g * 3);
    sctx.lineTo(156 + g * 18, 166 - g * 3);
    sctx.lineTo(146 + g * 18, 168 - g * 3);
    sctx.closePath();
    sctx.fill();
  }

  // Team crest badge & main fairing wordmark
  sctx.fillStyle = 'rgba(9,13,20,0.65)';
  sctx.fillRect(24, 30, 140, 48);
  sctx.fillStyle = livery.accentHex;
  sctx.fillRect(24, 30, 8, 48);
  sctx.fillStyle = '#ffffff';
  sctx.font = '900 italic 34px system-ui, sans-serif';
  sctx.textAlign = 'left';
  sctx.textBaseline = 'middle';
  sctx.fillText(livery.shortCode, 40, 56);

  // Sponsor micro-badges along lower carbon bellypan
  const badges = ['APEX OIL', 'VORTEX', 'BREMBO', 'KERS 4T'];
  badges.forEach((label, idx) => {
    const bx = 36 + idx * 116;
    const by = 212 - idx * 14;
    sctx.fillStyle = idx === 0 ? livery.accentHex : 'rgba(248,250,252,0.14)';
    sctx.fillRect(bx, by, 98, 24);
    sctx.fillStyle = idx === 0 ? '#0f172a' : '#e2e8f0';
    sctx.font = '900 italic 14px system-ui, sans-serif';
    sctx.textAlign = 'center';
    sctx.fillText(label, bx + 49, by + 13);
  });

  // Outlined factory race number on side fairing
  sctx.save();
  sctx.font = '900 italic 82px system-ui, sans-serif';
  sctx.textAlign = 'right';
  sctx.textBaseline = 'middle';
  sctx.lineWidth = 10;
  sctx.strokeStyle = '#090d14';
  sctx.strokeText(`${livery.number}`, 484, 78);
  sctx.fillStyle = livery.accentHex;
  sctx.fillText(`${livery.number}`, 484, 78);
  sctx.lineWidth = 2;
  sctx.strokeStyle = '#ffffff';
  sctx.strokeText(`${livery.number}`, 484, 78);
  sctx.restore();

  const sideMap = new THREE.CanvasTexture(sideCanvas);
  sideMap.colorSpace = THREE.SRGBColorSpace;
  sideMap.anisotropy = 4;

  // 2. High-Res Front Cowl Number Plate Texture (256x256)
  const noseCanvas = document.createElement('canvas');
  noseCanvas.width = 256;
  noseCanvas.height = 256;
  const nctx = noseCanvas.getContext('2d')!;

  nctx.fillStyle = livery.primaryHex;
  nctx.fillRect(0, 0, 256, 256);

  // Diagonal aero speed stripes on cowl flanks
  nctx.fillStyle = livery.accentHex;
  nctx.beginPath();
  nctx.moveTo(0, 32);
  nctx.lineTo(256, 32);
  nctx.lineTo(228, 72);
  nctx.lineTo(28, 72);
  nctx.closePath();
  nctx.fill();

  // Carbon ram-air surround at base
  drawCarbonWeave(nctx, 34, 198, 188, 58);

  // Outlined race number plate
  nctx.fillStyle = '#f8fafc';
  nctx.fillRect(28, 44, 200, 152);
  nctx.fillStyle = livery.secondaryHex;
  nctx.fillRect(36, 52, 184, 136);

  nctx.font = '900 italic 108px system-ui, sans-serif';
  nctx.textAlign = 'center';
  nctx.textBaseline = 'middle';
  nctx.lineWidth = 8;
  nctx.strokeStyle = '#090d14';
  nctx.strokeText(`${livery.number}`, 128, 124);
  nctx.fillStyle = '#ffffff';
  nctx.fillText(`${livery.number}`, 128, 124);

  const noseMap = new THREE.CanvasTexture(noseCanvas);
  noseMap.colorSpace = THREE.SRGBColorSpace;
  noseMap.anisotropy = 4;

  // 3. Fuel Tank & Aero Cap Graphic Texture (256x256)
  const tankCanvas = document.createElement('canvas');
  tankCanvas.width = 256;
  tankCanvas.height = 256;
  const tctx = tankCanvas.getContext('2d')!;

  tctx.fillStyle = livery.primaryHex;
  tctx.fillRect(0, 0, 256, 256);

  // Dual center racing stripes
  tctx.fillStyle = '#f8fafc';
  tctx.fillRect(102, 0, 52, 256);
  tctx.fillStyle = livery.accentHex;
  tctx.fillRect(110, 0, 36, 256);

  // Carbon knee grip tank pads on flanks
  drawCarbonWeave(tctx, 8, 96, 46, 122);
  drawCarbonWeave(tctx, 202, 96, 46, 122);

  // Milled aluminum race fuel filler cap
  tctx.beginPath();
  tctx.arc(128, 86, 26, 0, Math.PI * 2);
  tctx.fillStyle = '#1e293b';
  tctx.fill();
  tctx.beginPath();
  tctx.arc(128, 86, 20, 0, Math.PI * 2);
  tctx.fillStyle = '#cbd5e1';
  tctx.fill();
  tctx.beginPath();
  tctx.arc(128, 86, 10, 0, Math.PI * 2);
  tctx.fillStyle = '#334155';
  tctx.fill();

  // Short team code emblem near rider crotch pad
  tctx.fillStyle = '#ffffff';
  tctx.font = '900 italic 22px system-ui, sans-serif';
  tctx.textAlign = 'center';
  tctx.fillText(livery.shortCode, 128, 184);

  const tankMap = new THREE.CanvasTexture(tankCanvas);
  tankMap.colorSpace = THREE.SRGBColorSpace;
  tankMap.anisotropy = 4;

  const entry = { sideMap, noseMap, tankMap };
  liveryTextureCache.set(livery.id, entry);
  return entry;
}

export function getRiderSuitTextures(livery: TeamLivery): RiderSuitTextures {
  const existing = riderSuitCache.get(livery.id);
  if (existing) return existing;

  // 1. Humanistic Perforated Kangaroo Leather Racing Suit (256x256)
  const suitCanvas = document.createElement('canvas');
  suitCanvas.width = 256;
  suitCanvas.height = 256;
  const ctx = suitCanvas.getContext('2d')!;

  ctx.fillStyle = livery.primaryHex;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle leather grain + breathable chest perforation micro-dots
  for (let y = 8; y < 248; y += 7) {
    for (let x = 8; x < 248; x += 7) {
      ctx.fillStyle = (x + y) % 14 === 0 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.06)';
      ctx.fillRect(x, y, 2, 2);
    }
  }

  // Dark Schoeller Kevlar ergonomic flex panels on waist & flanks
  ctx.fillStyle = livery.secondaryHex;
  ctx.fillRect(0, 166, 256, 90);
  ctx.fillRect(0, 0, 38, 256);
  ctx.fillRect(218, 0, 38, 256);

  // Ribbed accordion stretch leather seams on lumbar & ribs
  ctx.fillStyle = '#0f172a';
  for (let r = 0; r < 6; r++) {
    ctx.fillRect(46, 174 + r * 9, 164, 4);
  }

  // Diagonal team accent chest yoke + white double stitching
  ctx.fillStyle = livery.accentHex;
  ctx.beginPath();
  ctx.moveTo(28, 34);
  ctx.lineTo(228, 34);
  ctx.lineTo(206, 86);
  ctx.lineTo(50, 86);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(248,250,252,0.55)';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 3]);
  ctx.strokeRect(42, 22, 172, 134);
  ctx.setLineDash([]);

  // Center leather zipper seam
  ctx.fillStyle = '#090d14';
  ctx.fillRect(126, 0, 4, 170);

  // National flag crest stripes near shoulder collar on suit
  const flagTri = NATIONAL_FLAG_PALETTES[livery.nationality] ?? ['#0ea5e9', '#f8fafc', '#ef4444'];
  ctx.fillStyle = flagTri[0];
  ctx.fillRect(18, 12, 12, 22);
  ctx.fillStyle = flagTri[1];
  ctx.fillRect(30, 12, 12, 22);
  ctx.fillStyle = flagTri[2];
  ctx.fillRect(42, 12, 12, 22);

  // Team tag + race number badge on suit chest/back
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 italic 26px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#090d14';
  ctx.strokeText(livery.shortCode, 128, 60);
  ctx.fillText(livery.shortCode, 128, 60);

  ctx.font = '900 italic 44px system-ui, sans-serif';
  ctx.strokeText(`#${livery.number}`, 128, 122);
  ctx.fillText(`#${livery.number}`, 128, 122);

  const suitMap = new THREE.CanvasTexture(suitCanvas);
  suitMap.colorSpace = THREE.SRGBColorSpace;
  suitMap.anisotropy = 4;

  // 2. Painted MotoGP Full-Face Racing Helmet Graphic (256x128)
  const helCanvas = document.createElement('canvas');
  helCanvas.width = 256;
  helCanvas.height = 128;
  const hctx = helCanvas.getContext('2d')!;

  hctx.fillStyle = livery.accentHex;
  hctx.fillRect(0, 0, 256, 128);

  // Sweeping metallic primary aero bands
  hctx.fillStyle = livery.primaryHex;
  hctx.beginPath();
  hctx.moveTo(0, 22);
  hctx.lineTo(256, 22);
  hctx.lineTo(256, 84);
  hctx.lineTo(0, 84);
  hctx.closePath();
  hctx.fill();

  // Sharp white & carbon speed pins + subtle flag rib on helmet rear
  hctx.fillStyle = '#f8fafc';
  hctx.fillRect(0, 18, 256, 6);
  hctx.fillRect(0, 82, 256, 6);
  hctx.fillStyle = '#090d14';
  hctx.fillRect(0, 96, 256, 32);

  hctx.fillStyle = flagTri[0];
  hctx.fillRect(102, 102, 17, 14);
  hctx.fillStyle = flagTri[1];
  hctx.fillRect(119, 102, 18, 14);
  hctx.fillStyle = flagTri[2];
  hctx.fillRect(137, 102, 17, 14);

  // Subtle rider skin hint near brow aperture
  const faceStyle = getRiderFaceStyle(livery);
  hctx.fillStyle = faceStyle.skinHex;
  hctx.fillRect(28, 48, 14, 16);

  // Helmet crown vents & rider number on back
  hctx.fillStyle = '#0f172a';
  hctx.fillRect(108, 10, 14, 24);
  hctx.fillRect(134, 10, 14, 24);

  hctx.fillStyle = '#ffffff';
  hctx.font = '900 italic 34px system-ui, sans-serif';
  hctx.textAlign = 'center';
  hctx.textBaseline = 'middle';
  hctx.lineWidth = 5;
  hctx.strokeStyle = '#090d14';
  hctx.strokeText(`${livery.number}`, 128, 54);
  hctx.fillText(`${livery.number}`, 128, 54);

  const helmetMap = new THREE.CanvasTexture(helCanvas);
  helmetMap.colorSpace = THREE.SRGBColorSpace;
  helmetMap.anisotropy = 4;

  const entry = { suitMap, helmetMap };
  riderSuitCache.set(livery.id, entry);
  return entry;
}

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
  wetPuddleMap: THREE.CanvasTexture;
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
    pctx.fillStyle = '#0f172a';
    pctx.fillRect(bx, 72, 134, 184);
    pctx.fillStyle = '#1e293b';
    pctx.fillRect(bx + 8, 80, 118, 176);
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

  // 8. Radial wet asphalt puddle texture with glistening blue-slate water sheen
  const pudCanvas = document.createElement('canvas');
  pudCanvas.width = 128;
  pudCanvas.height = 128;
  const pudCtx = pudCanvas.getContext('2d')!;
  const pGrad = pudCtx.createRadialGradient(64, 64, 10, 64, 64, 60);
  pGrad.addColorStop(0, 'rgba(56, 189, 248, 0.56)');
  pGrad.addColorStop(0.55, 'rgba(30, 58, 138, 0.45)');
  pGrad.addColorStop(0.85, 'rgba(148, 163, 184, 0.24)');
  pGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
  pudCtx.fillStyle = pGrad;
  pudCtx.fillRect(0, 0, 128, 128);
  pudCtx.strokeStyle = 'rgba(224, 242, 254, 0.35)';
  pudCtx.lineWidth = 2;
  pudCtx.beginPath();
  pudCtx.ellipse(64, 64, 42, 34, 0.2, 0, Math.PI * 2);
  pudCtx.stroke();
  const wetPuddleMap = new THREE.CanvasTexture(pudCanvas);
  wetPuddleMap.colorSpace = THREE.SRGBColorSpace;

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
    wetPuddleMap,
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
      wetPuddleMap.dispose();
      billboardMaps.forEach((b) => b.dispose());
    },
  };
}
