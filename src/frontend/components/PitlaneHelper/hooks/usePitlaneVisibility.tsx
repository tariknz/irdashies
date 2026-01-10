import { useMemo } from 'react';
import { useTelemetryValue } from '@irdashies/context';

export const usePitlaneVisibility = (): boolean => {
  const isOnTrack = (useTelemetryValue('IsOnTrack') ?? 0) as number;
  const surface = (useTelemetryValue('PlayerTrackSurface') ?? 3) as number;

  return useMemo(() => {
    // Don't show if not on track (IsOnTrack: 1 = on track, 0 = off track)
    if (!isOnTrack) {
      return false;
    }

    // Surface values: 1 = in pitbox, 2 = on pit road, 3 = on track
    const inPitlane = surface === 1 || surface === 2;

    // Only show when actually in the pitlane (Surface = 1 or 2)
    // We cannot reliably detect "approaching pit entry" from track position alone
    // because we don't know where pit entry is relative to the track
    return inPitlane;
  }, [isOnTrack, surface]);
};
