import { useMemo } from 'react';
import {
  useSessionStore,
  useTelemetryValues,
  useFocusCarIdx,
} from '@irdashies/context';
import { useDriverStandings } from './useDriverPositions';
import type { Standings } from '../createStandings';
import { ReferenceLap, useReferenceRegistry } from './useReferenceRegistry';

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
  const { processDriver, getReferenceLap } = useReferenceRegistry();

  const standings = useMemo(() => {
    const driversByCarIdx = new Map(
      drivers.map((driver) => [driver.carIdx, driver])
    );

    const interpolateTimeFromRef = (
      currTrackPct: number,
      refLap: ReferenceLap
    ): number => {
      const { points, totalLapTime } = refLap;
      if (!points) return currTrackPct * totalLapTime;

      // Find the segment the percentage falls into
      for (let i = 0; i < points.length - 1; i++) {
        const point1 = points[i];
        const point2 = points[i + 1];

        if (currTrackPct >= point1.pct && currTrackPct <= point2.pct) {
          const ratio = (currTrackPct - point1.pct) / (point2.pct - point1.pct);
          return point1.time + ratio * (point2.time - point1.time);
        }
      }

      return currTrackPct * totalLapTime;
    };

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

    const getEstTimeScaled = (
      driverAhead: { estTime: number; classEstTime: number; trackPct: number },
      driverBehind: { estTime: number; classEstTime: number; trackPct: number }
    ): number => {
      // Scale opponent estimated time to player's car class
      let estTimeScaled =
        (driverAhead.estTime * driverBehind.classEstTime) /
        driverAhead.classEstTime;

      // Make sure opponent time is not ahead when behind on track, and not behind when ahead on track.
      if (driverAhead.trackPct < driverBehind.trackPct) {
        estTimeScaled = Math.min(driverBehind.estTime, estTimeScaled);
      } else if (driverAhead.trackPct > driverBehind.trackPct) {
        estTimeScaled = Math.max(driverBehind.estTime, estTimeScaled);
      }

      return estTimeScaled;
    };

    const getEstTimeDiff = (
      estLapTime: number,
      opponentEstTime: number,
      playerEstTime: number
    ): number => {
      const SECONDS_EPSILON = 0.0001;

      if (
        estLapTime < SECONDS_EPSILON ||
        playerEstTime < SECONDS_EPSILON ||
        opponentEstTime < SECONDS_EPSILON
      ) {
        return 0.0;
      }

      let timeDiff = opponentEstTime - playerEstTime;

      if (timeDiff < -0.5 * estLapTime) {
        timeDiff += estLapTime;
      } else if (timeDiff > 0.5 * estLapTime) {
        timeDiff -= estLapTime;
      }

      return timeDiff;
    };

    const calculateFallbackDelta = (otherCarIdx: number) => {
      const playerCarIdx = playerIndex ?? 0;
      const player =
        playerIndex !== undefined
          ? driversByCarIdx.get(playerIndex)
          : undefined;
      const other = driversByCarIdx.get(otherCarIdx);

      // Get lap times - use other car's class lap time for cross-class (more accurate for their position)
      const playerEstTime = carIdxEstTime?.[playerCarIdx];
      const otherEstTime = carIdxEstTime?.[otherCarIdx];
      const otherClassEstTime = other?.carClass?.estLapTime ?? 0;
      const playerClassEstTime = player?.carClass?.estLapTime ?? 0;
      const playerDistPct = carIdxLapDistPct?.[playerCarIdx];
      const otherDistPct = carIdxLapDistPct?.[otherCarIdx];

      const otherDriverData = {
        estTime: otherEstTime,
        classEstTime: otherClassEstTime,
        trackPct: otherDistPct,
      };

      const playerDriverData = {
        estTime: playerEstTime,
        classEstTime: playerClassEstTime,
        trackPct: playerDistPct,
      };

      // Calculate distance-based delta (always needed for sanity check and fallback)
      if (playerDistPct === undefined || otherDistPct === undefined) {
        return 0;
      }

      let delta = 0;
      if (otherDistPct > playerDistPct) {
        const scaledEstTime = getEstTimeScaled(
          otherDriverData,
          playerDriverData
        );

        delta = getEstTimeDiff(
          playerDriverData.classEstTime,
          scaledEstTime,
          playerEstTime
        );
      } else if (otherDistPct < playerDistPct) {
        const scaledEstTime = getEstTimeScaled(
          playerDriverData,
          otherDriverData
        );

        delta = getEstTimeDiff(
          otherDriverData.classEstTime,
          otherDriverData.estTime,
          scaledEstTime
        );
      }

      return delta;
    };

    const calculateDelta = (otherCarIdx: number) => {
      const playerIdx = playerIndex ?? 0;
      const playerRef = getReferenceLap(playerIdx); // Get from our new hook
      const otherRef = getReferenceLap(otherCarIdx); // Get from our new hook

      // Fallback if no reference exists yet
      if (!otherRef || !playerRef) {
        return calculateFallbackDelta(otherCarIdx);
      }

      const playerTrckPct = carIdxLapDistPct?.[playerIdx] ?? 0;
      const otherTrckPct = carIdxLapDistPct?.[otherCarIdx] ?? 0;
      let delta = 0;

      if (playerTrckPct > otherTrckPct) {
        // Player is ahead
        const timeWhenOpponentReachesPlayerPosition = interpolateTimeFromRef(
          playerTrckPct,
          otherRef
        );
        const timeOpponentIsAtNow = interpolateTimeFromRef(
          otherTrckPct,
          otherRef
        );

        delta = timeWhenOpponentReachesPlayerPosition - timeOpponentIsAtNow;
      } else {
        // Opponent is ahead
        const timeWhenPlayerReachesOpponentPosition = interpolateTimeFromRef(
          otherTrckPct,
          playerRef
        );
        const timePlayerIsAtNow = interpolateTimeFromRef(
          playerTrckPct,
          playerRef
        );

        delta = timeWhenPlayerReachesOpponentPosition - timePlayerIsAtNow;
      }

      const halfLap = otherRef.totalLapTime * 0.5;
      if (delta > halfLap) delta -= otherRef.totalLapTime;
      else if (delta < -halfLap) delta += otherRef.totalLapTime;

      return delta;
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
        processDriver(
          result.carIdx,
          carIdxLapDistPct[result.carIdx],
          carIdxEstTime[result.carIdx],
          result.onPitRoad
        );
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
    drivers,
    buffer,
    playerIndex,
    carIdxLapDistPct,
    getReferenceLap,
    paceCarIdx,
    processDriver,
    carIdxEstTime,
  ]);

  return standings;
};
