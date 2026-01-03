import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { getAccessToken } from './auth';

export const getSeries = async () => {
  const accessToken = getAccessToken();
  try {
    const response = await fetch(
      'https://members-ng.iracing.com/data/series/get',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      console.log(await response.text());
      throw new Error('Failed to get series');
    }

    const data = await response.json();
    console.log(data);

    const trackResponse = await fetch(data.link);

    if (!trackResponse.ok) {
      console.log(await trackResponse.text());
      throw new Error('Failed to get series');
    }

    const trackData = await trackResponse.text();
    if (!existsSync('asset-data')) {
      mkdirSync('asset-data');
    }

    writeFileSync('asset-data/series.json', trackData, 'utf8');
  } catch (error) {
    console.error(error);
  }
};
