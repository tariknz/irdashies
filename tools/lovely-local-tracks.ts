import fs from 'node:fs';
import path from 'node:path';

export interface LocalLovelyTrack {
  trackId: string;
  name?: string;
}

export const readLocalTracks = <T extends LocalLovelyTrack>(
  directory: string
): T[] => {
  let fileNames: string[];
  try {
    fileNames = fs.readdirSync(directory);
  } catch {
    return [];
  }
  return fileNames
    .filter((fileName) => path.extname(fileName).toLowerCase() === '.json')
    .sort()
    .map(
      (fileName) =>
        JSON.parse(fs.readFileSync(path.join(directory, fileName), 'utf8')) as T
    )
    .filter((track) => typeof track.trackId === 'string' && track.trackId);
};

export const mergeLocalTracks = <T extends LocalLovelyTrack>(
  tracks: Record<string, T>,
  localTracks: readonly T[]
): string[] => {
  const added: string[] = [];
  for (const track of localTracks) {
    if (track.trackId in tracks) continue;
    tracks[track.trackId] = track;
    added.push(track.trackId);
  }
  return added;
};
