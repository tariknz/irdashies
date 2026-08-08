import { useMemo } from 'react';
import { useTrackStateSnapshot } from '../ChannelStore';

const EMPTY_TRACK_SURFACES: readonly number[] = [];
export const useCarIdxOffTrack = (): boolean[] => {
  const trackSurface =
    useTrackStateSnapshot()?.carIdxTrackSurface ?? EMPTY_TRACK_SURFACES;
  return useMemo(
    () => trackSurface.map((surface) => surface === 0),
    [trackSurface]
  );
};
