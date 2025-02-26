import { downloadTrackAssets } from '@iracing-data/download-track-assets';
import { generateTrackJson } from './generate-paths-json';

import * as dotenv from 'dotenv';
dotenv.config();

const main = async () => {
  await downloadTrackAssets({
    outputDir: './asset-data',
    writeFullAssets: true,
    writeFullInfo: true,
    includeSVGs: true,
  });

  console.log('Generating track JSON.');
  generateTrackJson();

  console.log('Done!');
};

main();
