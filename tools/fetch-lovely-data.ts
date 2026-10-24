/**
 * Fetch and bundle car LED/RPM data from lovely-car-data repository
 *
 * Usage:
 *   npm run fetch-lovely-data          # Fetches only if missing or stale
 *   npm run fetch-lovely-data -- --force  # Forces fresh fetch
 *
 * One bundle per game (same idea as fetch-lovely-track-data). Car ids overlap
 * across sims after normalization, so a shared file would let LMU pick up
 * iRacing LED curves and the other way around.
 */

import fs from 'fs';
import path from 'path';
import https from 'https';

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

const FORCE_FETCH = process.argv.includes('--force');
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15_000;

function shouldSkipFetch(outputFile: string): boolean {
  if (FORCE_FETCH) {
    console.log('Force flag detected, fetching fresh data...\n');
    return false;
  }

  if (!fs.existsSync(outputFile)) {
    console.log('No existing bundle found, fetching...\n');
    return false;
  }

  const stats = fs.statSync(outputFile);
  const age = Date.now() - stats.mtimeMs;

  if (age > MAX_AGE_MS) {
    const daysOld = Math.floor(age / (24 * 60 * 60 * 1000));
    console.log(`Bundle is ${daysOld} days old, fetching fresh data...\n`);
    return false;
  }

  const hoursOld = Math.floor(age / (60 * 60 * 1000));
  console.log(`Using existing bundle (${hoursOld} hours old)`);
  console.log(`  Run with --force to fetch fresh data\n`);
  return true;
}

function fetchJson<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
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
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(
        new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms: ${url}`)
      );
    });
  });
}

async function fetchManifest(game: string): Promise<CarManifestEntry[]> {
  console.log(`Fetching manifest for ${game}...`);
  const url = `${GITHUB_RAW_BASE}/manifest.json`;
  const manifest = await fetchJson<CarDataManifest>(url);
  const cars = manifest.cars?.[game] ?? [];

  if (!cars.length) {
    throw new Error(`No cars found for ${game} in manifest`);
  }

  console.log(`Found ${cars.length} cars for ${game}`);
  return cars;
}

async function fetchCarData(
  entry: CarManifestEntry
): Promise<{ entry: CarManifestEntry; car: CarData } | null> {
  try {
    const url = `${GITHUB_RAW_BASE}/${encodeURI(entry.path)}`;
    const carData = await fetchJson<CarData>(url);
    return { entry, car: carData };
  } catch (error) {
    console.warn(
      `Failed to fetch car ${entry.carId} (${entry.path}):`,
      (error as Error).message
    );
    return null;
  }
}

async function fetchAllCarData(
  manifest: CarManifestEntry[]
): Promise<{ entry: CarManifestEntry; car: CarData }[]> {
  console.log(`\nFetching ${manifest.length} car files...`);
  const cars: { entry: CarManifestEntry; car: CarData }[] = [];
  let successCount = 0;

  for (let i = 0; i < manifest.length; i++) {
    const result = await fetchCarData(manifest[i]);

    if (result) {
      cars.push(result);
      successCount++;
    }

    if ((i + 1) % 20 === 0) {
      console.log(
        `  ${i + 1}/${manifest.length} processed (${successCount} successful)`
      );
    }
  }

  console.log(`Successfully fetched ${successCount}/${manifest.length} cars`);
  return cars;
}

/**
 * Bundle key: path stem for LMU (carIds collide across team liveries),
 * carId for iRacing (unique and what CarPath already is).
 */
function bundleKey(game: string, entry: CarManifestEntry, car: CarData): string {
  if (game === 'lmu') {
    const stem = entry.path
      .replace(/^.*\//, '')
      .replace(/\.json$/i, '');
    return stem || car.carId;
  }
  return car.carId;
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
    const key = bundleKey(game, entry, car);
    if (!key) {
      console.warn(`Skipping car with empty key: ${entry.path}`);
      continue;
    }
    if (key in bundle.cars) {
      console.warn(
        `Duplicate key "${key}" — keeping first ("${bundle.cars[key].carName}"), dropping later ("${car.carName}")`
      );
      continue;
    }
    bundle.cars[key] = car;
  }

  return bundle;
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`Created directory: ${DATA_DIR}`);
  }
}

function saveBundle(bundle: CarDataBundle, outputFile: string): void {
  ensureDataDir();
  fs.writeFileSync(outputFile, JSON.stringify(bundle, null, 2));
  const fileSize = fs.statSync(outputFile).size;
  const fileSizeKb = (fileSize / 1024).toFixed(2);
  console.log(`\nSaved bundle to: ${outputFile}`);
  console.log(`   File size: ${fileSizeKb} KB`);
  console.log(`   Cars: ${Object.keys(bundle.cars).length}`);
}

async function main(): Promise<void> {
  try {
    console.log('Fetching car data from lovely-car-data repository...\n');

    for (const { game, output } of GAMES) {
      const outputFile = path.join(DATA_DIR, output);
      if (shouldSkipFetch(outputFile)) continue;

      const manifest = await fetchManifest(game);
      const cars = await fetchAllCarData(manifest);
      const bundle = createBundle(game, cars);
      saveBundle(bundle, outputFile);
    }

    console.log(`\nCar data bundles successfully created!`);
  } catch (error) {
    console.error('Error fetching car data:', error);
    process.exit(1);
  }
}

main();
