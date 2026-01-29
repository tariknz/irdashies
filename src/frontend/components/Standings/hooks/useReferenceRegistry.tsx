import { useRef, useCallback } from 'react';

/** The interval step used for normalizing track percentage keys. */
export const REFERENCE_INTERVAL = 0.0025;
const DECIMAL_PLACES = REFERENCE_INTERVAL.toString().split('.')[1]?.length || 0;

/** Represents a single telemetry sample recorded at a specific distance around the track.
 * Used for interpolating time gaps between cars at different positions. */
export interface ReferencePoint {
  /** The specific position on the track where this point was recorded.
   * Represented as a normalized percentage from 0.0 (Start/Finish) to 1.0. */
  trackPct: number;

  /**
   * The elapsed time in seconds from the start of the lap to this point.
   * Calculated as: (Current Session Time - ReferenceLap.startTime). */
  timeElapsedSinceStart: number;
}

/**
 * A container for all timing data associated with a specific lap.
 * This can represent an active lap currently being recorded or a finalized "Best Lap". */
export interface ReferenceLap {
  /**
   * A lookup map of track positions to timing data.
   * Key: A quantized/normalized track percentage (e.g., 0.1025).
   * Value: The specific ReferencePoint data.
   *
   * This Map allows O(1) access to find the time split at any point on the track. */
  refPoints: Map<number, ReferencePoint>;

  /**
   * The session timestamp (in seconds) when this lap began.
   * Used as the anchor point for calculating `timeElapsedSinceStart`.
   */
  startTime: number;

  /**
   * The session timestamp (in seconds) when this lap was completed.
   * If the lap is currently in progress, this is set to -1.
   */
  finishTime: number;

  /**
   * The most recent raw track percentage received from telemetry.
   *
   * CRITICAL FOR LOGIC:
   * 1. Used to detect if the car is moving forward or backward (spins).
   * 2. Used to detect the "wrap-around" event (crossing Start/Finish)
   * by comparing `lastTrackedPct` (>0.9) vs `currentPct` (<0.1).
   */
  lastTrackedPct: number;
}

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
  const normalizedKey = parseFloat(
    (key - (key % REFERENCE_INTERVAL)).toFixed(DECIMAL_PLACES)
  );

  return normalizedKey < 0 ? 0 : normalizedKey;
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
  const laps = useRef<Map<number, ReferenceLap>>(new Map());
  const bestLaps = useRef<Map<number, ReferenceLap>>(new Map());

  /**
   * Updates the reference registry for a specific driver.
   *
   * Stores the `sessionTime` at a specific `trackPct`.
   *
   * @param carIdx - The unique identifier for the driver/car.
   * @param trackPct - The current percentage distance around the track (0.0 - 1.0).
   * @param sessionTime - The current session time in seconds.
   */
  const collectLapData = useCallback(
    (carIdx: number, trackPct: number, sessionTime: number) => {
      let refLap = laps.current.get(carIdx);
      const key = normalizeKey(trackPct);
      // 1. Initialization
      if (!refLap) {
        refLap = {
          startTime: sessionTime,
          finishTime: -1,
          // TODO: Maybe only do a new map and let end of function handle?
          refPoints: new Map([[key, { trackPct, timeElapsedSinceStart: 0 }]]),
          lastTrackedPct: trackPct,
        };

        laps.current.set(carIdx, refLap);
        return;
      }

      // 2. Lap Completion Logic
      const isLapComplete = refLap.lastTrackedPct > 0.95 && trackPct < 0.1;

      if (isLapComplete) {
        refLap.finishTime = sessionTime;
        const bestLap = bestLaps.current.get(carIdx);

        const MIN_POINTS_FOR_VALID_LAP = 350;

        if (refLap.refPoints.size >= MIN_POINTS_FOR_VALID_LAP) {
          // If no best lap exists OR this one is faster, save it
          if (!bestLap) {
            bestLaps.current.set(carIdx, refLap);
          } else {
            const currentLapTime = refLap.finishTime - refLap.startTime;
            const bestLapTime = bestLap.finishTime - bestLap.startTime;
            if (currentLapTime > 0 && currentLapTime < bestLapTime) {
              bestLaps.current.set(carIdx, refLap);
            }
          }
        }

        // Reset for new lap
        refLap = {
          startTime: sessionTime,
          finishTime: -1,
          refPoints: new Map([[key, { trackPct, timeElapsedSinceStart: 0 }]]),
          lastTrackedPct: trackPct,
        };
        laps.current.set(carIdx, refLap);
      }

      // 3. Data Collection
      // Always update lastTrackPct so we detect the wrap accurately next frame
      // refLap.lastTrackedPct = trackPct;

      // Only add point if this specific 0.25% bucket is empty
      const lastRefPoint = refLap.refPoints.get(key);
      if (!lastRefPoint) {
        refLap.refPoints.set(key, {
          timeElapsedSinceStart: sessionTime - refLap.startTime,
          trackPct,
        });

        refLap.lastTrackedPct = trackPct;
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
  const getReferenceLap = useCallback((carIdx: number): ReferenceLap => {
    return (
      bestLaps.current.get(carIdx) ?? {
        startTime: -1,
        finishTime: -1,
        refPoints: new Map(),
        lastTrackedPct: -1,
      }
    );
  }, []);

  return { collectLapData, getReferenceLap };
};
