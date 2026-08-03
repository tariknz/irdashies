import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';

const toolsRoot = path.dirname(fileURLToPath(import.meta.url));
const tracksPath = path.join(
  toolsRoot,
  '../src/frontend/components/TrackMap/tracks/tracks.json'
);

// This is used to ensure that the tracks.json file exists.
// If it doesn't exist, it will create an empty one.
export const ensureTracksJson = () => {
  if (!fs.existsSync(tracksPath)) {
    console.log('Creating empty tracks.json file...');
    console.warn(
      'To generate the tracks.json file, run `npm run generate-assets`'
    );
    fs.writeFileSync(tracksPath, JSON.stringify({}));
    console.log('Empty tracks.json file created successfully.');
  }
};

ensureTracksJson();
