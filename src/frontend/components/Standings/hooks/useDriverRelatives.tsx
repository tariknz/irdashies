import { useMemo } from 'react';
import { useDriverCarIdx, useTelemetryValues } from '@irdashies/context';
import { useDriverStandings } from './useDriverPositions';

export const useDriverRelatives = ({ buffer }: { buffer: number }) => {
  const drivers = useDriverStandings();
  const carIdxLapDistPct = useTelemetryValues('CarIdxLapDistPct');
  const carIdxEstTime = useTelemetryValues('CarIdxEstTime');

  const playerIndex = useDriverCarIdx();

  const standings = useMemo(() => {
    const calculateRelativePct = (carIdx: number) => {
      if (playerIndex === undefined) {
        return NaN;
      }

      const playerDistPct = carIdxLapDistPct?.[playerIndex];
      const otherDistPct = carIdxLapDistPct?.[carIdx];

      if (playerDistPct === undefined || otherDistPct === undefined) {
        return NaN;
      }

      const relativePct = otherDistPct - playerDistPct;

      if (relativePct > 0.5) {
        return relativePct - 1.0;
      } else if (relativePct < -0.5) {
        return relativePct + 1.0;
      }

      return relativePct;
    }

    const calculateDelta = (otherCarIdx: number) => {
      if (playerIndex === undefined) {
        return NaN;
      }

      const playerClassEstLap = drivers.find((driver) => driver.carIdx === playerIndex)?.carClass?.estLapTime || 1;
      const otherEstLap = drivers.find((driver) => driver.carIdx === otherCarIdx)?.carClass?.estLapTime || 1;
      const classRatio = otherEstLap / playerClassEstLap;

      const carEstTime = carIdxEstTime?.[otherCarIdx] / classRatio;
      const playerEstLap = carIdxEstTime?.[playerIndex];
      let timeDelta = carEstTime - playerEstLap;

      // handle crossing the start/finish line
      const playerDistPct = carIdxLapDistPct?.[playerIndex];
      const otherDistPct = carIdxLapDistPct?.[otherCarIdx];
      const distPctDifference = otherDistPct - playerDistPct;
      if (distPctDifference > 0.5) {
        timeDelta += -playerClassEstLap;
      } else if (distPctDifference < -0.5) {
        timeDelta += playerClassEstLap;
      }

      return timeDelta;
    };

    const filterAndMapDrivers = () => {
      return drivers
        .filter((driver) => driver.onTrack || driver.carIdx === playerIndex)
        .map((result) => ({
          ...result,
          relativePct: calculateRelativePct(result.carIdx),
        }))
        .filter((result) => !isNaN(result.relativePct))
        .sort((a, b) => b.relativePct - a.relativePct)
        .map((result) => ({
          ...result,
          delta: calculateDelta(result.carIdx),
        }))
        .filter((result) => !isNaN(result.delta));
    };

    const allRelatives = filterAndMapDrivers();
    const playerArrIndex = allRelatives.findIndex((result) => result.carIdx === playerIndex);

    if (playerArrIndex === -1) {
      return [];
    }

    // buffered slice
    const start = Math.max(0, playerArrIndex - buffer);
    const end = Math.min(allRelatives.length, playerArrIndex + buffer + 1);

    return allRelatives.slice(start, end);
  }, [drivers, playerIndex, carIdxLapDistPct, carIdxEstTime, buffer]);

  return standings;
};
