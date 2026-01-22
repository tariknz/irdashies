/**
 * Build-time script to fetch and bundle car data from lovely-car-data repository
 * 
 * This script:
 * 1. Checks if the bundle already exists and is recent (< 7 days old)
 * 2. If needed, fetches the manifest.json to get list of all cars
 * 3. Downloads each car's JSON file
 * 4. Bundles all car data into a single file
 * 5. Saves it to src/data/cars-bundle.json for inclusion in the built app
 * 
 * Usage:
 *   npm run fetch-car-data          # Fetches only if missing or stale
 *   npm run fetch-car-data -- --force  # Forces fresh fetch regardless
 * 
 * The bundle is automatically fetched before production builds (package/make/publish)
 * but skipped for dev commands (start/test/storybook) to avoid unnecessary delays.
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
  cars: CarManifestEntry[];
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

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/Lovely-Sim-Racing/lovely-car-data/main/data';
const GAME_FOLDER = 'IRacing';
const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const OUTPUT_FILE = path.join(DATA_DIR, 'cars-bundle.json');

// Check if force flag is passed
const FORCE_FETCH = process.argv.includes('--force');

// Max age: 7 days in milliseconds
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Check if the bundle file exists and is recent enough
 */
function shouldSkipFetch(): boolean {
  if (FORCE_FETCH) {
    console.log('🔄 Force flag detected, fetching fresh data...\n');
    return false;
  }

  if (!fs.existsSync(OUTPUT_FILE)) {
    console.log('📦 No existing bundle found, fetching...\n');
    return false;
  }

  const stats = fs.statSync(OUTPUT_FILE);
  const age = Date.now() - stats.mtimeMs;

  if (age > MAX_AGE_MS) {
    const daysOld = Math.floor(age / (24 * 60 * 60 * 1000));
    console.log(`📦 Bundle is ${daysOld} days old, fetching fresh data...\n`);
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
    https.get(url, (res) => {
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
    }).on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Fetch the manifest to get list of all cars
 */
async function fetchManifest(): Promise<CarManifestEntry[]> {
  console.log(`📋 Fetching manifest for ${GAME_FOLDER}...`);
  const url = `${GITHUB_RAW_BASE}/${GAME_FOLDER}/manifest.json`;
  const manifest = await fetchJson<CarDataManifest>(url);
  console.log(`✓ Found ${manifest.cars.length} cars`);
  return manifest.cars;
}

/**
 * Fetch a single car's data
 */
async function fetchCarData(carId: string): Promise<CarData | null> {
  try {
    const url = `${GITHUB_RAW_BASE}/${GAME_FOLDER}/${encodeURIComponent(carId)}.json`;
    const carData = await fetchJson<CarData>(url);
    return carData;
  } catch (error) {
    console.warn(`⚠ Failed to fetch car ${carId}:`, (error as Error).message);
    return null;
  }
}

/**
 * Fetch all car data using the manifest
 */
async function fetchAllCarData(manifest: CarManifestEntry[]): Promise<CarData[]> {
  console.log(`\n🚗 Fetching ${manifest.length} car files...`);
  const cars: CarData[] = [];
  let successCount = 0;

  for (let i = 0; i < manifest.length; i++) {
    const entry = manifest[i];
    const carData = await fetchCarData(entry.carId);
    
    if (carData) {
      cars.push(carData);
      successCount++;
    }

    // Progress indicator every 20 cars
    if ((i + 1) % 20 === 0) {
      console.log(`  ${i + 1}/${manifest.length} processed (${successCount} successful)`);
    }
  }

  console.log(`✓ Successfully fetched ${successCount}/${manifest.length} cars`);
  return cars;
}

/**
 * Create a bundle with all car data indexed by carId
 */
function createBundle(cars: CarData[]): CarDataBundle {
  const bundle: CarDataBundle = {
    version: '1.0',
    timestamp: Date.now(),
    cars: {}
  };

  for (const car of cars) {
    bundle.cars[car.carId] = car;
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
function saveBundle(bundle: CarDataBundle): void {
  ensureDataDir();
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(bundle, null, 2));
  const fileSize = fs.statSync(OUTPUT_FILE).size;
  const fileSizeKb = (fileSize / 1024).toFixed(2);
  console.log(`\n💾 Saved bundle to: ${OUTPUT_FILE}`);
  console.log(`   File size: ${fileSizeKb} KB`);
}

/**
 * Main function
 */
async function main(): Promise<void> {
  try {
    // Skip if bundle exists and is recent
    if (shouldSkipFetch()) {
      return;
    }

    console.log('🔄 Fetching car data from lovely-car-data repository...\n');
    
    const manifest = await fetchManifest();
    const cars = await fetchAllCarData(manifest);
    const bundle = createBundle(cars);
    saveBundle(bundle);

    console.log(`\n✅ Car data bundle successfully created!`);
  } catch (error) {
    console.error('❌ Error fetching car data:', error);
    process.exit(1);
  }
}

main();
