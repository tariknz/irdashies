import { useEffect } from 'react';
import type { StandingsSnapshot } from '@irdashies/types';
import { shallow } from 'zustand/shallow';
import { useStandingsSelector } from '../ChannelStore';
import { usePitLapStore } from './PitLapStore';

const selectPitLapTelemetry = (snapshot: StandingsSnapshot) =>
  [
    snapshot.carIdxOnPitRoad,
    snapshot.carIdxLap,
    snapshot.sessionUniqueId,
    Math.floor(snapshot.sessionTime),
    snapshot.carIdxTrackSurface,
    snapshot.sessionState,
  ] as const;

const pitLapTelemetryEqual = (
  previous: ReturnType<typeof selectPitLapTelemetry>,
  next: ReturnType<typeof selectPitLapTelemetry>
) =>
  shallow(previous[0], next[0]) &&
  shallow(previous[1], next[1]) &&
  previous[2] === next[2] &&
  previous[3] === next[3] &&
  shallow(previous[4], next[4]) &&
  previous[5] === next[5];

export const usePitLapStoreUpdater = (enabled: boolean) => {
  const telemetry = useStandingsSelector(selectPitLapTelemetry, {
    enabled,
    equality: pitLapTelemetryEqual,
  });
  const updatePitLapTimes = usePitLapStore((state) => state.updatePitLaps);

  useEffect(() => {
    if (!enabled || !telemetry) return;
    updatePitLapTimes(...telemetry);
  }, [enabled, telemetry, updatePitLapTimes]);
};
