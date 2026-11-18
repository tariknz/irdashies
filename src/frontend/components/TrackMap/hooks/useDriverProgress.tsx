import { useMemo } from 'react';
import {
  useFocusCarIdx,
  useSessionDrivers,
  useSessionQualifyingResults,
  useSessionQualifyPositions,
  useSessionStore,
  trackStateSelectors,
  useTrackStateSelector,
} from '@irdashies/context';

const EMPTY_POSITIONS: readonly number[] = [];

const samePositions = (
  previous: readonly number[] | undefined,
  next: readonly number[] | undefined
): boolean => {
  if (Object.is(previous, next)) return true;
  if (!previous || !next || previous.length !== next.length) return false;
  for (let index = 0; index < previous.length; index++) {
    if (!Object.is(previous[index], next[index])) return false;
  }
  return true;
};

// Drivers progress logic
export const useDriverProgress = () => {
  const driverIdx = useFocusCarIdx();
  const drivers = useSessionDrivers();
  const driversLapDist =
    useTrackStateSelector(trackStateSelectors.carIdxLapDistPct) ??
    EMPTY_POSITIONS;
  const carIdxClassPosition = useTrackStateSelector(
    trackStateSelectors.carIdxClassPosition,
    { equality: samePositions }
  );
  const sessionNum =
    useTrackStateSelector(trackStateSelectors.sessionNum) ?? undefined;
  const paceCarIdx =
    useSessionStore((s) => s.session?.DriverInfo?.PaceCarIdx) ?? -1;

  const qualifyingResultsRaw = useSessionQualifyingResults();
  const sessionQualifyPositions = useSessionQualifyPositions(sessionNum);

  // Heat race fallback: QualifyResultsInfo.Results may be null, use QualifyPositions instead
  const qualifyingResults = useMemo(() => {
    if (qualifyingResultsRaw?.length) return qualifyingResultsRaw;
    return sessionQualifyPositions?.map((q) => ({
      CarIdx: q.CarIdx,
      ClassPosition: q.ClassPosition,
    }));
  }, [qualifyingResultsRaw, sessionQualifyPositions]);

  // Stable identity data — recomputes for roster/focus/pace-car/class-position
  // or qualifying changes, but not for volatile lap progress.
  const driverIdentities = useMemo(() => {
    if (!drivers) return [];

    // Build carIdx -> qualifying class position map for fallback ordering
    const qualifyingPositionByCarIdx = new Map<number, number>();
    if (qualifyingResults?.length) {
      for (const r of qualifyingResults) {
        qualifyingPositionByCarIdx.set(r.CarIdx, r.ClassPosition);
      }
    }

    // Compute fallback positions using ALL drivers (not just on-track) so that
    // a driver in the pits still holds their standings position and on-track
    // drivers behind them get the correct number.
    const allParticipants = drivers.filter(
      (d) => !d.CarIsPaceCar && !d.IsSpectator && d.CarIdx !== paceCarIdx
    );
    const byClass: Record<string, typeof allParticipants> = {};
    for (const d of allParticipants) {
      if (!byClass[d.CarClassID]) byClass[d.CarClassID] = [];
      byClass[d.CarClassID].push(d);
    }
    // Build carIdx -> effective class position map
    const effectivePosition: Record<number, number> = {};
    const isRankedPosition = (carIdx: number): boolean => {
      const pos = carIdxClassPosition?.[carIdx];
      return pos !== undefined && isFinite(pos) && pos > 0;
    };
    for (const classDrivers of Object.values(byClass)) {
      const numRanked = classDrivers.filter((d) =>
        isRankedPosition(d.CarIdx)
      ).length;
      const unranked = classDrivers
        .filter((d) => !isRankedPosition(d.CarIdx))
        .sort((a, b) => {
          const qA = qualifyingPositionByCarIdx.get(a.CarIdx);
          const qB = qualifyingPositionByCarIdx.get(b.CarIdx);
          if (qA !== undefined && qB !== undefined) return qA - qB;
          if (qA !== undefined) return -1;
          if (qB !== undefined) return 1;
          return a.CarNumber.localeCompare(b.CarNumber, undefined, {
            numeric: true,
          });
        });
      unranked.forEach((d, index) => {
        effectivePosition[d.CarIdx] = numRanked + index + 1;
      });
    }

    return drivers
      .filter((d) => d.CarIdx !== paceCarIdx)
      .map((driver) => ({
        driver,
        isPlayer: driver.CarIdx === driverIdx,
        classPosition: isRankedPosition(driver.CarIdx)
          ? carIdxClassPosition?.[driver.CarIdx]
          : effectivePosition[driver.CarIdx],
      }));
  }, [drivers, driverIdx, paceCarIdx, carIdxClassPosition, qualifyingResults]);

  // Volatile progress data — recomputes on every position tick
  const driversTrackData = useMemo(() => {
    if (!driversLapDist.length) return [];

    return driverIdentities
      .map((identity) => ({
        ...identity,
        progress: driversLapDist[identity.driver.CarIdx] ?? -1,
      }))
      .filter((d) => d.progress > -1); // ignore drivers not on track
  }, [driverIdentities, driversLapDist]);

  return { drivers: driversTrackData, identities: driverIdentities };
};
