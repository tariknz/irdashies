import { useSessionStore } from '@irdashies/context';
import type { TrackDrawing } from './trackDrawing';
import { useTrackDrawing } from './useTrackDrawing';

export const useSessionTrackDrawing = (
  trackId: number | undefined
): TrackDrawing | null => {
  const lmuTrackMap = useSessionStore((state) => state.session?.LmuTrackMap);
  const loaded = useTrackDrawing(lmuTrackMap ? undefined : trackId);
  if (trackId === undefined) return null;
  return lmuTrackMap ?? loaded;
};
