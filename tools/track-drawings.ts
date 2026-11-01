import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { TrackDrawing } from '../src/frontend/domain/track/trackDrawing';

export const TRACK_DRAWINGS_DIRECTORY = path.resolve(
  'src/frontend/domain/track/tracks/by-id'
);

/** Read the checked-in drawings for offline generation and analysis tools. */
export const readTrackDrawings = async (
  directory = TRACK_DRAWINGS_DIRECTORY
): Promise<Record<string, TrackDrawing>> => {
  const files = (await fs.readdir(directory)).filter((file) =>
    /^\d+\.json$/.test(file)
  );
  const entries = await Promise.all(
    files.map(
      async (file) =>
        [
          path.basename(file, '.json'),
          JSON.parse(
            await fs.readFile(path.join(directory, file), 'utf8')
          ) as TrackDrawing,
        ] as const
    )
  );
  return Object.fromEntries(entries);
};

/** Write readable source files, preserving unchanged files and removing old IDs. */
export const writeTrackDrawings = async (
  drawings: Record<string, TrackDrawing | undefined>,
  directory = TRACK_DRAWINGS_DIRECTORY
) => {
  const entries = Object.entries(drawings).filter(
    (entry): entry is [string, TrackDrawing] => entry[1] !== undefined
  );
  if (entries.some(([id]) => !/^\d+$/.test(id))) {
    throw new Error('Expected numeric track IDs');
  }
  await fs.mkdir(directory, { recursive: true });
  const expected = new Set(entries.map(([id]) => `${id}.json`));
  for (const file of await fs.readdir(directory)) {
    if (/^\d+\.json$/.test(file) && !expected.has(file)) {
      await fs.unlink(path.join(directory, file));
    }
  }
  await Promise.all(
    entries.map(async ([id, drawing]) => {
      const file = path.join(directory, `${id}.json`);
      const json = `${JSON.stringify(drawing, null, 2)}\n`;
      const existing = await fs
        .readFile(file, 'utf8')
        .catch((error: unknown) => {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
          throw error;
        });
      if (existing !== json) await fs.writeFile(file, json, 'utf8');
    })
  );
};
