import { useMemo } from 'react';
import { useTelemetryValues, useSessionStore, useFocusCarIdx, useTrackLength, usePitLaneStore } from '@irdashies/context';

export interface PitboxPositionResult {
  distanceToPit: number;
  progressPercent: number;
  isApproaching: boolean;
  pitboxPct: number;
  playerPct: number;
  isEarlyPitbox: boolean; // Pitbox is near pit entry (last 10% of track before start/finish)
}

export const usePitboxPosition = (approachDistance: number, earlyPitboxThreshold: number): PitboxPositionResult => {
  const session = useSessionStore((state) => state.session);
  const focusCarIdx = useFocusCarIdx();
  const carIdxLapDistPct = useTelemetryValues('CarIdxLapDistPct');
  const trackLength = useTrackLength() ?? 0;
  const pitEntryPct = usePitLaneStore((state) => state.pitEntryPct);

  return useMemo(() => {
    // Get player's current position on track (as percentage)
    const playerPct = focusCarIdx !== undefined ? (carIdxLapDistPct?.[focusCarIdx] ?? 0) : 0;

    // Get pitbox position (percentage of entire track)
    // DriverPitTrkPct is on the DriverInfo object, not on individual Driver objects
    const pitboxPct = session?.DriverInfo?.DriverPitTrkPct ?? 0;

    // Calculate distance to pitbox
    // Positive = pitbox ahead, Negative = pitbox behind
    let distanceToPit = (pitboxPct - playerPct) * trackLength;

    // Only consider wrap-around if the distance is SIGNIFICANTLY more than half the track
    // We add a 10m buffer to prevent wrap-around when exactly at 50% of track
    const halfTrack = trackLength * 0.5;
    const wrapThreshold = halfTrack + 10;

    if (Math.abs(distanceToPit) > wrapThreshold) {
      // The direct path is more than half the track, so going the other way is shorter
      if (distanceToPit > 0) {
        // Pitbox appears far ahead, but going backwards (negative) is shorter
        distanceToPit -= trackLength;
      } else {
        // Pitbox appears far behind, but going forwards (crossing start/finish) is shorter
        distanceToPit += trackLength;
      }
    }

    // Determine if approaching (within approach distance and ahead)
    // Only show when pitbox is ahead of us and within the approach distance
    const isApproaching = distanceToPit > 0 && distanceToPit <= approachDistance;

    // Progress bar: 0-100% as approaching from approachDistance to 0m
    const progressPercent = Math.max(
      0,
      Math.min(100, ((approachDistance - distanceToPit) / approachDistance) * 100)
    );

    // Early pitbox detection:
    // Purpose: Determine if pitbox is very close to pit entry so driver can be warned once on pit road.
    // Example: Daytona's first pitbox is ~30m past pit entry - driver needs to know to brake hard immediately.
    // Uses earlyPitboxThreshold setting (configurable up to 300m) to define "close to entry".
    //
    // If we have accurate pit entry data from detection, calculate distance from pit entry to pitbox.
    // Otherwise, fall back to heuristic (pitbox in last 10% of track).
    let isEarlyPitbox = false;

    if (pitEntryPct !== null) {
      // Calculate distance from pit entry to pitbox along pit lane direction
      let entryToPitboxDist = (pitboxPct - pitEntryPct) * trackLength;

      // Handle wrap-around (if pitbox is before start/finish but pit entry is after)
      if (entryToPitboxDist < -trackLength * 0.5) {
        entryToPitboxDist += trackLength;
      } else if (entryToPitboxDist > trackLength * 0.5) {
        entryToPitboxDist -= trackLength;
      }

      // Pitbox is "early" if it's ahead in pit lane (>= 0) and within the configured threshold
      // Example: If threshold is 50m and pitbox is 40m past pit entry, isEarlyPitbox = true
      isEarlyPitbox = entryToPitboxDist >= 0 && entryToPitboxDist <= earlyPitboxThreshold;
    } else {
      // Fallback heuristic: if pitbox is in the last 10% of track (before start/finish),
      // it's likely near pit entry. On most tracks, pit lane runs parallel to start/finish,
      // so a pitbox at ~95% track position would be near the beginning of pit lane.
      isEarlyPitbox = pitboxPct > 0.90;
    }

    return {
      distanceToPit,
      progressPercent,
      isApproaching,
      pitboxPct,
      playerPct,
      isEarlyPitbox,
    };
  }, [focusCarIdx, carIdxLapDistPct, session, trackLength, approachDistance, pitEntryPct, earlyPitboxThreshold]);
};
