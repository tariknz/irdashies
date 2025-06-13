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
  const carIdxEstTime = useTelemetryValues('CarIdxEstTime');

  const playerIndex = useDriverCarIdx();
  const paceCarIdx =
    useSessionStore((s) => s.session?.DriverInfo?.PaceCarIdx) ?? -1;

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
      if (playerIndex === undefined) {
        return NaN;
      }

      const player = drivers.find((driver) => driver.carIdx === playerIndex);
      const playerEstLapTime =
        player?.fastestTime || player?.carClass?.estLapTime || 0;
      const playerEstTime = carIdxEstTime?.[playerIndex];
      const otherEstTime = carIdxEstTime?.[otherCarIdx];

      let timeDelta = otherEstTime - playerEstTime;

      // handle crossing the start/finish line
      const playerDistPct = carIdxLapDistPct?.[playerIndex];
      const otherDistPct = carIdxLapDistPct?.[otherCarIdx];

      // handle crossing the start/finish line
      const wrap = playerDistPct - otherDistPct > 0.5;
      if (wrap) {
        timeDelta =
          playerEstTime > otherEstTime
            ? otherEstTime - playerEstTime + playerEstLapTime
            : otherEstTime - playerEstTime - playerEstLapTime;
      }

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
      (result) => result.carIdx === playerIndex
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
    carIdxEstTime,
    paceCarIdx,
  ]);

  return standings;
};
