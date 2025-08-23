import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';

interface TrackAsset {
  track_id: string;
  track_map: string;
  track_map_layers: Record<string, string>;
}

export const downloadTrackSvgs = async () => {
  const tracks = readFileSync('./asset-data/tracks.json', 'utf8');
  const cookie = readFileSync('./asset-data/cookie-jar.txt', 'utf8');

  const allTracks: Record<string, TrackAsset> = JSON.parse(tracks);

  await Promise.all(Object.values(allTracks).map(downloadTrackSvgs));

  async function downloadTrackSvgs(track: TrackAsset) {
    for (const [, layer] of Object.entries(track.track_map_layers)) {
      try {
        console.log(`Downloading ${layer} for track ${track.track_id}`);
        const response = await fetch(`${track.track_map}${layer}`, {
          headers: {
            cookie,
          },
        });

        if (!response.ok) {
          console.log(await response.text());
          throw new Error('Failed to get track svgs');
        }

        const data = await response.text();

        if (!existsSync(`./asset-data/${track.track_id}`)) {
          mkdirSync(`./asset-data/${track.track_id}`, { recursive: true });
        }

        writeFileSync(`./asset-data/${track.track_id}/${layer}`, data, 'utf8');
      } catch (error) {
        console.error(error);
      }
    }
  }
};
