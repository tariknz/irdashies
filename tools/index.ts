import { analyzeTracks } from './analyze-tracks';
import { downloadTrackSvgs } from './download-track-svgs';
import { generateSeriesMapping } from './generate-series-mapping';
import { generateTrackJson } from './generate-paths-json';
import { downloadAssetCatalogs } from './download-asset-catalogs';
import { login } from './login';

const main = async () => {
  const accessToken = await login();
  await downloadAssetCatalogs(accessToken);
  await downloadTrackSvgs(accessToken);
  await generateTrackJson();
  generateSeriesMapping();
  await analyzeTracks();
};

main();
