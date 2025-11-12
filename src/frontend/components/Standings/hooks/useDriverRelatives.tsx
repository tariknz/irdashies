import { useMemo } from 'react';
import {
  useDriverCarIdx,
  useSessionStore,
  useTelemetryValues,
} from '@irdashies/context';
import { useDriverStandings } from './useDriverPositions';
import type { Standings } from '../createStandings';



export const useDriverRelatives = ({ buffer }: { buffer: number }) => {
  const driversGrouped = useDriverStandings();
  const drivers = driversGrouped as Standings[];
  const carIdxLapDistPct = useTelemetryValues('CarIdxLapDistPct');
  const playerIndex = useDriverCarIdx();
  const paceCarIdx =
    useSessionStore((s) => s.session?.DriverInfo?.PaceCarIdx) ?? -1;


  const standings = useMemo(() => {
    const driversByCarIdx = new Map(drivers.map(driver => [driver.carIdx, driver]));
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

      const player = playerIndex !== undefined ? driversByCarIdx.get(playerIndex) : undefined;
      const other = driversByCarIdx.get(otherCarIdx);

      // Use the slower car's lap time for more conservative deltas in multiclass
      const playerEstLapTime = player?.carClass?.estLapTime ?? 0;
      const otherEstLapTime = other?.carClass?.estLapTime ?? 0;
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

    const sortedDrivers = drivers
      .filter((driver) => 
        (driver.onTrack || driver.carIdx === playerIndex) && 
        driver.carIdx > -1 && 
        driver.carIdx !== paceCarIdx
      )
      .map((result) => {
        const relativePct = calculateRelativePct(result.carIdx);
        return {
          ...result,
          relativePct,
          delta: calculateDelta(result.carIdx),
        };
      })
      .filter((result) => !isNaN(result.relativePct) && !isNaN(result.delta));

    const playerArrIndex = sortedDrivers.findIndex(
      (result) => result.carIdx === playerIndex,
    );

    // if the player is not in the list, return an empty array
    if (playerArrIndex === -1) {
      return [];
    }

    const player = sortedDrivers[playerArrIndex];

    const driversAhead = sortedDrivers
      .filter((d) => d.relativePct > 0)
      .sort((a, b) => a.relativePct - b.relativePct) // sort ascending (closest to player first)
      .slice(0, buffer)
      .reverse(); // reverse to get furthest to closest for display

    const driversBehind = sortedDrivers
      .filter((d) => d.relativePct < 0)
      .sort((a, b) => b.relativePct - a.relativePct) // sort descending (closest to player first)
      .slice(0, buffer);

    return [...driversAhead, player, ...driversBehind];
  }, [buffer, playerIndex, carIdxLapDistPct, drivers, paceCarIdx]);

  return standings;
};
