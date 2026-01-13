import { useMemo } from 'react';
import { useTelemetryValue, useTelemetryValues, useFocusCarIdx, useTrackLength, usePitLaneStore, useSessionStore } from '@irdashies/context';
import { usePitlaneHelperSettings } from './usePitlaneHelperSettings';

export const usePitlaneVisibility = (): boolean => {
  const config = usePitlaneHelperSettings();
  const session = useSessionStore((state) => state.session);
  const isOnTrack = (useTelemetryValue('IsOnTrack') ?? 0) as number;
  const surface = (useTelemetryValue('PlayerTrackSurface') ?? 3) as number;
  const focusCarIdx = useFocusCarIdx();
  const carIdxLapDistPct = useTelemetryValues('CarIdxLapDistPct');
  const trackLength = useTrackLength() ?? 0;

  return useMemo(() => {
    // Don't show if not on track (IsOnTrack: 1 = on track, 0 = off track)
    if (!isOnTrack) {
      return false;
    }

    // Surface values: 1 = in pitbox, 2 = on pit road, 3 = on track
    const inPitlane = surface === 1 || surface === 2;

    // NEVER show if not in pitlane (surface must be 1 or 2)
    if (!inPitlane) {
      return false;
    }

    // We're in pit lane - now determine if we should show based on mode
    // Mode "onPitRoad": always show when in pit lane (already checked above)
    // Mode "approaching": only show if approaching pitbox, even though in pit lane
    if (config.showMode === 'onPitRoad') {
      return true;
    }

    // Mode is "approaching" - show only if within approach distance of pitbox
    const playerPct = focusCarIdx !== undefined ? (carIdxLapDistPct?.[focusCarIdx] ?? 0) : 0;
    const pitboxPct = session?.DriverInfo?.DriverPitTrkPct ?? 0;

    // Calculate distance to pitbox
    let distanceToPitbox = (pitboxPct - playerPct) * trackLength;

    // Handle wrap-around
    const halfTrack = trackLength * 0.5;
    const wrapThreshold = halfTrack + 10;

    if (Math.abs(distanceToPitbox) > wrapThreshold) {
      if (distanceToPitbox > 0) {
        distanceToPitbox -= trackLength;
      } else {
        distanceToPitbox += trackLength;
      }
    }

    // Show if within approach distance and pitbox is ahead
    return distanceToPitbox > 0 && distanceToPitbox <= config.approachDistance;
  }, [isOnTrack, surface, config.showMode, config.approachDistance, session, focusCarIdx, carIdxLapDistPct, trackLength]);
};
