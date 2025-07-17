import { useMemo } from 'react';
import {
  useCarIdxAverageLapTime,
  useDriverCarIdx,
  useSessionStore,
  useTelemetryValues,
} from '@irdashies/context';
import { useDriverStandings } from './useDriverPositions';

export const useDriverRelatives = ({ buffer }: { buffer: number }) => {
  const drivers = useDriverStandings();
  const carIdxLapDistPct = useTelemetryValues('CarIdxLapDistPct');
  const playerIndex = useDriverCarIdx();
  const paceCarIdx =
    useSessionStore((s) => s.session?.DriverInfo?.PaceCarIdx) ?? -1;
  const carIdxAverageLapTime = useCarIdxAverageLapTime();

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
    };

    const calculateDelta = (otherCarIdx: number) => {
      const playerCarIdx = playerIndex ?? 0;

      const playerDistPct = carIdxLapDistPct?.[playerCarIdx];
      const otherDistPct = carIdxLapDistPct?.[otherCarIdx];

      // Use the slower car's lap time for more conservative deltas in multiclass
      const playerEstLapTime = carIdxAverageLapTime[playerCarIdx] ?? 0;
      const otherEstLapTime = carIdxAverageLapTime[otherCarIdx] ?? 0;
      const baseLapTime = Math.max(playerEstLapTime, otherEstLapTime);

      let distPctDifference = otherDistPct - playerDistPct;

      if (distPctDifference > 0.5) {
        distPctDifference -= 1.0;
      } else if (distPctDifference < -0.5) {
        distPctDifference += 1.0;
      }

      const timeDelta = distPctDifference * baseLapTime;

      return timeDelta;
    };

    const filterAndMapDrivers = () => {
      return drivers
        .filter((driver) => driver.onTrack || driver.carIdx === playerIndex) // filter out drivers not on track
        .filter((driver) => driver.carIdx > -1 && driver.carIdx !== paceCarIdx) // filter out pace car
        .map((result) => ({
          ...result,
          relativePct: calculateRelativePct(result.carIdx),
        }))
        .filter((result) => !isNaN(result.relativePct))
        .sort((a, b) => b.relativePct - a.relativePct) // sort by relative pct
        .map((result) => ({
          ...result,
          delta: calculateDelta(result.carIdx),
        }))
        .filter((result) => !isNaN(result.delta));
    };

    const allRelatives = filterAndMapDrivers();
    const playerArrIndex = allRelatives.findIndex(
      (result) => result.carIdx === playerIndex,
    );

    // if the player is not in the list, return an empty array
    if (playerArrIndex === -1) {
      return [];
    }

    // buffered slice to get only the drivers around the player
    const start = Math.max(0, playerArrIndex - buffer);
    const end = Math.min(allRelatives.length, playerArrIndex + buffer + 1);

    return allRelatives.slice(start, end);
  }, [
    buffer,
    playerIndex,
    carIdxLapDistPct,
    drivers,
    paceCarIdx,
    carIdxAverageLapTime,
  ]);

  return standings;
};
