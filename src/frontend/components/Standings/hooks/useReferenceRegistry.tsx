import { useRef, useCallback } from 'react';

export interface ReferenceLap {
  points: number[]; // Array of ~200 points
}

const REFERENCE_INTERVAL = 0.005;

export function findClosest(sortedArray: number[], target: number): number {
  let left = 0;
  let right = sortedArray.length - 1;

  if (target <= sortedArray[left]) return sortedArray[left];
  if (target >= sortedArray[right]) return sortedArray[right];

  while (left < right) {
    const mid = Math.floor((left + right) / 2);

    if (sortedArray[mid] === target) {
      return sortedArray[mid];
    }

    if (sortedArray[mid] < target) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  // Since we can be before the closest point, we return the last point that we've passed.
  return sortedArray[left];
}

// const seedKeys = (refPoints: Map<number, number>): Map<number, number> => {
//   for (let i = 0; i < 200; i++) {
//     refPoints.set(i * REFERENCE_INTERVAL, 0);
//   }
//
//   return refPoints;
// };

export function normalizeKey(key: number): number {
  const testKey = parseFloat((key - (key % REFERENCE_INTERVAL)).toFixed(3));
  console.log(`TEST KEY: ${testKey}`);
  return testKey;
  // return parseFloat(
  //   (Math.round(key / REFERENCE_INTERVAL) * REFERENCE_INTERVAL).toFixed(3)
  // );
}

export const useReferenceRegistry = () => {
  // Persistence for 63 drivers
  //                          carIdx      trkPct  time
  const bestLaps = useRef<Map<number, Map<number, number>>>(new Map());

  const processDriver = useCallback(
    (carIdx: number, trackPct: number, sessionTime: number) => {
      let refPoints = bestLaps.current.get(carIdx);

      if (refPoints === undefined) {
        refPoints = new Map();
        // refPoints = seedKeys(refPoints);
      }

      const testTestKey = normalizeKey(trackPct);
      // if key below zero, set to zero
      // console.log(`TEST KEY: ${testTestKey}`);

      // const closestKey = findClosest(
      //   [...refPoints.keys()] as number[],
      //   trackPct
      // );

      refPoints.set(testTestKey, sessionTime);
      bestLaps.current.set(carIdx, refPoints);
      // console.log(`------------ SessionTime: ${sessionTime}`);
      // console.log(`------------ Ref points count: ${refPoints.size}`);
      // console.log(`------------ Closest key: ${closestKey}`);
      // console.log(`------------ Track Pct: ${trackPct}`);
      // console.log(`--- Keys: ${[...refPoints.keys()].join(', ')}`);
      // console.log(`--- Points Times: ${[...refPoints.values()].join(', ')}`);
    },
    []
  );

  const getReferenceLap = useCallback((carIdx: number) => {
    return bestLaps.current.get(carIdx);
  }, []);

  return { processDriver, getReferenceLap };
};
