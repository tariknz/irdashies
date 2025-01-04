import { useMemo } from 'react';
import {
  useDriverCarIdx,
  useSessionStore,
  useTelemetryValues,
} from '@irdashies/context';
import { useDriverStandings } from './useDriverPositions';

export const useDriverRelatives = ({ buffer }: { buffer: number }) => {
  const carIdxEstTime = useTelemetryValues('CarIdxEstTime');
  const drivers = useDriverStandings();
  const carIdxLapDistPct = useTelemetryValues('CarIdxLapDistPct');

  const playerIndex = useDriverCarIdx();
  const driverCarEstLapTime = useSessionStore(
    (s) => s.session?.DriverInfo?.DriverCarEstLapTime ?? 0
  );

  const standings = useMemo(() => {
    const calculateDelta = (carIdx: number) => {
      const playerEstTime = carIdxEstTime?.[playerIndex ?? 0];
      const oppositionEstTime = carIdxEstTime?.[carIdx];
      let delta = oppositionEstTime - playerEstTime;

      while (delta < -0.5 * driverCarEstLapTime) delta += driverCarEstLapTime;
      while (delta > 0.5 * driverCarEstLapTime) delta -= driverCarEstLapTime;

      return delta;
    };

    const isHalfLapDifference = (car1: number, car2: number) => {
      const diff = (car1 - car2 + 1) % 1; // Normalize the difference to [0, 1)
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
        .slice(0, buffer) // slice from rear to front if isAhead
        .sort((a, b) => b.delta - a.delta);
    };

    const carsAhead = filterAndMapDrivers(true);
    const player = drivers.find((result) => result.carIdx === playerIndex);
    const carsBehind = filterAndMapDrivers(false);

    if (!player) {
      return [];
    }

    const relatives = [...carsAhead, { ...player, delta: 0 }, ...carsBehind];

    // TODO: remove pace car if not under caution or pacing

    return relatives;
  }, [
    drivers,
    buffer,
    carIdxEstTime,
    playerIndex,
    driverCarEstLapTime,
    carIdxLapDistPct,
  ]);

  return standings;
};
