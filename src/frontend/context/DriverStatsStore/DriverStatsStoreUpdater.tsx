import { useEffect, memo } from 'react';
import {
  useSessionDrivers,
  useSessionPositions,
  useSessionType,
  useSessionIsOfficial,
  useSessionQualifyingResults,
  useTelemetryValue,
} from '@irdashies/context';
import { calculateIRatingGain, RaceResult } from '@irdashies/utils/iratingGain';
import { useDriverStatsStore } from './DriverStatsStore';

export const DriverStatsStoreUpdater = memo(() => {
  const drivers = useSessionDrivers();
  const sessionNum = useTelemetryValue('SessionNum');
  const sessionPositions = useSessionPositions(sessionNum);
  const sessionType = useSessionType(sessionNum);
  const isOfficial = useSessionIsOfficial();
  const qualifyingResults = useSessionQualifyingResults();
  const setStats = useDriverStatsStore((s) => s.setStats);

  useEffect(() => {
    if (!drivers || !sessionPositions) {
      setStats({}, {});
      return;
    }

    const isRace = sessionType === 'Race';
    const iratingChanges: Record<number, number> = {};
    const positionChanges: Record<number, number> = {};

    // 1. Calculate Position Changes (vs Qualifying)
    if (isRace && qualifyingResults && qualifyingResults.length > 0) {
      const qualClassPosMap = new Map<number, number>();
      qualifyingResults.forEach((q) => {
        qualClassPosMap.set(q.CarIdx, q.ClassPosition + 1);
      });

      sessionPositions.forEach((p) => {
        const qualPos = qualClassPosMap.get(p.CarIdx);
        if (qualPos !== undefined) {
          // Positive = moved up (started P5, now P3 -> +2)
          positionChanges[p.CarIdx] = qualPos - (p.ClassPosition + 1);
        }
      });
    }

    // 2. Calculate iRating Changes (per Class)
    if (isRace && isOfficial) {
      // Group drivers by class
      const driversByClass = new Map<number, typeof drivers>();
      drivers.forEach((d) => {
        if (d.IsSpectator || d.CarIsPaceCar) return;
        const classId = d.CarClassID;
        const list = driversByClass.get(classId) || [];
        list.push(d);
        driversByClass.set(classId, list);
      });

      const sessionPosMap = new Map<number, number>();
      sessionPositions.forEach((p) =>
        sessionPosMap.set(p.CarIdx, p.ClassPosition + 1)
      );

      driversByClass.forEach((classDrivers) => {
        const startersCount = classDrivers.filter((d) =>
          sessionPosMap.has(d.CarIdx)
        ).length;

        let nonStarterIndex = 0;
        const raceResultsInput: RaceResult<number>[] = classDrivers.map((d) => {
          const classPos = sessionPosMap.get(d.CarIdx);
          const started = classPos !== undefined;

          let finishRank: number;
          if (started) {
            finishRank = classPos;
          } else {
            finishRank = startersCount + nonStarterIndex + 1;
            nonStarterIndex++;
          }

          return {
            driver: d.CarIdx,
            finishRank,
            startIRating: d.IRating,
            started,
          };
        });

        if (raceResultsInput.length > 0) {
          const results = calculateIRatingGain(raceResultsInput);
          results.forEach((res) => {
            iratingChanges[res.raceResult.driver] = res.iratingChange;
          });
        }
      });
    }

    setStats(iratingChanges, positionChanges);
  }, [
    drivers,
    sessionPositions,
    sessionType,
    isOfficial,
    qualifyingResults,
    setStats,
  ]);

  return null;
});

DriverStatsStoreUpdater.displayName = 'DriverStatsStoreUpdater';
