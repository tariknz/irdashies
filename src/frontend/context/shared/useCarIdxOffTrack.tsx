import { useMemo } from 'react';
import { shallow } from 'zustand/shallow';
import { trackStateSelectors, useTrackStateSelector } from '../ChannelStore';

const EMPTY_TRACK_SURFACES: readonly number[] = [];
export const useCarIdxOffTrack = (): boolean[] => {
  const trackSurface =
    useTrackStateSelector(trackStateSelectors.carIdxTrackSurface, {
      equality: shallow,
    }) ?? EMPTY_TRACK_SURFACES;
  return useMemo(
    () => trackSurface.map((surface) => surface === 0),
    [trackSurface]
  );
};
