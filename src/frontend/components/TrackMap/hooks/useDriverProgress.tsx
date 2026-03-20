import { useMemo } from 'react';
import {
  useFocusCarIdx,
  useSessionDrivers,
  useSessionQualifyingResults,
  useSessionQualifyPositions,
  useSessionStore,
  useTelemetryValue,
  useTelemetryValues,
  useTelemetryValuesRounded,
} from '@irdashies/context';

// Drivers progress logic
export const useDriverProgress = () => {
  const driverIdx = useFocusCarIdx();
  const drivers = useSessionDrivers();
  const driversLapDist = useTelemetryValuesRounded('CarIdxLapDistPct', 3);
  const paceCarIdx =
    useSessionStore((s) => s.session?.DriverInfo?.PaceCarIdx) ?? -1;

  const qualifyingResultsRaw = useSessionQualifyingResults();
  const sessionNum = useTelemetryValue('SessionNum');
  const sessionQualifyPositions = useSessionQualifyPositions(sessionNum);

  // Heat race fallback: QualifyResultsInfo.Results may be null, use QualifyPositions instead
  const qualifyingResults = qualifyingResultsRaw?.length
    ? qualifyingResultsRaw
    : sessionQualifyPositions?.map((q) => ({
        CarIdx: q.CarIdx,
        ClassPosition: q.ClassPosition,
      }));

  // Get class position data from telemetry
  const carIdxClassPosition = useTelemetryValues<number[]>(
    'CarIdxClassPosition'
  );

  const driversTrackData = useMemo(() => {
    if (!drivers || !driversLapDist.length) return [];

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
    for (const classDrivers of Object.values(byClass)) {
      const numRanked = classDrivers.filter(
        (d) => (carIdxClassPosition?.[d.CarIdx] ?? 0) > 0
      ).length;
      const unranked = classDrivers
        .filter((d) => (carIdxClassPosition?.[d.CarIdx] ?? 0) <= 0)
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
      .map((driver) => ({
        driver: driver,
        progress: driversLapDist[driver.CarIdx] ?? -1,
        isPlayer: driver.CarIdx === driverIdx,
        classPosition:
          (carIdxClassPosition?.[driver.CarIdx] ?? 0) > 0
            ? carIdxClassPosition?.[driver.CarIdx]
            : effectivePosition[driver.CarIdx],
      }))
      .filter((d) => d.progress > -1) // ignore drivers not on track
      .filter((d) => d.driver.CarIdx !== paceCarIdx); // ignore pace car
  }, [
    drivers,
    driversLapDist,
    driverIdx,
    paceCarIdx,
    carIdxClassPosition,
    qualifyingResults,
  ]);

  return driversTrackData;
};
