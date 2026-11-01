import { readTrackDrawings } from './track-drawings';

// Source drawings are checked in; missing data should never be silently replaced.
export const ensureTrackDrawings = async () => {
  const drawings = await readTrackDrawings();
  if (!Object.keys(drawings).length) {
    throw new Error(
      'No track drawings found. Run npm run generate-track-json.'
    );
  }
};

void ensureTrackDrawings();
