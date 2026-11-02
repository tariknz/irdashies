import { shouldShowTrack } from './tracks/brokenTracks';
import type { TrackPathData } from './trackGeometry';
import type { TrackDrawing } from './trackDrawing';

/**
 * The centreline of a track drawing, or null when the drawing is missing or
 * on the broken-track list (figure eights, split paths, no start/finish).
 */
export const getTrackPathData = (
  trackId: number | undefined,
  drawing: TrackDrawing | null
): TrackPathData | null => {
  if (trackId === undefined) return null;
  if (!drawing || !shouldShowTrack(trackId, drawing)) return null;
  const points = drawing.active?.trackPathPoints;
  const totalLength = drawing.active?.totalLength;
  const startFinishLength = drawing.startFinish?.point?.length;
  const direction = drawing.startFinish?.direction;
  if (
    !points?.length ||
    totalLength === undefined ||
    startFinishLength === undefined ||
    !direction
  ) {
    return null;
  }
  return {
    trackPathPoints: points,
    totalLength,
    startFinishLength,
    direction,
  };
};
