export type GameScreenState = 'title' | 'playing' | 'paused' | 'gameover';

export type SessionType = 'race' | 'qualifying';

export type CameraMode = 'chase' | 'helmet' | 'tv';

export type BikeClassId = 'moto3' | 'moto2' | 'motogp';

export type WeatherPhase = 'clear' | 'clouds' | 'rain';

export type CircuitId =
  | 'lusail'
  | 'mugello'
  | 'assen'
  | 'motegi'
  | 'mandalika'
  | 'sepang';

export type NationalityCode =
  | 'IT'
  | 'ES'
  | 'FR'
  | 'ZA'
  | 'AU'
  | 'PT'
  | 'JP'
  | 'US'
  | 'TH'
  | 'BR'
  | 'CZ'
  | 'GB'
  | 'NL'
  | 'BE'
  | 'TR'
  | 'CO'
  | 'ID';

export interface RiderFaceStyle {
  skinHex: string;
  hairHex: string;
  beard?: boolean;
  browStyle?: 0 | 1 | 2;
}

export interface BikeClassSpec {
  id: BikeClassId;
  label: string;
  displacement: string;
  topSpeedMs: number;
  boostTopSpeedMs: number;
  accelMultiplier: number;
  handlingMultiplier: number;
  maxRpm: number;
  badgeColor: string;
  description: string;
}

export const BIKE_CLASSES: Record<BikeClassId, BikeClassSpec> = {
  moto3: {
    id: 'moto3',
    label: 'Moto3',
    displacement: '250cc Single',
    topSpeedMs: 65, // ~234 km/h
    boostTopSpeedMs: 72, // ~259 km/h
    accelMultiplier: 0.76,
    handlingMultiplier: 1.16,
    maxRpm: 14000,
    badgeColor: '#0ea5e9',
    description: 'Lightweight agile 250cc entry class — sharp cornering & slipstream battles.',
  },
  moto2: {
    id: 'moto2',
    label: 'Moto2',
    displacement: '765cc Triple',
    topSpeedMs: 76, // ~274 km/h
    boostTopSpeedMs: 84, // ~302 km/h
    accelMultiplier: 0.9,
    handlingMultiplier: 1.07,
    maxRpm: 15000,
    badgeColor: '#f59e0b',
    description: 'Intermediate 765cc prototype — balanced mid-corner grip & strong drive.',
  },
  motogp: {
    id: 'motogp',
    label: 'MotoGP',
    displacement: '1000cc V4',
    topSpeedMs: 88, // ~317 km/h
    boostTopSpeedMs: 97, // ~349 km/h
    accelMultiplier: 1.04,
    handlingMultiplier: 1.0,
    maxRpm: 16500,
    badgeColor: '#dc2626',
    description: 'Premier 1000cc aero prototype — extreme top speed & bi-plane downforce.',
  },
};

export interface TeamLivery {
  id: string;
  name: string;
  riderName: string;
  shortCode: string;
  nationality: NationalityCode;
  primaryHex: string;
  secondaryHex: string;
  accentHex: string;
  number: number;
  face?: RiderFaceStyle;
}

export const COUNTRY_NAMES: Record<NationalityCode, string> = {
  IT: 'Italy',
  ES: 'Spain',
  FR: 'France',
  ZA: 'South Africa',
  AU: 'Australia',
  PT: 'Portugal',
  JP: 'Japan',
  US: 'United States',
  TH: 'Thailand',
  BR: 'Brazil',
  CZ: 'Czechia',
  GB: 'Great Britain',
  NL: 'Netherlands',
  BE: 'Belgium',
  TR: 'Turkey',
  CO: 'Colombia',
  ID: 'Indonesia',
};

const DEFAULT_FACE_PALETTES: RiderFaceStyle[] = [
  { skinHex: '#f1c27d', hairHex: '#1c1917', beard: true, browStyle: 0 },
  { skinHex: '#e0ac69', hairHex: '#292524', beard: false, browStyle: 1 },
  { skinHex: '#f5cba7', hairHex: '#78350f', beard: false, browStyle: 2 },
  { skinHex: '#c68642', hairHex: '#0f172a', beard: true, browStyle: 0 },
  { skinHex: '#ffdbac', hairHex: '#b45309', beard: false, browStyle: 1 },
  { skinHex: '#d2996c', hairHex: '#1e1b4b', beard: true, browStyle: 2 },
];

export function getRiderFaceStyle(livery: TeamLivery): Required<RiderFaceStyle> {
  if (livery.face) {
    return {
      skinHex: livery.face.skinHex,
      hairHex: livery.face.hairHex,
      beard: Boolean(livery.face.beard),
      browStyle: livery.face.browStyle ?? 0,
    };
  }
  const preset = DEFAULT_FACE_PALETTES[livery.number % DEFAULT_FACE_PALETTES.length];
  return {
    skinHex: preset.skinHex,
    hairHex: preset.hairHex,
    beard: Boolean(preset.beard),
    browStyle: preset.browStyle ?? 0,
  };
}

export const MOTOGP_RIDERS: TeamLivery[] = [
  { id: 'ducati', name: 'Borgo Rosso', riderName: 'F. Bagnaia', shortCode: 'BGR', nationality: 'IT', primaryHex: '#dc2626', secondaryHex: '#18181b', accentHex: '#f8fafc', number: 1, face: { skinHex: '#e6b88a', hairHex: '#1c1917', beard: true, browStyle: 1 } },
  { id: 'ducati-2', name: 'Borgo Rosso', riderName: 'E. Bastianini', shortCode: 'BGR', nationality: 'IT', primaryHex: '#b91c1c', secondaryHex: '#18181b', accentHex: '#fca5a5', number: 23, face: { skinHex: '#e0ac69', hairHex: '#27272a', beard: true, browStyle: 0 } },
  { id: 'yamaha', name: 'Iwata Blue', riderName: 'F. Quartararo', shortCode: 'IWT', nationality: 'FR', primaryHex: '#2563eb', secondaryHex: '#0f172a', accentHex: '#38bdf8', number: 20, face: { skinHex: '#ebbf91', hairHex: '#3b2618', beard: false, browStyle: 2 } },
  { id: 'kawasaki', name: 'Iwata Blue', riderName: 'A. Rins', shortCode: 'IWT', nationality: 'ES', primaryHex: '#1d4ed8', secondaryHex: '#0f172a', accentHex: '#93c5fd', number: 42, face: { skinHex: '#f1c27d', hairHex: '#451a03', beard: true, browStyle: 1 } },
  { id: 'honda', name: 'Gresini Sky', riderName: 'M. Marquez', shortCode: 'GRS', nationality: 'ES', primaryHex: '#0284c7', secondaryHex: '#1e293b', accentHex: '#ef4444', number: 93, face: { skinHex: '#e2b07d', hairHex: '#18181b', beard: false, browStyle: 2 } },
  { id: 'gresini-2', name: 'Gresini Sky', riderName: 'A. Marquez', shortCode: 'GRS', nationality: 'ES', primaryHex: '#0ea5e9', secondaryHex: '#1e293b', accentHex: '#f8fafc', number: 73, face: { skinHex: '#e7b98b', hairHex: '#27272a', beard: false, browStyle: 0 } },
  { id: 'pramac', name: 'Pramac Violet', riderName: 'J. Martin', shortCode: 'PRM', nationality: 'ES', primaryHex: '#7c3aed', secondaryHex: '#111827', accentHex: '#f43f5e', number: 89, face: { skinHex: '#dfa972', hairHex: '#171717', beard: true, browStyle: 2 } },
  { id: 'pramac-2', name: 'Pramac Violet', riderName: 'F. Morbidelli', shortCode: 'PRM', nationality: 'IT', primaryHex: '#6d28d9', secondaryHex: '#111827', accentHex: '#e879f9', number: 21, face: { skinHex: '#c68642', hairHex: '#111827', beard: true, browStyle: 0 } },
  { id: 'aprilia', name: 'Noale Factory', riderName: 'A. Espargaro', shortCode: 'NOL', nationality: 'ES', primaryHex: '#4f46e5', secondaryHex: '#09090b', accentHex: '#f43f5e', number: 41, face: { skinHex: '#eab888', hairHex: '#3f2e21', beard: true, browStyle: 1 } },
  { id: 'aprilia-2', name: 'Noale Factory', riderName: 'M. Vinales', shortCode: 'NOL', nationality: 'ES', primaryHex: '#4338ca', secondaryHex: '#09090b', accentHex: '#fb7185', number: 12, face: { skinHex: '#e5b27f', hairHex: '#1c1917', beard: true, browStyle: 0 } },
  { id: 'suzuki', name: 'HRC Repsol', riderName: 'J. Mir', shortCode: 'HRC', nationality: 'ES', primaryHex: '#ea580c', secondaryHex: '#1e293b', accentHex: '#facc15', number: 36, face: { skinHex: '#f3c694', hairHex: '#292524', beard: false, browStyle: 1 } },
  { id: 'honda-2', name: 'HRC Repsol', riderName: 'L. Marini', shortCode: 'HRC', nationality: 'IT', primaryHex: '#c2410c', secondaryHex: '#0f172a', accentHex: '#fde047', number: 10, face: { skinHex: '#f0c497', hairHex: '#451a03', beard: false, browStyle: 0 } },
  { id: 'ktm', name: 'Mattighofen', riderName: 'B. Binder', shortCode: 'MGF', nationality: 'ZA', primaryHex: '#f97316', secondaryHex: '#18181b', accentHex: '#f8fafc', number: 33, face: { skinHex: '#f4c79c', hairHex: '#78350f', beard: true, browStyle: 2 } },
  { id: 'ktm-2', name: 'Mattighofen', riderName: 'J. Miller', shortCode: 'MGF', nationality: 'AU', primaryHex: '#d97706', secondaryHex: '#18181b', accentHex: '#f8fafc', number: 43, face: { skinHex: '#f5cfa7', hairHex: '#92400e', beard: true, browStyle: 1 } },
  { id: 'vr46', name: 'Tavullia Neon', riderName: 'M. Bezzecchi', shortCode: 'TVL', nationality: 'IT', primaryHex: '#ca8a04', secondaryHex: '#09090b', accentHex: '#bef264', number: 72, face: { skinHex: '#ebb988', hairHex: '#1c1917', beard: true, browStyle: 0 } },
  { id: 'vr46-2', name: 'Tavullia Neon', riderName: 'F. Di Giannantonio', shortCode: 'TVL', nationality: 'IT', primaryHex: '#eab308', secondaryHex: '#09090b', accentHex: '#f8fafc', number: 49, face: { skinHex: '#e2b07d', hairHex: '#292524', beard: true, browStyle: 1 } },
  { id: 'gresini', name: 'Tech3 Crimson', riderName: 'P. Acosta', shortCode: 'TC3', nationality: 'ES', primaryHex: '#e11d48', secondaryHex: '#18181b', accentHex: '#f8fafc', number: 31, face: { skinHex: '#f2c79a', hairHex: '#3b2618', beard: false, browStyle: 2 } },
  { id: 'tech3-2', name: 'Tech3 Crimson', riderName: 'A. Fernandez', shortCode: 'TC3', nationality: 'ES', primaryHex: '#be123c', secondaryHex: '#18181b', accentHex: '#fda4af', number: 37, face: { skinHex: '#e8b683', hairHex: '#27272a', beard: false, browStyle: 1 } },
  { id: 'trackhouse-1', name: 'Trackhouse USA', riderName: 'M. Oliveira', shortCode: 'TRK', nationality: 'PT', primaryHex: '#0891b2', secondaryHex: '#0f172a', accentHex: '#fb7185', number: 88, face: { skinHex: '#e0ad79', hairHex: '#1c1917', beard: true, browStyle: 0 } },
  { id: 'trackhouse-2', name: 'Trackhouse USA', riderName: 'R. Fernandez', shortCode: 'TRK', nationality: 'ES', primaryHex: '#0e7490', secondaryHex: '#0f172a', accentHex: '#38bdf8', number: 25, face: { skinHex: '#ebb986', hairHex: '#292524', beard: false, browStyle: 1 } },
  { id: 'lcr-1', name: 'LCR Castrol', riderName: 'J. Zarco', shortCode: 'LCR', nationality: 'FR', primaryHex: '#16a34a', secondaryHex: '#111827', accentHex: '#ef4444', number: 5, face: { skinHex: '#f1c292', hairHex: '#451a03', beard: true, browStyle: 2 } },
  { id: 'lcr-2', name: 'LCR Idemitsu', riderName: 'T. Nakagami', shortCode: 'LCR', nationality: 'JP', primaryHex: '#15803d', secondaryHex: '#111827', accentHex: '#f8fafc', number: 30, face: { skinHex: '#f0c8a0', hairHex: '#0f172a', beard: false, browStyle: 0 } },
];

export const MOTO2_RIDERS: TeamLivery[] = [
  { id: 'm2-ogura', name: 'MT Helmets MSI', riderName: 'A. Ogura', shortCode: 'MSI', nationality: 'JP', primaryHex: '#0284c7', secondaryHex: '#0f172a', accentHex: '#facc15', number: 79, face: { skinHex: '#f0c8a0', hairHex: '#0f172a', beard: false, browStyle: 1 } },
  { id: 'm2-garcia', name: 'MT Helmets MSI', riderName: 'S. Garcia', shortCode: 'MSI', nationality: 'ES', primaryHex: '#0369a1', secondaryHex: '#0f172a', accentHex: '#fde047', number: 3, face: { skinHex: '#ebb888', hairHex: '#292524', beard: false, browStyle: 0 } },
  { id: 'm2-lopez', name: 'SpeedUp Boscoscuro', riderName: 'A. Lopez', shortCode: 'SPD', nationality: 'ES', primaryHex: '#dc2626', secondaryHex: '#18181b', accentHex: '#facc15', number: 21, face: { skinHex: '#e7b585', hairHex: '#1c1917', beard: false, browStyle: 2 } },
  { id: 'm2-aldeguer', name: 'SpeedUp Boscoscuro', riderName: 'F. Aldeguer', shortCode: 'SPD', nationality: 'ES', primaryHex: '#b91c1c', secondaryHex: '#18181b', accentHex: '#f8fafc', number: 54, face: { skinHex: '#f2c598', hairHex: '#3b2618', beard: false, browStyle: 1 } },
  { id: 'm2-canet', name: 'Fantic Racing', riderName: 'A. Canet', shortCode: 'FNT', nationality: 'ES', primaryHex: '#ef4444', secondaryHex: '#09090b', accentHex: '#38bdf8', number: 44, face: { skinHex: '#e5b27f', hairHex: '#27272a', beard: true, browStyle: 2 } },
  { id: 'm2-agius', name: 'Liqui Moly Intact', riderName: 'S. Agius', shortCode: 'INT', nationality: 'AU', primaryHex: '#2563eb', secondaryHex: '#111827', accentHex: '#ef4444', number: 81, face: { skinHex: '#f5cfa7', hairHex: '#78350f', beard: false, browStyle: 0 } },
  { id: 'm2-roberts', name: 'OnlyFans American', riderName: 'J. Roberts', shortCode: 'AMR', nationality: 'US', primaryHex: '#0ea5e9', secondaryHex: '#0f172a', accentHex: '#f8fafc', number: 16, face: { skinHex: '#f6d1aa', hairHex: '#a16207', beard: false, browStyle: 1 } },
  { id: 'm2-ramirez', name: 'OnlyFans American', riderName: 'M. Ramirez', shortCode: 'AMR', nationality: 'ES', primaryHex: '#06b6d4', secondaryHex: '#0f172a', accentHex: '#f8fafc', number: 24, face: { skinHex: '#e2b07d', hairHex: '#1c1917', beard: true, browStyle: 0 } },
  { id: 'm2-vietti', name: 'Red Bull Ajo', riderName: 'C. Vietti', shortCode: 'AJO', nationality: 'IT', primaryHex: '#f97316', secondaryHex: '#1e1b4b', accentHex: '#facc15', number: 13, face: { skinHex: '#ebb888', hairHex: '#3b2618', beard: false, browStyle: 2 } },
  { id: 'm2-oncu', name: 'Red Bull Ajo', riderName: 'D. Oncu', shortCode: 'AJO', nationality: 'TR', primaryHex: '#ea580c', secondaryHex: '#1e1b4b', accentHex: '#f8fafc', number: 53, face: { skinHex: '#dfb080', hairHex: '#171717', beard: true, browStyle: 1 } },
  { id: 'm2-gonzalez', name: 'Gresini Moto2', riderName: 'M. Gonzalez', shortCode: 'G2M', nationality: 'ES', primaryHex: '#38bdf8', secondaryHex: '#1e293b', accentHex: '#ef4444', number: 18, face: { skinHex: '#e7b585', hairHex: '#1c1917', beard: false, browStyle: 0 } },
  { id: 'm2-arenas', name: 'Gresini Moto2', riderName: 'A. Arenas', shortCode: 'G2M', nationality: 'ES', primaryHex: '#0284c7', secondaryHex: '#1e293b', accentHex: '#f8fafc', number: 75, face: { skinHex: '#e0ad79', hairHex: '#27272a', beard: true, browStyle: 1 } },
  { id: 'm2-arbolino', name: 'Marc VDS Racing', riderName: 'T. Arbolino', shortCode: 'VDS', nationality: 'IT', primaryHex: '#be123c', secondaryHex: '#18181b', accentHex: '#facc15', number: 14, face: { skinHex: '#ebb888', hairHex: '#1c1917', beard: true, browStyle: 2 } },
  { id: 'm2-salac', name: 'Marc VDS Racing', riderName: 'F. Salac', shortCode: 'VDS', nationality: 'CZ', primaryHex: '#9f1239', secondaryHex: '#18181b', accentHex: '#fde047', number: 12, face: { skinHex: '#f6d2ad', hairHex: '#92400e', beard: false, browStyle: 0 } },
  { id: 'm2-dixon', name: 'Aspar CFMOTO', riderName: 'J. Dixon', shortCode: 'ASP', nationality: 'GB', primaryHex: '#0d9488', secondaryHex: '#0f172a', accentHex: '#f8fafc', number: 96, face: { skinHex: '#f5cfa7', hairHex: '#78350f', beard: true, browStyle: 1 } },
  { id: 'm2-guevara', name: 'Aspar CFMOTO', riderName: 'I. Guevara', shortCode: 'ASP', nationality: 'ES', primaryHex: '#0f766e', secondaryHex: '#0f172a', accentHex: '#38bdf8', number: 28, face: { skinHex: '#e5b27f', hairHex: '#292524', beard: false, browStyle: 2 } },
  { id: 'm2-chantra', name: 'Idemitsu Asia', riderName: 'S. Chantra', shortCode: 'ASI', nationality: 'TH', primaryHex: '#b45309', secondaryHex: '#18181b', accentHex: '#f8fafc', number: 35, face: { skinHex: '#d8a472', hairHex: '#0f172a', beard: false, browStyle: 0 } },
  { id: 'm2-alcoba', name: 'VR46 Master Camp', riderName: 'J. Alcoba', shortCode: 'VMC', nationality: 'ES', primaryHex: '#1d4ed8', secondaryHex: '#111827', accentHex: '#bef264', number: 52, face: { skinHex: '#e9b887', hairHex: '#27272a', beard: false, browStyle: 1 } },
  { id: 'm2-moreira', name: 'Italtrans Racing', riderName: 'D. Moreira', shortCode: 'ITL', nationality: 'BR', primaryHex: '#16a34a', secondaryHex: '#0f172a', accentHex: '#f8fafc', number: 10, face: { skinHex: '#cfa06e', hairHex: '#171717', beard: false, browStyle: 2 } },
  { id: 'm2-binder', name: 'Liqui Moly Intact', riderName: 'D. Binder', shortCode: 'INT', nationality: 'ZA', primaryHex: '#4338ca', secondaryHex: '#111827', accentHex: '#ef4444', number: 15, face: { skinHex: '#f2c598', hairHex: '#451a03', beard: true, browStyle: 0 } },
  { id: 'm2-vdg', name: 'RW-Idrofoglia', riderName: 'Z. Van Den Goorbergh', shortCode: 'RWR', nationality: 'NL', primaryHex: '#7c3aed', secondaryHex: '#09090b', accentHex: '#facc15', number: 84, face: { skinHex: '#f6d2ad', hairHex: '#b45309', beard: false, browStyle: 1 } },
  { id: 'm2-baltus', name: 'RW-Idrofoglia', riderName: 'B. Baltus', shortCode: 'RWR', nationality: 'BE', primaryHex: '#6d28d9', secondaryHex: '#09090b', accentHex: '#f8fafc', number: 7, face: { skinHex: '#f4cba2', hairHex: '#78350f', beard: false, browStyle: 2 } },
];

export const MOTO3_RIDERS: TeamLivery[] = [
  { id: 'm3-alonso', name: 'CFMOTO Aspar', riderName: 'D. Alonso', shortCode: 'CFM', nationality: 'CO', primaryHex: '#0d9488', secondaryHex: '#0f172a', accentHex: '#22d3ee', number: 80, face: { skinHex: '#dfae7c', hairHex: '#1c1917', beard: false, browStyle: 1 } },
  { id: 'm3-esteban', name: 'CFMOTO Aspar', riderName: 'J. Esteban', shortCode: 'CFM', nationality: 'ES', primaryHex: '#0f766e', secondaryHex: '#0f172a', accentHex: '#f8fafc', number: 78, face: { skinHex: '#ebba8b', hairHex: '#292524', beard: false, browStyle: 0 } },
  { id: 'm3-holgado', name: 'Red Bull Tech3', riderName: 'D. Holgado', shortCode: 'RT3', nationality: 'ES', primaryHex: '#e11d48', secondaryHex: '#18181b', accentHex: '#f8fafc', number: 96, face: { skinHex: '#f1c292', hairHex: '#3b2618', beard: false, browStyle: 2 } },
  { id: 'm3-roulstone', name: 'Red Bull Tech3', riderName: 'J. Roulstone', shortCode: 'RT3', nationality: 'AU', primaryHex: '#be123c', secondaryHex: '#18181b', accentHex: '#fda4af', number: 12, face: { skinHex: '#f6d1aa', hairHex: '#a16207', beard: false, browStyle: 1 } },
  { id: 'm3-ortola', name: 'MT Helmets MSI', riderName: 'I. Ortola', shortCode: 'MSI', nationality: 'ES', primaryHex: '#2563eb', secondaryHex: '#0f172a', accentHex: '#facc15', number: 48, face: { skinHex: '#e5b27f', hairHex: '#1c1917', beard: false, browStyle: 0 } },
  { id: 'm3-yamanaka', name: 'MT Helmets MSI', riderName: 'R. Yamanaka', shortCode: 'MSI', nationality: 'JP', primaryHex: '#1d4ed8', secondaryHex: '#0f172a', accentHex: '#f8fafc', number: 6, face: { skinHex: '#f0c8a0', hairHex: '#0f172a', beard: false, browStyle: 2 } },
  { id: 'm3-veijer', name: 'Intact GP', riderName: 'C. Veijer', shortCode: 'IGP', nationality: 'NL', primaryHex: '#0284c7', secondaryHex: '#111827', accentHex: '#f8fafc', number: 95, face: { skinHex: '#f5cfa7', hairHex: '#b45309', beard: false, browStyle: 1 } },
  { id: 'm3-suzuki', name: 'Intact GP', riderName: 'T. Suzuki', shortCode: 'IGP', nationality: 'JP', primaryHex: '#0369a1', secondaryHex: '#111827', accentHex: '#bef264', number: 24, face: { skinHex: '#efc69e', hairHex: '#0f172a', beard: false, browStyle: 0 } },
  { id: 'm3-piqueras', name: 'Leopard Racing', riderName: 'A. Piqueras', shortCode: 'LPD', nationality: 'ES', primaryHex: '#06b6d4', secondaryHex: '#09090b', accentHex: '#facc15', number: 36, face: { skinHex: '#ebb888', hairHex: '#27272a', beard: false, browStyle: 2 } },
  { id: 'm3-fernandez', name: 'Leopard Racing', riderName: 'A. Fernandez', shortCode: 'LPD', nationality: 'ES', primaryHex: '#0891b2', secondaryHex: '#09090b', accentHex: '#f8fafc', number: 31, face: { skinHex: '#e3b07c', hairHex: '#1c1917', beard: false, browStyle: 1 } },
  { id: 'm3-rueda', name: 'Red Bull Ajo', riderName: 'J. Rueda', shortCode: 'AJO', nationality: 'ES', primaryHex: '#f97316', secondaryHex: '#1e1b4b', accentHex: '#facc15', number: 99, face: { skinHex: '#e8b684', hairHex: '#171717', beard: false, browStyle: 0 } },
  { id: 'm3-zurutuza', name: 'Red Bull Ajo', riderName: 'X. Zurutuza', shortCode: 'AJO', nationality: 'ES', primaryHex: '#ea580c', secondaryHex: '#1e1b4b', accentHex: '#f8fafc', number: 85, face: { skinHex: '#f0c090', hairHex: '#3b2618', beard: false, browStyle: 2 } },
  { id: 'm3-kelso', name: 'BOE Motorsports', riderName: 'J. Kelso', shortCode: 'BOE', nationality: 'AU', primaryHex: '#16a34a', secondaryHex: '#111827', accentHex: '#f8fafc', number: 66, face: { skinHex: '#f6d1aa', hairHex: '#92400e', beard: false, browStyle: 1 } },
  { id: 'm3-munoz', name: 'BOE Motorsports', riderName: 'D. Munoz', shortCode: 'BOE', nationality: 'ES', primaryHex: '#15803d', secondaryHex: '#111827', accentHex: '#bef264', number: 64, face: { skinHex: '#e0ad79', hairHex: '#1c1917', beard: false, browStyle: 0 } },
  { id: 'm3-lunetta', name: 'SIC58 Squadra', riderName: 'L. Lunetta', shortCode: 'SIC', nationality: 'IT', primaryHex: '#dc2626', secondaryHex: '#f8fafc', accentHex: '#18181b', number: 58, face: { skinHex: '#ebb888', hairHex: '#27272a', beard: false, browStyle: 2 } },
  { id: 'm3-farioli', name: 'SIC58 Squadra', riderName: 'F. Farioli', shortCode: 'SIC', nationality: 'IT', primaryHex: '#b91c1c', secondaryHex: '#f8fafc', accentHex: '#facc15', number: 7, face: { skinHex: '#e8b684', hairHex: '#3b2618', beard: false, browStyle: 1 } },
  { id: 'm3-furusato', name: 'Honda Team Asia', riderName: 'T. Furusato', shortCode: 'HTA', nationality: 'JP', primaryHex: '#ef4444', secondaryHex: '#1e293b', accentHex: '#f8fafc', number: 72, face: { skinHex: '#f0c8a0', hairHex: '#0f172a', beard: false, browStyle: 0 } },
  { id: 'm3-aditama', name: 'Honda Team Asia', riderName: 'F. Aditama', shortCode: 'HTA', nationality: 'ID', primaryHex: '#c2410c', secondaryHex: '#1e293b', accentHex: '#fde047', number: 93, face: { skinHex: '#cf9b68', hairHex: '#0f172a', beard: false, browStyle: 2 } },
  { id: 'm3-bertelle', name: 'Snipers Team', riderName: 'M. Bertelle', shortCode: 'SNP', nationality: 'IT', primaryHex: '#4f46e5', secondaryHex: '#0f172a', accentHex: '#f43f5e', number: 18, face: { skinHex: '#ebb888', hairHex: '#292524', beard: false, browStyle: 1 } },
  { id: 'm3-almansa', name: 'Snipers Team', riderName: 'M. Almansa', shortCode: 'SNP', nationality: 'ES', primaryHex: '#4338ca', secondaryHex: '#0f172a', accentHex: '#f8fafc', number: 22, face: { skinHex: '#e3b07c', hairHex: '#1c1917', beard: false, browStyle: 0 } },
  { id: 'm3-nepa', name: 'MTA Racing', riderName: 'S. Nepa', shortCode: 'MTA', nationality: 'IT', primaryHex: '#7c3aed', secondaryHex: '#111827', accentHex: '#facc15', number: 82, face: { skinHex: '#e9b887', hairHex: '#27272a', beard: false, browStyle: 2 } },
  { id: 'm3-ogden', name: 'MLav Racing', riderName: 'S. Ogden', shortCode: 'MLV', nationality: 'GB', primaryHex: '#ca8a04', secondaryHex: '#09090b', accentHex: '#f8fafc', number: 19, face: { skinHex: '#f5cfa7', hairHex: '#78350f', beard: false, browStyle: 1 } },
];

export const CLASS_RIDER_ROSTERS: Record<BikeClassId, TeamLivery[]> = {
  moto3: MOTO3_RIDERS,
  moto2: MOTO2_RIDERS,
  motogp: MOTOGP_RIDERS,
};

export function getClassLiveries(bikeClass: BikeClassId): TeamLivery[] {
  return CLASS_RIDER_ROSTERS[bikeClass] ?? MOTOGP_RIDERS;
}

export function getLiveryById(id: string, bikeClass?: BikeClassId): TeamLivery {
  if (bikeClass) {
    const classMatch = getClassLiveries(bikeClass).find((l) => l.id === id);
    if (classMatch) return classMatch;
  }
  for (const roster of [MOTOGP_RIDERS, MOTO2_RIDERS, MOTO3_RIDERS]) {
    const match = roster.find((l) => l.id === id);
    if (match) return match;
  }
  return getClassLiveries(bikeClass ?? 'motogp')[0];
}

// Backwards-compatible alias for MotoGP premier grid
export const TEAM_LIVERIES: TeamLivery[] = MOTOGP_RIDERS;

export type SurfaceType = 'asphalt' | 'curb' | 'gravel' | 'grass';

export interface RainPatch {
  id: string;
  s: number;
  lateralCenter: number;
  radiusS: number;
  radiusLat: number;
  intensity: number; // 0..1
  x: number;
  z: number;
  heading: number;
}

export interface SolidCollider {
  id: string;
  kind: 'tribun' | 'building' | 'wall' | 'pillar';
  x: number;
  z: number;
  halfX: number;
  halfZ: number;
  cosH: number;
  sinH: number;
}

export interface RiderInput {
  throttle: number; // 0..1
  brake: number; // 0..1
  steer: number; // -1..1 (negative = left, positive = right)
  boost: boolean;
}

export interface BikeState {
  id: string;
  name: string;
  livery: TeamLivery;
  bikeClass: BikeClassId;
  isPlayer: boolean;
  isRemote: boolean;
  isAi: boolean;

  // World kinematics
  x: number;
  z: number;
  heading: number; // radians, 0 = +Z, PI/2 = +X
  speed: number; // m/s
  leanAngle: number; // radians (-maxLean .. +maxLean)
  steerVisual: number; // radians
  wheelSpin: number; // radians

  // Powertrain & KERS
  gear: number; // 1..6
  rpm: number; // 3000..16500
  boostFuel: number; // 0..100
  isBoosting: boolean;
  inSlipstream: boolean;
  surface: SurfaceType;
  onRainPatch?: boolean;

  // Race progress
  trackS: number; // 0..trackLength
  trackOffset: number; // lateral offset from centerline
  lap: number; // 1..totalLaps
  checkpointMask: number; // bitmask of passed sectors 0..3
  totalProgress: number; // (lap - 1) * trackLength + trackS
  finished: boolean;
  finishTimeMs: number;
  currentLapStartMs: number;
  bestLapMs: number | null;
  topSpeedKmh: number;
  rank: number; // 1..N

  // Crash & Recovery state
  crashed: boolean;
  crashType: 'lowside' | 'highside' | null;
  crashAge: number; // seconds elapsed since crash trigger
  crashTimer: number; // seconds remaining before auto-recovery
  crashSlideYaw: number; // spin offset while sliding
  crashDirSign: 1 | -1; // tip-over side
  bikeBounceY: number; // vertical bounce height of bike chassis during high-side
  riderCrashX: number; // rider root-local offset during crash fall/ragdoll
  riderCrashY: number;
  riderCrashZ: number;
  riderCrashVx: number;
  riderCrashVy: number;
  riderCrashVz: number;
  riderCrashSpinX: number;
  riderCrashSpinY: number;
  riderCrashSpinZ: number;
  recoveryGraceTimer: number; // post-reset invulnerability window

  // AI parameters
  aiTargetOffset: number;
  aiPassOffset: number;
  aiPaceFactor: number;
  aiAggression: number;

  // Network interpolation targets for remote riders
  netTargetX?: number;
  netTargetZ?: number;
  netTargetHeading?: number;
  netTargetLean?: number;
  netTargetSpeed?: number;
}

export interface LeaderboardEntry {
  id: string;
  rank: number;
  name: string;
  color: string;
  liveryId: string;
  nationality: NationalityCode;
  isPlayer: boolean;
  crashed: boolean;
}

export interface HudSnapshot {
  sessionType: SessionType;
  preRaceActive: boolean;
  circuitName: string;
  localLiveryId: string;
  speedKmh: number;
  gear: number;
  rpmRatio: number;
  boostFuel: number;
  isBoosting: boolean;
  lap: number;
  totalLaps: number;
  rank: number;
  totalRiders: number;
  raceTimeMs: number;
  currentLapMs: number;
  bestLapMs: number | null;
  countdownStage: number; // 3, 2, 1, 0 (GO), -1 (active)
  surface: SurfaceType;
  wrongWay: boolean;
  crashed: boolean;
  crashRecoverSec: number;
  bikeClass: BikeClassId;
  weatherPhase: WeatherPhase;
  rainIntensity: number;
  onRainPatch: boolean;
  rainPatches: Array<{ id: string; x: number; z: number; radius: number }>;
  leaderboard: LeaderboardEntry[];
  minimapRiders: Array<{
    id: string;
    x: number;
    z: number;
    color: string;
    isPlayer: boolean;
  }>;
}

export interface RaceResultEntry {
  id: string;
  name: string;
  livery: TeamLivery;
  rank: number;
  finishTimeMs: number;
  bestLapMs: number | null;
  topSpeedKmh: number;
  isPlayer: boolean;
  isAi: boolean;
}

export interface LanPlayerInfo {
  id: string;
  name: string;
  liveryId: string;
  ready: boolean;
  isHost: boolean;
}

export interface LanRoomState {
  code: string;
  hostId: string;
  status: 'lobby' | 'racing' | 'finished';
  totalLaps: number;
  bikeClass: BikeClassId;
  circuitId: CircuitId;
  fillWithAi: boolean;
  players: LanPlayerInfo[];
}

export interface RiderNetState {
  id: string;
  x: number;
  z: number;
  heading: number;
  speed: number;
  leanAngle: number;
  gear: number;
  rpm: number;
  lap: number;
  totalProgress: number;
  finished: boolean;
  finishTimeMs: number;
  bestLapMs: number | null;
  topSpeedKmh: number;
  isBoosting: boolean;
  crashed?: boolean;
}
