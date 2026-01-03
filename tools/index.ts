import { analyzeTracks } from './analyze-tracks';
import { downloadTrackSvgs } from './download-track-svgs';
import { generateSeriesMapping } from './generate-series-mapping';
import { generateTrackJson } from './generate-paths-json';
import { getCars } from './get-cars';
import { getFlairs } from './get-flairs';
import { getSeries } from './get-series';
import { getTracks } from './get-tracks';
import { getTracksInfo } from './get-tracks-info';
import { login } from './login';

const main = async () => {
  await login();
  await getCars();
  await getFlairs();
  await getSeries();
  await getTracks();
  await getTracksInfo();
  await downloadTrackSvgs();
  generateTrackJson();
  generateSeriesMapping();
  analyzeTracks();
};

main();
