import { downloadTrackSvgs } from './download-track-svgs';
import { generateSvgComponents } from './generate-svg-components';
import { getTracks } from './get-tracks';
import { getTracksInfo } from './get-tracks-info';
import { login } from './login';
import { processTrackSvgs } from './process-svg-components';

const main = async () => {
  await login();
  await getTracks();
  await getTracksInfo();
  await downloadTrackSvgs();
  generateSvgComponents();
  processTrackSvgs();
};

main();
