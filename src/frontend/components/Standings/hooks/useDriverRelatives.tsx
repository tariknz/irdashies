import { useMemo } from 'react';
import {
  useSessionStore,
  useTelemetryValues,
  useFocusCarIdx,
} from '@irdashies/context';
import { useDriverStandings } from './useDriverPositions';
import type { Standings } from '../createStandings';

export const useDriverRelatives = ({ buffer }: { buffer: number }) => {
  const driversGrouped = useDriverStandings();
  const drivers = driversGrouped as Standings[];
  const carIdxLapDistPct = useTelemetryValues('CarIdxLapDistPct');
  // CarIdxEstTime - iRacing's native estimated time gap calculation
  const carIdxEstTime = useTelemetryValues('CarIdxEstTime');
  // Use focus car index which handles spectator mode (uses CamCarIdx when spectating)
  const playerIndex = useFocusCarIdx();
  const paceCarIdx =
    useSessionStore((s) => s.session?.DriverInfo?.PaceCarIdx) ?? -1;

  const standings = useMemo(() => {
    const driversByCarIdx = new Map(
      drivers.map((driver) => [driver.carIdx, driver])
    );

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
      const player = driversByCarIdx.get(playerCarIdx);
      const other = driversByCarIdx.get(otherCarIdx);

      if (!player || !other) return 0;

      // Use the player's estimated lap time as the "Gold Standard" for all gap display
      const playerEstLapTime = player.carClass?.estLapTime ?? 0;
      const otherEstLapTime = other.carClass?.estLapTime ?? 0;

      if (playerEstLapTime === 0 || otherEstLapTime === 0) return 0;

      // 1. Physical Position (Percent)
      const playerDistPct = carIdxLapDistPct?.[playerCarIdx] ?? 0;
      const otherDistPct = carIdxLapDistPct?.[otherCarIdx] ?? 0;

      // 2. Multi-Class Scaling (Even for same class, this normalizes pace-based drift)
      const playerEstTime = carIdxEstTime?.[playerCarIdx] ?? 0;
      const otherEstTime = carIdxEstTime?.[otherCarIdx] ?? 0;

      // Scale the opponent's raw time into the player's car's speed units
      const scaledOtherEstTime =
        otherEstTime * (playerEstLapTime / otherEstLapTime);

      // 3. Handle the Start/Finish Line Crossing
      // If one driver has crossed and the other hasn't, the raw EstTime
      // difference will be ~1 full lap. We must normalize this.
      let estTimeDelta = scaledOtherEstTime - playerEstTime;

      if (estTimeDelta > playerEstLapTime * 0.5) {
        estTimeDelta -= playerEstLapTime;
      } else if (estTimeDelta < -playerEstLapTime * 0.5) {
        estTimeDelta += playerEstLapTime;
      }

      // 4. Clamping (The C# Logic)
      // This prevents 'ghosting' where the UI says a car is ahead when it's physically behind.
      // We use the relativePct logic to determine physical track order.
      let distPctDiff = otherDistPct - playerDistPct;
      if (distPctDiff > 0.5) distPctDiff -= 1.0;
      else if (distPctDiff < -0.5) distPctDiff += 1.0;

      if (distPctDiff < 0) {
        // Other is physically behind: ensure delta is negative (or at most 0)
        estTimeDelta = Math.min(0, estTimeDelta);
      } else {
        // Other is physically ahead: ensure delta is positive (or at least 0)
        estTimeDelta = Math.max(0, estTimeDelta);
      }

      // 5. Emergency Fallback
      // If EstTime is still wildly different from distance-based time,
      // someone likely just teleported or the data is stale.
      const distanceBasedDelta = distPctDiff * playerEstLapTime;
      if (Math.abs(estTimeDelta - distanceBasedDelta) > 5.0) {
        return distanceBasedDelta;
      }

      return estTimeDelta;
    };

    const sortedDrivers = drivers
      .filter(
        (driver) =>
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
      (result) => result.carIdx === playerIndex
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
  }, [
    buffer,
    playerIndex,
    carIdxLapDistPct,
    drivers,
    paceCarIdx,
    carIdxEstTime,
  ]);

  return standings;
};
