import logger from '@irdashies/utils/logger';
import type { TrackDrawing } from './trackDrawing';

const loaders = import.meta.glob<TrackDrawing>('./tracks/by-id/*.json', {
  import: 'default',
});

/** Listing IDs does not load any drawings (used by the Storybook gallery). */
export const availableTrackIds = Object.keys(loaders)
  .map((file) => Number(file.match(/\/(\d+)\.json$/)?.[1]))
  .sort((a, b) => a - b);

// At most one entry per bundled track. Imports are also cached by the renderer's
// module system until the window closes; this shares in-flight requests too.
const pending = new Map<number, Promise<TrackDrawing | null>>();

export const loadTrackDrawing = (
  trackId: number | undefined
): Promise<TrackDrawing | null> => {
  if (trackId === undefined || !Number.isSafeInteger(trackId) || trackId < 0) {
    return Promise.resolve(null);
  }
  const loader = loaders[`./tracks/by-id/${trackId}.json`];
  if (!loader) return Promise.resolve(null);

  const cached = pending.get(trackId);
  if (cached) return cached;
  const request = loader().catch((error: unknown) => {
    pending.delete(trackId);
    logger.warn('Unable to load track drawing', trackId, error);
    return null;
  });
  pending.set(trackId, request);
  return request;
};
