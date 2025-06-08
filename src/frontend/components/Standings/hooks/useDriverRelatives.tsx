import { useMemo } from 'react';
import {
  useDriverCarIdx,
  useSessionStore,
  useTelemetryValues,
} from '@irdashies/context';
import { useDriverStandings } from './useDriverPositions';

export const useDriverRelatives = ({ buffer }: { buffer: number }) => {
  const drivers = useDriverStandings();
  const carIdxLapDistPct = useTelemetryValues('CarIdxLapDistPct');
  const carIdxLap = useTelemetryValues('CarIdxLap');

  const playerIndex = useDriverCarIdx();
  const driverCarEstLapTime = useSessionStore(
    (s) => s.session?.DriverInfo?.DriverCarEstLapTime ?? 0
  );

  const standings = useMemo(() => {
    const calculateDelta = (otherCarIdx: number) => {
      const playerCarIdx = playerIndex ?? 0;

      const playerLapNum = carIdxLap?.[playerCarIdx];
      const playerDistPct = carIdxLapDistPct?.[playerCarIdx];

      const otherLapNum = carIdxLap?.[otherCarIdx];
      const otherDistPct = carIdxLapDistPct?.[otherCarIdx];

      if (
        playerLapNum === undefined ||
        playerLapNum < 0 ||
        playerDistPct === undefined ||
        playerDistPct < 0 ||
        playerDistPct > 1 ||
        otherLapNum === undefined ||
        otherLapNum < 0 ||
        otherDistPct === undefined ||
        otherDistPct < 0 ||
        otherDistPct > 1 ||
        driverCarEstLapTime <= 0
      ) {
        return NaN;
      }

      // Calculate distance between cars as a percentage of the track
      let distanceBetween = 0.0;
      if (otherDistPct > playerDistPct) {
        distanceBetween = -(otherDistPct - playerDistPct);
      } else {
        distanceBetween = playerDistPct - otherDistPct;
      }

      // Use the projected lap time to calculate the time delta
      const timeDelta = distanceBetween * driverCarEstLapTime;

      return timeDelta * -1;
    };

    const isHalfLapDifference = (car1: number, car2: number) => {
      const diff = (car1 - car2 + 1) % 1;
      return diff <= 0.5;
    };

    const filterAndMapDrivers = (isAhead: boolean) => {
      return drivers
        .filter((driver) => driver.onTrack || driver.carIdx === playerIndex)
        .filter((result) => {
          const playerDistPct = carIdxLapDistPct?.[playerIndex ?? 0];
          const carDistPct = carIdxLapDistPct?.[result.carIdx];
          return isAhead
            ? isHalfLapDifference(carDistPct, playerDistPct)
            : isHalfLapDifference(playerDistPct, carDistPct);
        })
        .map((result) => ({
          ...result,
          delta: calculateDelta(result.carIdx),
        }))
        .filter((result) => (isAhead ? result.delta > 0 : result.delta < 0))
        .sort((a, b) => (isAhead ? a.delta - b.delta : b.delta - a.delta))
        .slice(0, buffer)
        .sort((a, b) => b.delta - a.delta);
    };

    const carsAhead = filterAndMapDrivers(true);
    const player = drivers.find((result) => result.carIdx === playerIndex);
    const carsBehind = filterAndMapDrivers(false);

    if (!player) {
      return [];
    }

    const relatives = [...carsAhead, { ...player, delta: 0 }, ...carsBehind];

    return relatives;
  }, [
    drivers,
    playerIndex,
    carIdxLap,
    carIdxLapDistPct,
    driverCarEstLapTime,
    buffer,
  ]);

  return standings;
};
