import { CIRCUIT_SPECS } from './trackMath';
import {
  BIKE_CLASSES,
  type BikeClassId,
  type CircuitId,
  COUNTRY_NAMES,
  type RaceResultEntry,
  type SessionType,
  type TeamLivery,
  type WeatherPhase,
} from './types';

export interface RaceCommentary {
  caster: string;
  headline: string;
  lines: string[];
}

export interface MinimalVoiceInfo {
  name: string;
  lang: string;
  default?: boolean;
}

const MALE_VOICE_HINTS =
  /\b(male|daniel|david|mark|alex|arthur|george|guy|ryan|andrew|brian|fred|aaron|thomas|oliver|james|liam|christopher|eric|roger|steffan|oliver|en-gb.*male|en-us.*male)\b/i;

const FEMALE_VOICE_HINTS =
  /\b(female|samantha|victoria|karen|moira|tessa|kate|serena|susan|zira|hazel|aria|jenny|libby|sonia|natasha|fiona|allison|ava|nicky|emily|claire|veena|rishi.*female|google us english$)\b/i;

export function pickMaleEnglishVoice<T extends MinimalVoiceInfo>(voices: T[]): T | null {
  if (!voices || voices.length === 0) return null;
  const englishVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  const pool = englishVoices.length > 0 ? englishVoices : voices;

  let bestVoice: T | null = null;
  let bestScore = -Infinity;

  for (const voice of pool) {
    let score = 0;
    const name = voice.name.toLowerCase();
    if (voice.lang.toLowerCase().startsWith('en-gb')) score += 15;
    else if (voice.lang.toLowerCase().startsWith('en-us')) score += 12;
    else if (voice.lang.toLowerCase().startsWith('en')) score += 8;

    if (MALE_VOICE_HINTS.test(name)) score += 60;
    if (FEMALE_VOICE_HINTS.test(name)) score -= 80;
    if (name.includes('natural') || name.includes('online')) score += 6;
    if (voice.default) score += 2;

    if (score > bestScore) {
      bestScore = score;
      bestVoice = voice;
    }
  }

  return bestVoice;
}

export function buildPreRaceCommentary(params: {
  circuitId: CircuitId;
  bikeClass: BikeClassId;
  sessionType: SessionType;
  playerLivery: TeamLivery;
  playerGridPos: number;
  totalRiders: number;
  weatherPhase?: WeatherPhase;
}): RaceCommentary {
  const circuit = CIRCUIT_SPECS[params.circuitId] ?? CIRCUIT_SPECS.lusail;
  const classSpec = BIKE_CLASSES[params.bikeClass];
  const country = COUNTRY_NAMES[params.playerLivery.nationality] ?? 'World';
  const rider = params.playerLivery.riderName;
  const num = params.playerLivery.number;
  const team = params.playerLivery.name;

  if (params.sessionType === 'qualifying') {
    return {
      caster: 'Marco Bellini · Trackside Feed',
      headline: `Qualifying Time Attack at ${circuit.name}`,
      lines: [
        `Alright race fans, welcome trackside in ${circuit.country}. One flying lap, ${circuit.corners} demanding corners, and every tenth of a second counts today.`,
        `Number ${num}, ${rider} representing ${country} on the ${team} ${classSpec.label} machine, rolls onto clear asphalt — let's see what kind of pace he puts down.`,
      ],
    };
  }

  const gridPhrase =
    params.playerGridPos === 1
      ? `is right on pole position leading the field into Turn 1`
      : params.playerGridPos <= 3
      ? `launches right from the front row in P${params.playerGridPos}`
      : params.playerGridPos <= 9
      ? `starts inside the top ten from P${params.playerGridPos}`
      : `has real work to do fighting through traffic from P${params.playerGridPos} out of ${params.totalRiders} bikes`;

  return {
    caster: 'Marco Bellini · Trackside Feed',
    headline: `Grid Ready at ${circuit.name}`,
    lines: [
      `Good afternoon everybody, we are live from ${circuit.name} in ${circuit.country}. The marshals have cleared the grid and are waving the green flags — clear skies right now, though radar shows random rain patches could hit the track later.`,
      `Keep a close eye on number ${num}, ${rider} from ${country} for ${team} — he ${gridPhrase}. Engines are warmed up, lights are about to go out in this ${classSpec.label} showdown.`,
    ],
  };
}

export function buildPostRaceCommentary(params: {
  circuitId: CircuitId;
  bikeClass: BikeClassId;
  sessionType: SessionType;
  results: RaceResultEntry[];
  weatherHadRain: boolean;
  careerOutcome?: {
    pointsEarned: number;
    seasonRank: number;
    promotedTo: BikeClassId | null;
    wonChampionship: boolean;
  } | null;
}): RaceCommentary {
  const circuit = CIRCUIT_SPECS[params.circuitId] ?? CIRCUIT_SPECS.lusail;
  const classSpec = BIKE_CLASSES[params.bikeClass];
  const winner = params.results[0];
  const second = params.results[1];
  const player = params.results.find((r) => r.isPlayer) ?? winner;

  if (params.sessionType === 'qualifying') {
    const isPole = player && player.rank === 1;
    return {
      caster: 'Marco Bellini · Parc Fermé',
      headline: isPole
        ? `Pole Position for #${player.livery.number} ${player.name}!`
        : `Qualifying Locked — P${player?.rank ?? 1} on the Grid`,
      lines: [
        isPole
          ? `What an incredible flying lap by ${player.name} on the ${player.livery.name} bike, clocking ${player.topSpeedKmh} kilometers an hour around ${circuit.name}!`
          : `${winner.name} grabs pole at ${circuit.name}, and number ${player.livery.number} ${player.name} locks in P${player.rank} for the ${classSpec.label} main race.`,
        `The twenty-two bike starting grid is officially set — get ready for lights out.`,
      ],
    };
  }

  const weatherLine = params.weatherHadRain
    ? `Those sudden rain patches turned the racing line into a real test of nerve, and everybody had to adapt fast on wet tarmac.`
    : `Pure flat-out dry pace from start to finish across all ${circuit.corners} corners of ${circuit.name}.`;

  let finishHeadline = `${winner?.name ?? 'Champion'} Wins in ${circuit.country}!`;
  let playerSummary = '';

  if (player?.rank === 1) {
    finishHeadline = `What a Victory for #${player.livery.number} ${player.name}!`;
    playerSummary = `Man, what a ride by ${player.name} for ${COUNTRY_NAMES[player.livery.nationality]}, hitting ${player.topSpeedKmh} kilometers an hour${
      second ? ` and holding off ${second.name} to take the checkered flag` : ''
    }! ${weatherLine}`;
  } else if (player && player.rank <= 3) {
    finishHeadline = `Parc Fermé Podium — P${player.rank} for ${player.name}!`;
    playerSummary = `${winner.name} takes the win today, while ${player.name} brings ${player.livery.name} straight onto the podium peaking at ${player.topSpeedKmh} kilometers an hour. ${weatherLine}`;
  } else if (player) {
    playerSummary = `${winner?.name} crosses the line first at ${circuit.name}, and number ${player.livery.number} ${player.name} brings it home P${player.rank} at ${player.topSpeedKmh} kilometers an hour. ${weatherLine}`;
  }

  let careerLine = '';
  if (params.careerOutcome) {
    if (params.careerOutcome.promotedTo) {
      careerLine = ` Huge news in the paddock — finishing P${params.careerOutcome.seasonRank} out of 22 locks in his promotion to ${BIKE_CLASSES[params.careerOutcome.promotedTo].label}!`;
    } else if (params.careerOutcome.wonChampionship) {
      careerLine = ` History made right here — he is officially your MotoGP World Champion!`;
    } else {
      careerLine = ` Another ${params.careerOutcome.pointsEarned} championship points on the board puts him P${params.careerOutcome.seasonRank} in the season standings.`;
    }
  }

  return {
    caster: 'Marco Bellini · Parc Fermé',
    headline: finishHeadline,
    lines: [`${playerSummary}${careerLine}`],
  };
}

let activeSpeechId = 0;
let activeTimerId: number | null = null;
let activeVoiceChangeCleanup: (() => void) | null = null;

function clearActiveCommentaryTimers(): void {
  if (activeTimerId !== null && typeof window !== 'undefined') {
    window.clearTimeout(activeTimerId);
    activeTimerId = null;
  }
  if (activeVoiceChangeCleanup) {
    activeVoiceChangeCleanup();
    activeVoiceChangeCleanup = null;
  }
}

export function estimateCommentaryDurationMs(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  // Natural male broadcaster cadence (~145 wpm => ~415ms per word)
  return Math.max(3600, Math.min(10500, Math.round(words * 400 + 600)));
}

export function speakCommentaryText(
  text: string,
  muted: boolean,
  options?: {
    onDone?: () => void;
    fallbackMs?: number;
  },
): void {
  stopCommentarySpeech();
  const sessionId = ++activeSpeechId;
  const estMs = options?.fallbackMs ?? estimateCommentaryDurationMs(text);

  const finish = () => {
    if (sessionId !== activeSpeechId) return;
    clearActiveCommentaryTimers();
    options?.onDone?.();
  };

  if (typeof window === 'undefined') {
    options?.onDone?.();
    return;
  }

  // When muted or without SpeechSynthesis support, hold pure scene briefly then continue
  if (muted || !('speechSynthesis' in window)) {
    activeTimerId = window.setTimeout(finish, Math.min(3400, estMs));
    return;
  }

  try {
    const synth = window.speechSynthesis;
    synth.cancel();

    const startTime = performance.now();
    // Safety timeout guarantees scene never freezes if headless/OS TTS stalls
    activeTimerId = window.setTimeout(finish, estMs + 1800);

    const launchUtterance = () => {
      if (sessionId !== activeSpeechId) return;
      const utter = new SpeechSynthesisUtterance(text);
      const maleVoice = pickMaleEnglishVoice(synth.getVoices());
      if (maleVoice) {
        utter.voice = maleVoice;
        utter.lang = maleVoice.lang;
      } else {
        utter.lang = 'en-GB';
      }
      utter.pitch = 0.84; // Rich, humanized male baritone
      utter.rate = 0.96; // Conversational natural broadcast pacing
      utter.volume = 0.92;

      utter.onend = () => {
        if (sessionId !== activeSpeechId) return;
        const elapsed = performance.now() - startTime;
        // If TTS actually played out, finish right as the male voice ends;
        // if an empty software synth snapped closed in <600ms, hold scenic preview briefly.
        if (elapsed >= 600) {
          finish();
        } else {
          clearActiveCommentaryTimers();
          activeTimerId = window.setTimeout(finish, Math.max(1200, Math.min(3400, estMs) - elapsed));
        }
      };

      utter.onerror = () => {
        if (sessionId !== activeSpeechId) return;
        clearActiveCommentaryTimers();
        const elapsed = performance.now() - startTime;
        activeTimerId = window.setTimeout(finish, Math.max(800, Math.min(3400, estMs) - elapsed));
      };

      synth.speak(utter);
    };

    const currentVoices = synth.getVoices();
    if (currentVoices.length > 0) {
      launchUtterance();
    } else if (typeof synth.addEventListener === 'function') {
      let launched = false;
      const onVoices = () => {
        if (launched || sessionId !== activeSpeechId) return;
        launched = true;
        cleanup();
        launchUtterance();
      };
      const voiceTimeout = window.setTimeout(() => {
        if (launched || sessionId !== activeSpeechId) return;
        launched = true;
        cleanup();
        launchUtterance();
      }, 90);
      const cleanup = () => {
        window.clearTimeout(voiceTimeout);
        synth.removeEventListener('voiceschanged', onVoices);
      };
      activeVoiceChangeCleanup = cleanup;
      synth.addEventListener('voiceschanged', onVoices);
    } else {
      launchUtterance();
    }
  } catch {
    clearActiveCommentaryTimers();
    activeTimerId = window.setTimeout(finish, Math.min(3400, estMs));
  }
}

export function stopCommentarySpeech(): void {
  activeSpeechId++;
  clearActiveCommentaryTimers();
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // Ignore
  }
}
