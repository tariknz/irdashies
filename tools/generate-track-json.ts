import { analyzeTracks } from './analyze-tracks';
import { generateTrackJson } from './generate-paths-json';

const main = async () => {
  generateTrackJson();
  analyzeTracks();
};

main();
