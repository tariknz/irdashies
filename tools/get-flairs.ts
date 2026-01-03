import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { getAccessToken } from './auth';

export const getFlairs = async () => {
  const accessToken = getAccessToken();
  try {
    const response = await fetch(
      'https://members-ng.iracing.com/data/lookup/flairs',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      console.log(await response.text());
      throw new Error('Failed to get flairs');
    }

    const data = await response.json();
    console.log(data);

    const trackResponse = await fetch(data.link);

    if (!trackResponse.ok) {
      console.log(await trackResponse.text());
      throw new Error('Failed to get flairs');
    }

    const trackData = await trackResponse.text();
    if (!existsSync('asset-data')) {
      mkdirSync('asset-data');
    }

    writeFileSync('asset-data/flairs.json', trackData, 'utf8');
  } catch (error) {
    console.error(error);
  }
};
