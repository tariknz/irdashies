/**
 * Car tachometer data utilities
 * 
 * Data sourced from lovely-car-data repository:
 * https://github.com/Lovely-Sim-Racing/lovely-car-data
 * 
 * This project provides comprehensive car telemetry data for various racing games,
 * including RPM thresholds, LED configurations, and shift point information.
 * 
 * Car data sourced from lovely-car-data repository and bundled in src/data/cars-bundle.json
 * Update with: npm run fetch-lovely-data
 */

import carDataBundle from '../../data/cars-bundle.json';

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
    carPath.toLowerCase().replace(/[^a-z0-9]/g, '')
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
 * @param _gameId The current game identifier (ignored, only iRacing data is bundled currently)
 * @returns The car data or null if not found
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const loadCarData = (carPath: string, _gameId?: string): CarData | null => {
  try {
    const bundle = carDataBundle as CarDataBundleType;
    const normalizedId = normalizeCarId(carPath);
    
    if (normalizedId && normalizedId in bundle.cars) {
      return bundle.cars[normalizedId];
    }
    
    return null;
  } catch (error) {
    console.warn('Failed to load car data:', error);
    return null;
  }
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
export const getAvailableCars = (): { carId: string; carName: string }[] => {
  const bundle = carDataBundle as CarDataBundleType;
  return Object.values(bundle.cars).map((car) => ({
    carId: car.carId,
    carName: car.carName
  }));
};