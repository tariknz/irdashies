/**
 * Car tachometer data utilities
 *
 * Data sourced from lovely-car-data repository:
 * https://github.com/Lovely-Sim-Racing/lovely-car-data
 *
 * This project provides comprehensive car telemetry data for various racing games,
 * including RPM thresholds, LED configurations, and shift point information.
 *
 * Car data sourced from lovely-car-data repository and bundled in src/frontend/assets/data/cars-bundle.json
 * Update with: npm run fetch-lovely-data
 */

import carDataBundle from '../assets/data/cars-bundle.json';
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

/**
 * Map of car ID variations to normalized car ID for lookup
 * This helps handle cases where the car ID in the game might differ slightly from the data
 */
let carIdNormalizations: Record<string, string> | null = null;

/**
 * Initialize the car ID normalization map
 * Maps various car ID formats to the canonical ID from the bundle
 */
function initializeNormalizations(): void {
  if (carIdNormalizations !== null) return;

  carIdNormalizations = {};
  const bundle = carDataBundle as CarDataBundleType;

  for (const carId of Object.keys(bundle.cars)) {
    // Store original
    carIdNormalizations[carId] = carId;

    // Store lowercase
    carIdNormalizations[carId.toLowerCase()] = carId;

    // Store normalized (lowercase, no special chars)
    const normalized = carId.toLowerCase().replace(/[^a-z0-9]/g, '');
    carIdNormalizations[normalized] = carId;
  }
}

/**
 * Normalizes a car ID to find the matching bundled data
 * @param carPath The car path from the game
 * @returns The normalized car ID or null if not found
 */
function normalizeCarId(carPath: string): string | null {
  initializeNormalizations();

  if (!carIdNormalizations) return null;

  // Try the variations in order of likelihood
  const variations = [
    carPath,
    carPath.toLowerCase(),
    carPath.toLowerCase().replace(/[^a-z0-9]/g, ''),
  ];

  for (const variation of variations) {
    if (variation in carIdNormalizations) {
      return carIdNormalizations[variation];
    }
  }

  return null;
}

/**
 * Loads car-specific tachometer data from the bundled data
 * This loads instantly from the bundled data without any network requests
 * @param carPath The car path from the game
 * @param _gameId The current game identifier (ignored, LMU cars are looked up with loadLmuCarData)
 * @returns The car data or null if not found
 */
export const loadCarData = (
  carPath: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _gameId?: string
): CarData | null => {
  try {
    const bundle = carDataBundle as CarDataBundleType;
    const normalizedId = normalizeCarId(carPath);

    if (normalizedId && normalizedId in bundle.cars) {
      return bundle.cars[normalizedId];
    }

    return null;
  } catch (error) {
    logger.warn('Failed to load car data:', error);
    return null;
  }
};

const LMU_SERIES = /:\s*([A-Za-z]+)\d*\s*$/;

let lmuCarDataBundle: CarDataBundleType | null = null;
let lmuCarBundleLoad: Promise<void> | null = null;
let lmuCarKeys: Map<string, string> | null = null;
const lmuLoadListeners = new Set<() => void>();

export const isLmuCarBundleLoaded = (): boolean => lmuCarDataBundle !== null;

export const subscribeLmuCarBundle = (listener: () => void): (() => void) => {
  lmuLoadListeners.add(listener);
  return () => {
    lmuLoadListeners.delete(listener);
  };
};

export const loadLmuCarBundle = (): Promise<void> => {
  if (lmuCarDataBundle) return Promise.resolve();
  lmuCarBundleLoad ??= import('../assets/data/lmu-cars-bundle.json')
    .then((module) => {
      lmuCarDataBundle = module.default as CarDataBundleType;
      lmuLoadListeners.forEach((listener) => listener());
    })
    .catch((error) => {
      lmuCarBundleLoad = null;
      logger.warn('Failed to load LMU car data:', error);
    });
  return lmuCarBundleLoad;
};

const normalizeLmuName = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '');

function findLmuCarKey(name: string): string | undefined {
  if (!lmuCarDataBundle) return undefined;
  if (!lmuCarKeys) {
    const keys = new Map<string, string>();
    const cars = lmuCarDataBundle.cars;
    for (const key of Object.keys(cars)) {
      keys.set(normalizeLmuName(key), key);
    }
    for (const [key, car] of Object.entries(cars)) {
      const name = normalizeLmuName(car.carName);
      if (!keys.has(name)) keys.set(name, key);
    }
    lmuCarKeys = keys;
  }
  return lmuCarKeys.get(normalizeLmuName(name));
}

export const loadLmuCarData = (
  carModel: string | undefined,
  entryName?: string
): CarData | null => {
  if (!carModel || !lmuCarDataBundle) return null;
  const series = LMU_SERIES.exec(entryName ?? '')?.[1];
  const key =
    (series && findLmuCarKey(`${carModel} ${series}`)) ||
    findLmuCarKey(carModel);
  return key ? lmuCarDataBundle.cars[key] : null;
};

/**
 * Gets the appropriate gear key for the car data
 * @param gear Current gear number
 * @returns Gear key string
 */
export const getGearKey = (gear: number): string => {
  if (gear === 0) return 'N';
  if (gear === -1) return 'R';
  return gear.toString();
};

/**
 * Gets the list of all available cars from the bundled data
 * @returns Array of car IDs and names
 */
export const getAvailableCars = (): {
  carId: string;
  carName: string;
  ledNumber: number;
  ledRpm: object[];
}[] => {
  const bundle = carDataBundle as CarDataBundleType;
  return Object.values(bundle.cars).map((car) => ({
    carId: car.carId,
    carName: car.carName,
    ledNumber: car.ledNumber,
    ledRpm: car.ledRpm,
  }));
};
