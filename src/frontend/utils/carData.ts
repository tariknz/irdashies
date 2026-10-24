/**
 * Car tachometer data utilities
 *
 * Data sourced from lovely-car-data repository:
 * https://github.com/Lovely-Sim-Racing/lovely-car-data
 *
 * Bundled per sim (cars-bundle.json / lmu-cars-bundle.json).
 * Update with: npm run fetch-lovely-data
 */

import carDataBundle from '../assets/data/cars-bundle.json';
import lmuCarDataBundle from '../assets/data/lmu-cars-bundle.json';
import type { ActiveSimulator } from '@irdashies/types';
import logger from '@irdashies/utils/logger';

export interface CarData {
  carName: string;
  carId: string;
  carClass: string;
  ledNumber: number;
  redlineBlinkInterval: number;
  ledColor: string[];
  ledRpm: Record<string, number[]>[];
}

interface CarDataBundleType {
  version: string;
  timestamp: number;
  cars: Record<string, CarData>;
}

type GameId = ActiveSimulator | string;

const bundles: Record<string, CarDataBundleType> = {
  iracing: carDataBundle as CarDataBundleType,
  lmu: lmuCarDataBundle as CarDataBundleType,
};

/** Per-game map of normalized lookup key → bundle car key */
const normalizationsByGame: Record<string, Record<string, string> | null> = {
  iracing: null,
  lmu: null,
};

/**
 * Strip punctuation and WEC class prefixes so LMU vehFilename / vehicleModel
 * line up with lovely-car-data names (e.g. ferrari_296_gt3 ↔ Ferrari 296 LMGT3).
 */
export function normalizeLmuCarKey(value: string): string {
  let s = value.toLowerCase();
  s = s.replace(/\blmgt3\b/g, 'gt3');
  s = s.replace(/\blmgte\b/g, 'gte');
  s = s.replace(/\blmgt\b/g, 'gt');
  s = s.replace(/[^a-z0-9]/g, '');
  // "Porsche 911 GT3 R LMGT3" → ...gt3rgt3 after class rewrite; drop the
  // trailing duplicate class token so it matches porsche_911_gt3_r.
  if (s.endsWith('gt3') && s.slice(0, -3).includes('gt3')) {
    s = s.slice(0, -3);
  } else if (s.endsWith('gte') && s.slice(0, -3).includes('gte')) {
    s = s.slice(0, -3);
  }
  return s;
}

function normalizeIracingCarKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeKey(gameId: string, value: string): string {
  return gameId === 'lmu'
    ? normalizeLmuCarKey(value)
    : normalizeIracingCarKey(value);
}

function isLikelyLmuTeamEntry(bundleKey: string, car: CarData): boolean {
  if (/^(gt3|hyper|lmp2|lmp3|gte)-/i.test(bundleKey)) return true;
  if (/\b(20\d{2})\b/.test(car.carId)) return true;
  return /\b(team|racing|motorsport|competition|corse)\b/i.test(car.carId);
}

function preferLmuAlias(
  existingKey: string,
  existingCar: CarData,
  candidateKey: string,
  candidateCar: CarData
): boolean {
  const existingTeam = isLikelyLmuTeamEntry(existingKey, existingCar);
  const candidateTeam = isLikelyLmuTeamEntry(candidateKey, candidateCar);
  if (existingTeam !== candidateTeam) return !candidateTeam;
  // Prefer the shorter display name (base chassis over "… Evo" / year variants)
  return candidateCar.carName.length < existingCar.carName.length;
}

function initializeNormalizations(gameId: string): void {
  if (normalizationsByGame[gameId] !== null && normalizationsByGame[gameId] !== undefined) {
    return;
  }

  const bundle = bundles[gameId];
  if (!bundle) {
    normalizationsByGame[gameId] = {};
    return;
  }

  const map: Record<string, string> = {};
  const register = (alias: string, bundleKey: string, car: CarData) => {
    if (!alias) return;
    const existing = map[alias];
    if (existing === undefined) {
      map[alias] = bundleKey;
      return;
    }
    if (existing === bundleKey) return;
    if (gameId !== 'lmu') return;
    const existingCar = bundle.cars[existing];
    if (
      existingCar &&
      preferLmuAlias(existing, existingCar, bundleKey, car)
    ) {
      map[alias] = bundleKey;
    }
  };

  for (const [bundleKey, car] of Object.entries(bundle.cars)) {
    register(bundleKey, bundleKey, car);
    register(bundleKey.toLowerCase(), bundleKey, car);
    register(normalizeKey(gameId, bundleKey), bundleKey, car);
    register(car.carId, bundleKey, car);
    register(car.carId.toLowerCase(), bundleKey, car);
    register(normalizeKey(gameId, car.carId), bundleKey, car);
    register(normalizeKey(gameId, car.carName), bundleKey, car);
  }

  normalizationsByGame[gameId] = map;
}

function resolveCarKey(
  gameId: string,
  candidates: string[]
): string | null {
  initializeNormalizations(gameId);
  const map = normalizationsByGame[gameId];
  if (!map) return null;

  for (const raw of candidates) {
    if (!raw) continue;
    const variations = [
      raw,
      raw.toLowerCase(),
      normalizeKey(gameId, raw),
    ];
    for (const variation of variations) {
      if (variation in map) return map[variation];
    }
  }

  // LMU: allow prefix match for Evo / year suffixes (mclaren_720s_gt3 → …gt3evo)
  if (gameId === 'lmu') {
    const norms = candidates
      .filter(Boolean)
      .map((c) => normalizeKey(gameId, c))
      .filter((n) => n.length >= 6);
    let best: { key: string; score: number } | null = null;
    for (const [alias, bundleKey] of Object.entries(map)) {
      for (const q of norms) {
        if (alias === q) continue;
        if (!alias.startsWith(q) && !q.startsWith(alias)) continue;
        const score = Math.min(alias.length, q.length);
        if (!best || score > best.score) {
          best = { key: bundleKey, score };
        }
      }
    }
    return best?.key ?? null;
  }

  return null;
}

function resolveGameId(gameId?: GameId | null): string {
  if (gameId === 'lmu') return 'lmu';
  return 'iracing';
}

/**
 * Loads car-specific tachometer data from the bundled data for the active sim.
 * @param carPath CarPath from the session (iRacing path / LMU vehFilename)
 * @param gameId Active simulator id
 * @param aliases Extra names to try (LMU vehicleModel / CarScreenName)
 */
export const loadCarData = (
  carPath: string,
  gameId?: GameId | null,
  aliases?: readonly string[] | null
): CarData | null => {
  try {
    const game = resolveGameId(gameId);
    const bundle = bundles[game];
    if (!bundle) return null;

    const candidates = [
      carPath,
      ...(aliases ?? []).filter((a): a is string => !!a && a !== carPath),
    ];
    const key = resolveCarKey(game, candidates);

    if (key && key in bundle.cars) {
      return bundle.cars[key];
    }

    return null;
  } catch (error) {
    logger.warn('Failed to load car data:', error);
    return null;
  }
};

export const getGearKey = (gear: number): string => {
  if (gear === 0) return 'N';
  if (gear === -1) return 'R';
  return gear.toString();
};

/**
 * Cars available for custom shift-point pickers for the given sim.
 * Defaults to iRacing when no sim is active (settings opened idle).
 */
export const getAvailableCars = (
  gameId?: GameId | null
): {
  carId: string;
  carName: string;
  ledNumber: number;
  ledRpm: object[];
}[] => {
  const game = resolveGameId(gameId);
  const bundle = bundles[game];
  if (!bundle) return [];

  return Object.values(bundle.cars).map((car) => ({
    carId: car.carId,
    carName: car.carName,
    ledNumber: car.ledNumber,
    ledRpm: car.ledRpm,
  }));
};
