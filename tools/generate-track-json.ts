import { analyzeTracks } from './analyze-tracks';
import { generateTrackJson } from './generate-paths-json';

const main = async () => {
  await generateTrackJson();
  await analyzeTracks();
};

main();
