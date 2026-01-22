import { useRef, useCallback } from 'react';

/**
 * The interval step used for normalizing track percentage keys.
 */
export const REFERENCE_INTERVAL = 0.003;
const DECIMAL_PLACES = 3;

/**
 * Quantizes a raw track percentage value into a normalized key based on the reference interval.
 *
 * This function floors the input key to the nearest multiple of `REFERENCE_INTERVAL`
 * and fixes the precision to avoid floating-point artifacts.
 *
 * @param key - The raw track percentage (0.0 to 1.0) or generic numeric key.
 * @returns The normalized key suitable for map lookups.
 */
export function normalizeKey(key: number): number {
  const testKey = parseFloat(
    (key - (key % REFERENCE_INTERVAL)).toFixed(DECIMAL_PLACES)
  );
  return testKey;
}

/**
 * A custom hook that maintains a registry of driver lap times indexed by track percentage.
 *
 * This hook persists data across renders using a `useRef` based `Map`. It provides mechanisms
 * to ingest new driver positions and retrieve the accumulated reference lap data.
 *
 * @returns An object containing functions to process driver updates and retrieve lap data.
 */
export const useReferenceRegistry = () => {
  // Persistence for 63 drivers
  //                       carIdx      trkPct  time
  const bestLaps = useRef<Map<number, Map<number, number>>>(new Map());

  /**
   * Updates the reference registry for a specific driver.
   *
   * Stores the `sessionTime` at a specific `trackPct` if the existing record
   * is older than 10 seconds (indicating a new lap or significant gap).
   *
   * @param carIdx - The unique identifier for the driver/car.
   * @param trackPct - The current percentage distance around the track (0.0 - 1.0).
   * @param sessionTime - The current session time in seconds.
   */
  const collectLapData = useCallback(
    (carIdx: number, trackPct: number, sessionTime: number) => {
      let refPoints = bestLaps.current.get(carIdx);

      if (refPoints === undefined) {
        refPoints = new Map();
      }

      const pctKey = normalizeKey(trackPct);
      const key = pctKey < 0 ? 0 : pctKey;

      const lastTime = refPoints.get(pctKey) ?? 0;

      // TODO: Find a better way to update
      if (sessionTime - lastTime > 2) {
        refPoints.set(key, sessionTime);
        bestLaps.current.set(carIdx, refPoints);
      }
    },
    []
  );

  /**
   * Retrieves the map of reference points for a specific driver.
   *
   * @param carIdx - The unique identifier for the driver.
   * @returns A Map of normalized track percentages to session times, or undefined if no data exists.
   */
  const getReferenceLap = useCallback((carIdx: number) => {
    return bestLaps.current.get(carIdx);
  }, []);

  return { collectLapData, getReferenceLap };
};
