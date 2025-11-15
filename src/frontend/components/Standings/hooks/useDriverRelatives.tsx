import { useMemo } from 'react';
import {
  useDriverCarIdx,
  useSessionStore,
  useTelemetryValues,
  useRelativeGapStore,
} from '@irdashies/context';
import { useDriverStandings } from './useDriverPositions';
import { detectEdgeCases, calculateRelativeGap } from '@irdashies/context/RelativeGapStore';

export const useDriverRelatives = ({ buffer }: { buffer: number }) => {
  const drivers = useDriverStandings();
  const carIdxLapDistPct = useTelemetryValues('CarIdxLapDistPct');
  const carIdxLap = useTelemetryValues('CarIdxLap');
  const carIdxTrackSurface = useTelemetryValues('CarIdxTrackSurface');
  const sessionTime = useTelemetryValues('SessionTime')?.[0] ?? 0;
  const playerIndex = useDriverCarIdx();
  const paceCarIdx =
    useSessionStore((s) => s.session?.DriverInfo?.PaceCarIdx) ?? -1;

  // Access RelativeGapStore config values individually to prevent infinite loops
  const isEnhancedEnabled = useRelativeGapStore((state) => state.config.enabled);
  const interpolationMethod = useRelativeGapStore((state) => state.config.interpolationMethod);

  const standings = useMemo(() => {
    // Get store reference inside useMemo to access getCarHistory
    const store = useRelativeGapStore.getState();
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
      const playerLap = carIdxLap?.[playerCarIdx] ?? 0;
      const otherLap = carIdxLap?.[otherCarIdx] ?? 0;

      const player = playerIndex !== undefined ? driversByCarIdx.get(playerIndex) : undefined;
      const other = driversByCarIdx.get(otherCarIdx);

      // Get class estimated lap times (fallback for Tier 3)
      const playerEstLapTime = player?.carClass?.estLapTime ?? 0;
      const otherEstLapTime = other?.carClass?.estLapTime ?? 0;

      // Check if enhanced gap calculation is enabled
      if (isEnhancedEnabled) {
        // Get position history for both cars
        const playerHistory = store.getCarHistory(playerCarIdx);
        const otherHistory = store.getCarHistory(otherCarIdx);

        // Detect edge cases
        const otherTrackSurface = carIdxTrackSurface?.[otherCarIdx] ?? 0;
        const isOffTrack = otherTrackSurface === -1 || otherTrackSurface === 0;
        const isInPits = other?.onPitRoad ?? false;
        const hasLapHistory = (otherHistory?.lapRecords?.length ?? 0) > 0;

        const edgeCase = detectEdgeCases(
          otherCarIdx,
          isOffTrack,
          isInPits,
          otherLap,
          hasLapHistory,
        );

        // Calculate relative gap using three-tier system
        const gapResult = calculateRelativeGap(
          playerHistory,
          otherHistory,
          {
            playerCarIdx,
            otherCarIdx,
            playerPosition: playerDistPct ?? 0,
            otherPosition: otherDistPct ?? 0,
            playerLap,
            otherLap,
            sessionTime,
          },
          playerEstLapTime,
          otherEstLapTime,
          edgeCase,
          interpolationMethod,
        );

        return gapResult.timeGap;
      }

      // Fallback to old simple distance-based calculation
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
  }, [buffer, playerIndex, carIdxLapDistPct, carIdxLap, carIdxTrackSurface, sessionTime, drivers, paceCarIdx, isEnhancedEnabled, interpolationMethod]);

  return standings;
};
