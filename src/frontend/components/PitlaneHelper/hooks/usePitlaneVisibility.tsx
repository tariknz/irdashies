import { useMemo } from 'react';
import { useTelemetryValue, useTelemetryValues, useFocusCarIdx, useTrackLength, useSessionStore, usePitLaneStore } from '@irdashies/context';
import { usePitlaneHelperSettings } from './usePitlaneHelperSettings';

export const usePitlaneVisibility = (): boolean => {
  const config = usePitlaneHelperSettings();
  const session = useSessionStore((state) => state.session);
  const isOnTrack = (useTelemetryValue('IsOnTrack') ?? 0) as number;
  const surface = (useTelemetryValue('PlayerTrackSurface') ?? 3) as number;
  const focusCarIdx = useFocusCarIdx();
  const carIdxLapDistPct = useTelemetryValues('CarIdxLapDistPct');
  const carIdxOnPitRoad = useTelemetryValues('CarIdxOnPitRoad') as boolean[] | undefined;
  const trackLength = useTrackLength() ?? 0;
  const pitExitPct = usePitLaneStore((state) => state.pitExitPct);

  return useMemo(() => {
    // Don't show if not on track (IsOnTrack: 1 = on track, 0 = off track)
    if (!isOnTrack) {
      return false;
    }

    // Get player's OnPitRoad status and position
    const playerOnPitRoad = focusCarIdx !== undefined ? (carIdxOnPitRoad?.[focusCarIdx] ?? false) : false;
    const playerPct = focusCarIdx !== undefined ? (carIdxLapDistPct?.[focusCarIdx] ?? 0) : 0;

    // Surface values: 1 = in pitbox, 2 = on pit road, 3 = on track
    const onPitRoad = surface === 2;
    const inPitbox = surface === 1;

    // Handle surface=2 with OnPitRoad=false (either pit entry road OR pit exit road)
    // We need to distinguish between:
    // - Pit entry road: surface=2, OnPitRoad=false, BEFORE pit entry line → SHOW
    // - Pit exit road: surface=2, OnPitRoad=false, AFTER pit exit line → HIDE
    if (onPitRoad && !playerOnPitRoad && pitExitPct !== null) {
      // Check if player is past the pit exit line (on exit road)
      // Calculate distance from pit exit to player
      let distanceFromExit = (playerPct - pitExitPct) * trackLength;

      // Handle wrap-around
      if (distanceFromExit < -trackLength * 0.5) {
        distanceFromExit += trackLength;
      } else if (distanceFromExit > trackLength * 0.5) {
        distanceFromExit -= trackLength;
      }

      // If player is past pit exit (distance >= 0 and within ~200m), hide overlay
      // This is the pit exit road scenario
      if (distanceFromExit >= 0 && distanceFromExit <= 200) {
        return false;
      }

      // Otherwise, player is on pit entry road (before pit entry line) → show overlay
      return true;
    }

    // ALWAYS show when on pit road (surface=2) AND OnPitRoad flag is true
    // This handles the pit lane between pit entry and pit exit
    if (onPitRoad && playerOnPitRoad) {
      return true;
    }

    // Surface=2 with no pit exit data yet - show overlay (conservative approach)
    if (onPitRoad && !playerOnPitRoad && pitExitPct === null) {
      return true;
    }

    // NEVER show if not in pitlane area (surface must be 1 or 2)
    if (!inPitbox) {
      return false;
    }

    // Surface=1 (in pitbox) - always show if OnPitRoad is true (committed to pitting)
    // Only check mode/distance when NOT on pit road (approaching scenario)
    if (playerOnPitRoad) {
      return true;
    }

    // Mode "onPitRoad": always show when in pitlane (includes pitbox)
    // Mode "approaching": only show if approaching pitbox
    if (config.showMode === 'onPitRoad') {
      return true;
    }

    // Mode is "approaching" and in pitbox - check if within approach distance
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
  }, [isOnTrack, surface, config.showMode, config.approachDistance, session, focusCarIdx, carIdxLapDistPct, carIdxOnPitRoad, trackLength, pitExitPct]);
};
