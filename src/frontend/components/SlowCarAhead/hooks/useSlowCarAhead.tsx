import {
  useCarIdxOffTrack,
  useFocusCarIdx,
  useSessionDrivers,
  useTelemetryValues,
  useTelemetryValuesRounded,
  useTrackLength,
} from '@irdashies/context';
import { useCallback, useMemo } from 'react';
import { Driver } from '@irdashies/types';
import { useCarIdxSpeed } from '@irdashies/context';
import { useSlowCarAheadSettings } from './useSlowCarAheadSettings';

/**
 * Determines the closest slow car ahead, if one exists.
 */
export const useSlowCarAhead = () => {
  const trackLength = useTrackLength();
  const driverIdx = useFocusCarIdx();
  const drivers = useSessionDrivers();
  const driversLapDist = useTelemetryValuesRounded('CarIdxLapDistPct', 3);
  const carIdxOnPitRoad = useTelemetryValues<boolean[]>('CarIdxOnPitRoad');
  const carIdxOffTrack = useCarIdxOffTrack();
  const carSpeeds = useCarIdxSpeed();
  const settings = useSlowCarAheadSettings();

  // Gets the distance, in meters, to a driver
  const calculateRelativeDist = useCallback(
    (opponentIdx: number) => {
      if (driverIdx === undefined) {
        return NaN;
      }

      const playerDistPct = driversLapDist[driverIdx];
      const opponentDistPct = driversLapDist[opponentIdx];

      let relativePct = opponentDistPct - playerDistPct;

      if (relativePct > 0.5) {
        relativePct -= 1.0;
      } else if (relativePct < -0.5) {
        relativePct += 1.0;
      }

      return relativePct * trackLength;
    },
    [driverIdx, driversLapDist, trackLength]
  );

  return useMemo(() => {
    let driver: Driver | undefined = undefined;
    let distance = Number.POSITIVE_INFINITY;
    let isStopped = false;
    let isOffTrack = false;

    if (drivers === undefined || driverIdx === undefined) {
      return null;
    }

    for (const d of drivers) {
      if (d.CarIdx == driverIdx || d.CarIsPaceCar) {
        continue;
      }

      // Opponent in the pits
      if (carIdxOnPitRoad[d.CarIdx]) {
        continue;
      }

      const speed = carSpeeds[d.CarIdx];
      // Opponent not going that slow
      if (speed > settings.slowSpeedThreshold) {
        continue;
      }

      // Opponent not going that much slower than player
      if (speed + settings.slowSpeedThreshold > carSpeeds[driverIdx]) {
        continue;
      }

      // Opponent behind the player
      const distanceToPlayer = calculateRelativeDist(d.CarIdx);
      if (distanceToPlayer <= 0) {
        continue;
      }

      // Opponent too far ahead of player
      if (distanceToPlayer > settings.maxDistance) {
        continue;
      }

      // We already found a slow car that is closer
      if (distanceToPlayer > distance) {
        continue;
      }

      driver = d;
      distance = distanceToPlayer;
      isStopped = speed <= settings.stoppedSpeedThreshold;
      isOffTrack = carIdxOffTrack[d.CarIdx];
    }

    if (driver === undefined) {
      return null;
    }

    return {
      driver,
      isStopped,
      distance,
      isOffTrack,
    };
  }, [
    drivers,
    driverIdx,
    carIdxOnPitRoad,
    carIdxOffTrack,
    carSpeeds,
    settings.slowSpeedThreshold,
    settings.maxDistance,
    settings.stoppedSpeedThreshold,
    calculateRelativeDist,
  ]);
};
