import { downloadTrackSvgs } from './download-track-svgs';
import { generateTrackJson } from './generate-paths-json';
import { getFlairs } from './get-flairs';
import { getTracks } from './get-tracks';
import { getTracksInfo } from './get-tracks-info';
import { login } from './login';

const main = async () => {
  await login();
  await getFlairs();
  await getTracks();
  await getTracksInfo();
  await downloadTrackSvgs();
  generateTrackJson();
};

main();
