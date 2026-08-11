import { useEffect, useMemo } from 'react';
import type { StandingsSnapshot } from '@irdashies/types';
import { shallow } from 'zustand/shallow';
import { useDriverCarIdx, useSessionStore } from '../SessionStore/SessionStore';
import { useStandingsSelector } from '../ChannelStore';
import { usePushToPassStore } from './PushToPassStore';

const selectPushToPassTelemetry = (snapshot: StandingsSnapshot) =>
  [
    snapshot.carIdxP2PStatus,
    snapshot.carIdxP2PCount,
    Math.floor(snapshot.sessionTime),
    snapshot.sessionUniqueId,
  ] as const;

const pushToPassTelemetryEqual = (
  previous: ReturnType<typeof selectPushToPassTelemetry>,
  next: ReturnType<typeof selectPushToPassTelemetry>
) =>
  shallow(previous[0], next[0]) &&
  shallow(previous[1], next[1]) &&
  previous[2] === next[2] &&
  previous[3] === next[3];

export const usePushToPassStoreUpdater = (enabled: boolean) => {
  const telemetry = useStandingsSelector(selectPushToPassTelemetry, {
    enabled,
    equality: pushToPassTelemetryEqual,
  });
  const sessionDrivers = useSessionStore((s) => s.session?.DriverInfo?.Drivers);
  const playerCarIdx = useDriverCarIdx();
  const update = usePushToPassStore((s) => s.update);
  const carIdxToCarId = useMemo(() => {
    const map: Record<number, number> = {};
    for (const driver of sessionDrivers ?? [])
      map[driver.CarIdx] = driver.CarID;
    return map;
  }, [sessionDrivers]);

  useEffect(() => {
    if (!enabled || !telemetry) return;
    update(
      telemetry[0],
      telemetry[1],
      carIdxToCarId,
      telemetry[2],
      telemetry[3],
      playerCarIdx
    );
  }, [enabled, telemetry, carIdxToCarId, playerCarIdx, update]);
};
