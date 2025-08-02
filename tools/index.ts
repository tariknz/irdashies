import { downloadTrackSvgs } from './download-track-svgs';
import { generateTrackJson } from './generate-paths-json';
import { getTracks } from './get-tracks';
import { getTracksInfo } from './get-tracks-info';
import { login } from './login';

const main = async () => {
  await login();
  await getTracks();
  await getTracksInfo();
  await downloadTrackSvgs();
  generateTrackJson();
};

main();
