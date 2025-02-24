import assert from 'node:assert';
import crypto from 'node:crypto';
import { existsSync } from 'node:fs';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { IRacingAPISessionClient, IRacingAPIClient } from '@iracing-data/api';
import { generateTrackJson } from './generate-paths-json';

import * as dotenv from 'dotenv';
dotenv.config();

interface TrackAsset {
  track_id: string;
  track_map: string;
  track_map_layers: Record<string, string>;
}

/**
 * Compute the Base64‑encoded SHA‑256 hash of (password + email.toLowerCase()).
 */
async function hashPassword(email: string, password: string) {
  return crypto
    .createHash('sha256')
    .update(password + email.toLowerCase())
    .digest('base64');
}

async function getTrackAssets(client: IRacingAPIClient) {
  const trackData = await client.trackAssets();
  await writeFile('asset-data/tracks.json', JSON.stringify(trackData), 'utf8');
}

async function getTrackInfo(client: IRacingAPIClient) {
  const trackInfo = await client.trackGet();
  await writeFile(
    'asset-data/track-info.json',
    JSON.stringify(trackInfo),
    'utf8'
  );
}

async function getTrackSVGs(
  client: IRacingAPIClient,
  tracksIndex: Record<string, TrackAsset>
) {
  await Promise.all(
    Object.entries(tracksIndex).map(
      async ([trackId, { track_map, track_map_layers }]) => {
        if (!existsSync(`asset-data/${trackId}`)) {
          await mkdir(`asset-data/${trackId}`, { recursive: true });
        }

        console.log('Getting track with ID:', trackId);
        await Promise.all([
          Object.values(track_map_layers).map(async (layer) => {
            console.log('\tDownloading layer:', layer);
            const response = await client.client.get(`${track_map}${layer}`);
            const svg = response.data;
            await writeFile(`asset-data/${trackId}/${layer}`, svg, 'utf8');
          }),
        ]);
      }
    )
  );
}

const main = async () => {
  const client = new IRacingAPISessionClient();

  const username = `${process.env.IRACING_USERNAME}`;
  const password = `${process.env.IRACING_PASSWORD}`;

  assert(username, 'Please provide username via environment variable.');
  assert(password, 'Please provider password via environment variable.');

  const hashedPassword = await hashPassword(username, password);
  console.log('Authenticating for user: ', username);
  await client.authenticate({ username, password: hashedPassword });

  // After authentication, create the asset-data directory
  if (!existsSync('asset-data')) {
    console.log("Creating 'asset-data' directory.");
    await mkdir('asset-data');
  }

  // Download the JSON from the iRacing API
  console.log('Getting track assets and info.');
  await Promise.all([getTrackAssets(client), getTrackInfo(client)]);

  const tracksRaw = await readFile('asset-data/tracks.json', 'utf8');
  console.log("Downloading SVG's for each track.");
  await getTrackSVGs(client, JSON.parse(tracksRaw));

  console.log('Generating track JSON.');
  generateTrackJson();

  console.log('Done!');
};

main();
