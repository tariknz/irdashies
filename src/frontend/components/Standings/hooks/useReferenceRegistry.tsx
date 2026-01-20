import { useRef, useCallback } from 'react';

interface ReferencePoint {
  pct: number; // 0.0 to 1.0 (track distance percentage)
  time: number; // Seconds elapsed since S/F line at this point
}

export interface ReferenceLap {
  points: ReferencePoint[]; // Array of ~200 points
  totalLapTime: number;
}

const SAMPLE_SIZE_LIMIT = 185;
const REFERENCE_INTERVAL = 0.005;

export const useReferenceRegistry = () => {
  // Persistence for 63 drivers
  const bestLaps = useRef<Map<number, ReferenceLap>>(new Map());
  const lapBuffers = useRef<Map<number, ReferencePoint[]>>(new Map());
  const lastRecordedPcts = useRef<Map<number, number>>(new Map());

  const processDriver = useCallback(
    (carIdx: number, pct: number, estTime: number, isOnPitRoad: boolean) => {
      if (!lapBuffers.current.has(carIdx)) {
        lapBuffers.current.set(carIdx, []);
        lastRecordedPcts.current.set(carIdx, 0);
      }

      const buf = lapBuffers.current.get(carIdx) ?? [];
      const lastPct = lastRecordedPcts.current.get(carIdx) ?? 0;

      // Detect Lap Reset
      if (pct < lastPct) {
        if (buf.length > SAMPLE_SIZE_LIMIT && !isOnPitRoad) {
          const totalTime = buf[buf.length - 1].time;
          const currentBest = bestLaps.current.get(carIdx);
          if (!currentBest || totalTime < currentBest.totalLapTime) {
            console.log(
              `-------------------- Updating best lap: ${totalTime}, ${carIdx} -----------------------`
            );

            const lastRefPoint = { pct, time: totalTime + estTime };

            console.log(`Last ref point for new lap: ${lastRefPoint.time}`);

            bestLaps.current.set(carIdx, {
              points: [...buf, lastRefPoint],
              totalLapTime: totalTime,
            });
          }
        }
        buf.length = 0;
        lastRecordedPcts.current.set(carIdx, 0);
      }
      // Record at 0.5% intervals
      else if (!isOnPitRoad && pct >= lastPct + REFERENCE_INTERVAL) {
        buf.push({ pct, time: estTime });
        lastRecordedPcts.current.set(carIdx, pct);
      }
    },
    []
  );

  const getReferenceLap = useCallback((carIdx: number) => {
    return bestLaps.current.get(carIdx);
  }, []);

  return { processDriver, getReferenceLap };
};
