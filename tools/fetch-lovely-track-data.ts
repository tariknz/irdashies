/**
 * Fetch and bundle iRacing track data from lovely-track-data repository
 *
 * Usage:
 *   npm run fetch-lovely-track-data          # Fetches only if missing or stale
 *   npm run fetch-lovely-track-data -- --force  # Forces fresh fetch
 */

import fs from 'fs';
import path from 'path';
import https from 'https';

interface TrackManifestEntry {
  trackName: string;
  trackId: string;
  path: string;
}

interface TrackDataManifest {
  tracks: Record<string, TrackManifestEntry[]>;
}

interface LovelyTurn {
  name?: string;
  start: number;
  end: number;
  marker?: number;
}

interface LovelyStraight {
  name?: string;
  start: number;
  end: number;
  marker?: number;
}

interface LovelySector {
  name: string;
  marker: number;
}

interface LovelyTrack {
  name: string;
  trackId: string;
  country?: string;
  year?: number;
  length?: number;
  pitentry?: number;
  pitexit?: number;
  turn?: LovelyTurn[];
  straight?: LovelyStraight[];
  sector?: LovelySector[];
  time?: unknown[];
}

interface TrackDataBundle {
  version: string;
  timestamp: number;
  tracks: Record<string, LovelyTrack>;
}

const GITHUB_RAW_BASE =
  'https://raw.githubusercontent.com/Lovely-Sim-Racing/lovely-track-data/main/data';
const TARGET_GAME = 'iracing';
const DATA_DIR = path.join(process.cwd(), 'src', 'frontend', 'assets', 'data');
const OUTPUT_FILE = path.join(DATA_DIR, 'tracks-bundle.json');

// Check if force flag is passed
const FORCE_FETCH = process.argv.includes('--force');

// Max age: 7 days in milliseconds
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Check if the bundle file exists and is recent enough
 */
function shouldSkipFetch(): boolean {
  if (FORCE_FETCH) {
    console.log('Force flag detected, fetching fresh data...\n');
    return false;
  }

  if (!fs.existsSync(OUTPUT_FILE)) {
    console.log('No existing bundle found, fetching...\n');
    return false;
  }

  const stats = fs.statSync(OUTPUT_FILE);
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
 * Fetch the manifest to get list of all tracks
 */
async function fetchManifest(): Promise<TrackManifestEntry[]> {
  console.log(`Fetching manifest for ${TARGET_GAME}...`);
  const url = `${GITHUB_RAW_BASE}/manifest.json`;
  const manifest = await fetchJson<TrackDataManifest>(url);
  const tracks = manifest.tracks?.[TARGET_GAME] ?? [];

  if (!tracks.length) {
    throw new Error(`No tracks found for ${TARGET_GAME} in manifest`);
  }

  console.log(`Found ${tracks.length} tracks for ${TARGET_GAME}`);
  return tracks;
}

/**
 * Fetch a single track's data
 */
async function fetchTrackData(
  entry: TrackManifestEntry
): Promise<LovelyTrack | null> {
  try {
    const url = `${GITHUB_RAW_BASE}/${encodeURI(entry.path)}`;
    const trackData = await fetchJson<LovelyTrack>(url);
    return trackData;
  } catch (error) {
    console.warn(
      `Failed to fetch track ${entry.trackId} (${entry.path}):`,
      (error as Error).message
    );
    return null;
  }
}

/**
 * Fetch all track data using the manifest
 */
async function fetchAllTrackData(
  manifest: TrackManifestEntry[]
): Promise<LovelyTrack[]> {
  console.log(`\nFetching ${manifest.length} track files...`);
  const tracks: LovelyTrack[] = [];
  let successCount = 0;

  for (let i = 0; i < manifest.length; i++) {
    const entry = manifest[i];
    const trackData = await fetchTrackData(entry);

    if (trackData) {
      tracks.push(trackData);
      successCount++;
    }

    // Progress indicator every 20 tracks
    if ((i + 1) % 20 === 0) {
      console.log(
        `  ${i + 1}/${manifest.length} processed (${successCount} successful)`
      );
    }
  }

  console.log(`Successfully fetched ${successCount}/${manifest.length} tracks`);
  return tracks;
}

/**
 * Create a bundle with all track data indexed by trackId
 */
function createBundle(tracks: LovelyTrack[]): TrackDataBundle {
  const bundle: TrackDataBundle = {
    version: '1.0',
    timestamp: Date.now(),
    tracks: {},
  };

  for (const track of tracks) {
    bundle.tracks[track.trackId] = track;
  }

  return bundle;
}

/**
 * Ensure data directory exists
 */
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`Created directory: ${DATA_DIR}`);
  }
}

/**
 * Save bundle to file
 */
function saveBundle(bundle: TrackDataBundle): void {
  ensureDataDir();
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(bundle, null, 2));
  const fileSize = fs.statSync(OUTPUT_FILE).size;
  const fileSizeKb = (fileSize / 1024).toFixed(2);
  console.log(`\nSaved bundle to: ${OUTPUT_FILE}`);
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

    console.log('Fetching track data from lovely-track-data repository...\n');

    const manifest = await fetchManifest();
    const tracks = await fetchAllTrackData(manifest);
    const bundle = createBundle(tracks);
    saveBundle(bundle);

    console.log(`\nTrack data bundle successfully created!`);
  } catch (error) {
    console.error('Error fetching track data:', error);
    process.exit(1);
  }
}

main();
