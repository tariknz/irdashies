import fs, { existsSync, mkdirSync } from 'fs';
import { getAccessToken } from './auth';

export const getTracksInfo = async () => {
  const accessToken = getAccessToken();

  try {
    const response = await fetch(
      'https://members-ng.iracing.com/data/track/get',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      console.log(await response.text());
      throw new Error('Failed to get tracks');
    }

    const data = await response.json();
    console.log(data);

    const trackResponse = await fetch(data.link);

    if (!trackResponse.ok) {
      console.log(await trackResponse.text());
      throw new Error('Failed to get tracks');
    }

    const trackData = await trackResponse.text();
    if (!existsSync('./asset-data')) {
      mkdirSync('./asset-data');
    }
    fs.writeFileSync('./asset-data/track-info.json', trackData, 'utf8');
  } catch (error) {
    console.error(error);
  }
};
