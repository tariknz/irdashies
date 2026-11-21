/**
 * Fetch and bundle iRacing and LMU car data from lovely-car-data repository
 *
 * Usage:
 *   npm run fetch-lovely-data          # Fetches only if missing or stale
 *   npm run fetch-lovely-data -- --force  # Forces fresh fetch
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { getFreshBundleAgeMs } from './lovely-bundle-cache';

interface CarManifestEntry {
  carName: string;
  carId: string;
  path: string;
}

interface CarDataManifest {
  cars: Record<string, CarManifestEntry[]>;
}

interface CarData {
  carName: string;
  carId: string;
  carClass: string;
  ledNumber: number;
  redlineBlinkInterval: number;
  ledColor: string[];
  ledRpm: Record<string, number[]>[];
}

interface CarDataBundle {
  version: string;
  timestamp: number;
  cars: Record<string, CarData>;
}

const GITHUB_RAW_BASE =
  'https://raw.githubusercontent.com/Lovely-Sim-Racing/lovely-car-data/main/data';
const DATA_DIR = path.join(process.cwd(), 'src', 'frontend', 'assets', 'data');

const GAMES: readonly { game: string; output: string }[] = [
  { game: 'iracing', output: 'cars-bundle.json' },
  { game: 'lmu', output: 'lmu-cars-bundle.json' },
];

// Check if force flag is passed
const FORCE_FETCH = process.argv.includes('--force');

/**
 * Check if the bundle file exists and is recent enough
 */
async function shouldSkipFetch(outputFile: string): Promise<boolean> {
  if (FORCE_FETCH) {
    console.log('🔄 Force flag detected, fetching fresh data...\n');
    return false;
  }

  const age = await getFreshBundleAgeMs(outputFile);
  if (age === null) {
    console.log(
      'Bundle is missing, stale, or has an invalid fetch timestamp; fetching fresh data...\n'
    );
    return false;
  }

  const hoursOld = Math.floor(age / (60 * 60 * 1000));
  console.log(`✓ Using existing bundle (${hoursOld} hours old)`);
  console.log(`  Run with --force to fetch fresh data\n`);
  return true;
}

/**
 * Fetch JSON from URL using HTTPS
 */
function fetchJson<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              resolve(JSON.parse(data));
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${url}`));
            }
          } catch (error) {
            reject(error);
          }
        });
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

/**
 * Fetch the manifest to get list of all cars
 */
async function fetchManifest(game: string): Promise<CarManifestEntry[]> {
  console.log(`📋 Fetching manifest for ${game}...`);
  const url = `${GITHUB_RAW_BASE}/manifest.json`;
  const manifest = await fetchJson<CarDataManifest>(url);
  const cars = manifest.cars?.[game] ?? [];

  if (!cars.length) {
    throw new Error(`No cars found for ${game} in manifest`);
  }

  console.log(`✓ Found ${cars.length} cars for ${game}`);
  return cars;
}

/**
 * Fetch a single car's data
 */
async function fetchCarData(entry: CarManifestEntry): Promise<CarData | null> {
  try {
    const url = `${GITHUB_RAW_BASE}/${encodeURI(entry.path)}`;
    const carData = await fetchJson<CarData>(url);
    return carData;
  } catch (error) {
    console.warn(
      `⚠ Failed to fetch car ${entry.carId} (${entry.path}):`,
      (error as Error).message
    );
    return null;
  }
}

/**
 * Fetch all car data using the manifest
 */
async function fetchAllCarData(
  manifest: CarManifestEntry[]
): Promise<{ entry: CarManifestEntry; car: CarData }[]> {
  console.log(`\n🚗 Fetching ${manifest.length} car files...`);
  const cars: { entry: CarManifestEntry; car: CarData }[] = [];
  let successCount = 0;

  for (let i = 0; i < manifest.length; i++) {
    const entry = manifest[i];
    const carData = await fetchCarData(entry);

    if (carData) {
      cars.push({ entry, car: carData });
      successCount++;
    }

    // Progress indicator every 20 cars
    if ((i + 1) % 20 === 0) {
      console.log(
        `  ${i + 1}/${manifest.length} processed (${successCount} successful)`
      );
    }
  }

  console.log(`✓ Successfully fetched ${successCount}/${manifest.length} cars`);
  return cars;
}

/**
 * Create a bundle with all car data indexed by carId
 */
function bundleKey(
  game: string,
  entry: CarManifestEntry,
  car: CarData
): string {
  if (game !== 'lmu') return car.carId;
  return entry.path.replace(/^.*\//, '').replace(/\.json$/i, '') || car.carId;
}

function createBundle(
  game: string,
  cars: { entry: CarManifestEntry; car: CarData }[]
): CarDataBundle {
  const bundle: CarDataBundle = {
    version: '1.0',
    timestamp: Date.now(),
    cars: {},
  };

  for (const { entry, car } of cars) {
    bundle.cars[bundleKey(game, entry, car)] = car;
  }

  return bundle;
}

/**
 * Ensure data directory exists
 */
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`📁 Created directory: ${DATA_DIR}`);
  }
}

/**
 * Save bundle to file
 */
function saveBundle(bundle: CarDataBundle, outputFile: string): void {
  ensureDataDir();
  fs.writeFileSync(outputFile, JSON.stringify(bundle, null, 2));
  const fileSize = fs.statSync(outputFile).size;
  const fileSizeKb = (fileSize / 1024).toFixed(2);
  console.log(`\n💾 Saved bundle to: ${outputFile}`);
  console.log(`   File size: ${fileSizeKb} KB`);
}

/**
 * Main function
 */
async function main(): Promise<void> {
  try {
    for (const { game, output } of GAMES) {
      const outputFile = path.join(DATA_DIR, output);
      if (await shouldSkipFetch(outputFile)) continue;

      console.log('🔄 Fetching car data from lovely-car-data repository...\n');

      const manifest = await fetchManifest(game);
      const cars = await fetchAllCarData(manifest);
      const bundle = createBundle(game, cars);
      saveBundle(bundle, outputFile);

      console.log(`\n✅ Car data bundle successfully created!`);
    }
  } catch (error) {
    console.error('❌ Error fetching car data:', error);
    process.exit(1);
  }
}

main();
