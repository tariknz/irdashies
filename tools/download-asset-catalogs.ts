import { mkdir, writeFile } from 'node:fs/promises';

const catalogs = {
  cars: 'car/get',
  flairs: 'lookup/flairs',
  series: 'series/get',
  tracks: 'track/assets',
  'track-info': 'track/get',
};

async function fetchAsset(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
  return response;
}

export async function downloadAssetCatalogs(accessToken: string) {
  for (const [name, endpoint] of Object.entries(catalogs)) {
    try {
      const response = await fetchAsset(
        `https://members-ng.iracing.com/data/${endpoint}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const { link } = await response.json();
      const catalog = await fetchAsset(link);
      const content = await catalog.text();
      await mkdir('asset-data', { recursive: true });
      await writeFile(`asset-data/${name}.json`, content, 'utf8');
    } catch (error) {
      console.error(`Failed to download ${name} catalog`, error);
    }
  }
}
