import { useMemo } from 'react';
import {
  useDriverCarIdx,
  useTelemetryValues,
} from '@irdashies/context';
import { useDriverStandings } from './useDriverPositions';

export const useDriverRelatives = ({ buffer }: { buffer: number }) => {
  const carIdxEstTime = useTelemetryValues('CarIdxEstTime');
  const drivers = useDriverStandings();
  const carIdxLapDistPct = useTelemetryValues('CarIdxLapDistPct');
  const playerIndex = useDriverCarIdx();

  const standings = useMemo(() => {
    const player = drivers.find((d) => d.carIdx === playerIndex);
    if (!player) {
      return [];
    }

    const driverEstLapTime = player.carClass.estLapTime ?? 0;

    const calculateDelta = (carIdx: number, isAhead: boolean) => {
      const playerEstTime = carIdxEstTime?.[playerIndex ?? 0];
      const oppositionEstTime = carIdxEstTime?.[carIdx];
      const opposition = drivers.find((d) => d.carIdx === carIdx);
      
      if (!opposition) {
        return 0;
      }

      // Initial time difference
      let delta = (oppositionEstTime - playerEstTime);

      // First normalize to within half a lap time (this is what iRacing does first)
      while (delta < -0.5 * driverEstLapTime) delta += driverEstLapTime;
      while (delta > 0.5 * driverEstLapTime) delta -= driverEstLapTime;

      // Then ensure positive for ahead, negative for behind
      if (isAhead) {
        while (delta < 0) delta += driverEstLapTime;
      } else {
        while (delta > 0) delta -= driverEstLapTime;
      }

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
          delta: calculateDelta(result.carIdx, isAhead),
        }))
        .filter((result) => (isAhead ? result.delta > 0 : result.delta < 0))
        .sort((a, b) => (isAhead ? a.delta - b.delta : b.delta - a.delta))
        .slice(0, buffer)
        .sort((a, b) => b.delta - a.delta);
    };

    const carsAhead = filterAndMapDrivers(true);
    const carsBehind = filterAndMapDrivers(false);

    const relatives = [...carsAhead, { ...player, delta: 0 }, ...carsBehind];

    // TODO: remove pace car if not under caution or pacing

    return relatives;
  }, [drivers, buffer, carIdxEstTime, playerIndex, carIdxLapDistPct]);

  return standings;
};
