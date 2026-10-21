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
const DATA_DIR = path.join(process.cwd(), 'src', 'frontend', 'assets', 'data');

/**
 * The games to bundle, and where each one lands.
 *
 * One bundle per game rather than one merged file. The ids overlap in meaning
 * across games -- Sebring is "sebring international" for iRacing and "sebring
 * international raceway" for LMU -- and the lookup rule differs: an iRacing
 * TrackName is already an id, while LMU's is its display name lowercased. Two
 * files keep each sim's data unable to answer for the other, which is the
 * fault that had LMU showing Daytona's corners at Road Atlanta.
 */
const GAMES: readonly { game: string; output: string }[] = [
  { game: 'iracing', output: 'tracks-bundle.json' },
  { game: 'lmu', output: 'lmu-tracks-bundle.json' },
];

// Check if force flag is passed
const FORCE_FETCH = process.argv.includes('--force');

// Max age: 7 days in milliseconds
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Abort an HTTPS request after this many ms of no progress
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Check if the bundle file exists and is recent enough
 */
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

/**
 * Fetch JSON from URL using HTTPS
 */
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

/**
 * Fetch the manifest to get list of all tracks
 */
async function fetchManifest(game: string): Promise<TrackManifestEntry[]> {
  console.log(`Fetching manifest for ${game}...`);
  const url = `${GITHUB_RAW_BASE}/manifest.json`;
  const manifest = await fetchJson<TrackDataManifest>(url);
  const tracks = manifest.tracks?.[game] ?? [];

  if (!tracks.length) {
    throw new Error(`No tracks found for ${game} in manifest`);
  }

  console.log(`Found ${tracks.length} tracks for ${game}`);
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
    if (!track.trackId) {
      console.warn(
        `Skipping track with missing trackId: ${track.name ?? '(unnamed)'}`
      );
      continue;
    }
    if (track.trackId in bundle.tracks) {
      console.warn(
        `Duplicate trackId "${track.trackId}" — keeping first ("${bundle.tracks[track.trackId].name}"), dropping later ("${track.name}")`
      );
      continue;
    }
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
function saveBundle(bundle: TrackDataBundle, outputFile: string): void {
  ensureDataDir();
  fs.writeFileSync(outputFile, JSON.stringify(bundle, null, 2));
  const fileSize = fs.statSync(outputFile).size;
  const fileSizeKb = (fileSize / 1024).toFixed(2);
  console.log(`\nSaved bundle to: ${outputFile}`);
  console.log(`   File size: ${fileSizeKb} KB`);
}

/**
 * Main function
 */
async function main(): Promise<void> {
  try {
    console.log('Fetching track data from lovely-track-data repository...\n');

    for (const { game, output } of GAMES) {
      const outputFile = path.join(DATA_DIR, output);
      // Each bundle ages on its own, so adding a game does not force the
      // others to be re-fetched.
      if (shouldSkipFetch(outputFile)) continue;

      const manifest = await fetchManifest(game);
      const tracks = await fetchAllTrackData(manifest);
      const bundle = createBundle(tracks);
      saveBundle(bundle, outputFile);
    }

    console.log(`\nTrack data bundles successfully created!`);
  } catch (error) {
    console.error('Error fetching track data:', error);
    process.exit(1);
  }
}

main();
