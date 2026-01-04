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
      const player = playerIndex !== undefined ? driversByCarIdx.get(playerIndex) : undefined;
      const other = driversByCarIdx.get(otherCarIdx);

      // Get class info
      const playerClassId = player?.carClass?.id;
      const otherClassId = other?.carClass?.id;
      const isSameClass = playerClassId !== undefined && playerClassId === otherClassId;

      // Get lap times - use other car's class lap time for cross-class (more accurate for their position)
      const otherEstLapTime = other?.carClass?.estLapTime ?? 0;
      const playerEstLapTime = player?.carClass?.estLapTime ?? 0;
      // For cross-class, use the other car's lap time; for same-class, use the faster time
      const baseLapTime = isSameClass
        ? Math.min(playerEstLapTime, otherEstLapTime) || Math.max(playerEstLapTime, otherEstLapTime)
        : otherEstLapTime || playerEstLapTime;

      // Calculate distance-based delta (always needed for sanity check and fallback)
      const playerDistPct = carIdxLapDistPct?.[playerCarIdx];
      const otherDistPct = carIdxLapDistPct?.[otherCarIdx];

      if (playerDistPct === undefined || otherDistPct === undefined) {
        return 0;
      }

      let distPctDifference = otherDistPct - playerDistPct;
      if (distPctDifference > 0.5) {
        distPctDifference -= 1.0;
      } else if (distPctDifference < -0.5) {
        distPctDifference += 1.0;
      }
      const distanceBasedDelta = distPctDifference * baseLapTime;

      // Check if either car is in pits - CarIdxEstTime is unreliable for pit cars
      const playerInPits = player?.onPitRoad ?? false;
      const otherInPits = other?.onPitRoad ?? false;

      // Only use CarIdxEstTime for same-class cars on track
      // It drifts for cross-class due to different lap speed assumptions
      if (!isSameClass || playerInPits || otherInPits) {
        return distanceBasedDelta;
      }

      // Use iRacing's native CarIdxEstTime for same-class gap calculation
      const playerEstTime = carIdxEstTime?.[playerCarIdx];
      const otherEstTime = carIdxEstTime?.[otherCarIdx];

      if (playerEstTime === undefined || otherEstTime === undefined) {
        return distanceBasedDelta;
      }

      const estTimeDelta = otherEstTime - playerEstTime;

      // Sanity check: CarIdxEstTime can be wrong after pit exit, teleport, or at S/F crossing
      // 1. Gap must be reasonable (not more than half a lap time)
      // 2. Sign must match the distance-based calculation (both agree on who is ahead)
      const maxReasonableGap = baseLapTime * 0.5;
      const signsMatch = (estTimeDelta >= 0) === (distanceBasedDelta >= 0) ||
                         Math.abs(distanceBasedDelta) < 0.5; // Allow small deltas where sign might flip
      const estTimeIsSane = Math.abs(estTimeDelta) < maxReasonableGap && signsMatch;

      if (!estTimeIsSane) {
        return distanceBasedDelta;
      }

      return estTimeDelta;
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
  }, [buffer, playerIndex, carIdxLapDistPct, drivers, paceCarIdx, carIdxEstTime]);

  return standings;
};
