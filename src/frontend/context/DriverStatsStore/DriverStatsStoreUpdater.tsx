import { useEffect, useRef, memo } from 'react';
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

  // calculateIRatingGain is O(N²) Math.exp calls per class. The effect fires
  // whenever any field on any driver changes (incident counts flap every few
  // seconds), but only IRating + class-position actually feed the calc.
  // Cache the last result keyed by a fingerprint of those fields and reuse it
  // when nothing material has changed.
  const ratingCacheRef = useRef<{
    fingerprint: string;
    changes: Record<number, number>;
  }>({ fingerprint: '', changes: {} });

  useEffect(() => {
    if (!drivers || !sessionPositions) {
      ratingCacheRef.current = { fingerprint: '', changes: {} };
      setStats({}, {});
      return;
    }

    const isRace = sessionType === 'Race';
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
    let iratingChanges: Record<number, number> = {};

    if (isRace && isOfficial) {
      const sessionPosMap = new Map<number, number>();
      sessionPositions.forEach((p) =>
        sessionPosMap.set(p.CarIdx, p.ClassPosition + 1)
      );

      // Fingerprint the inputs that actually affect calculateIRatingGain.
      // Iteration order matters because non-starter finishRank is derived from
      // it, so we encode iteration position (`i`) into the key.
      let fingerprint = '';
      drivers.forEach((d, i) => {
        if (d.IsSpectator || d.CarIsPaceCar) return;
        const classPos = sessionPosMap.get(d.CarIdx);
        fingerprint += `${i}:${d.CarClassID}:${d.CarIdx}:${d.IRating}:${classPos ?? -1};`;
      });

      if (fingerprint === ratingCacheRef.current.fingerprint) {
        iratingChanges = ratingCacheRef.current.changes;
      } else {
        // Group drivers by class
        const driversByClass = new Map<number, typeof drivers>();
        drivers.forEach((d) => {
          if (d.IsSpectator || d.CarIsPaceCar) return;
          const classId = d.CarClassID;
          const list = driversByClass.get(classId) || [];
          list.push(d);
          driversByClass.set(classId, list);
        });

        driversByClass.forEach((classDrivers) => {
          const startersCount = classDrivers.filter((d) =>
            sessionPosMap.has(d.CarIdx)
          ).length;

          let nonStarterIndex = 0;
          const raceResultsInput: RaceResult<number>[] = classDrivers.map(
            (d) => {
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
            }
          );

          if (raceResultsInput.length > 0) {
            const results = calculateIRatingGain(raceResultsInput);
            results.forEach((res) => {
              iratingChanges[res.raceResult.driver] = res.iratingChange;
            });
          }
        });

        ratingCacheRef.current = { fingerprint, changes: iratingChanges };
      }
    } else {
      ratingCacheRef.current = { fingerprint: '', changes: {} };
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
