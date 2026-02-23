// import { useRef, useCallback } from 'react';
// import { TRACK_SURFACES } from '../relativeGapHelpers';
// import { precomputePCHIPTangents } from '../splineInterpolation';
//
// /** The interval step used for normalizing track percentage keys. */
// export const REFERENCE_INTERVAL = 0.0025;
// const DECIMAL_PLACES = REFERENCE_INTERVAL.toString().split('.')[1]?.length || 0;
//
// /** Represents a single telemetry sample recorded at a specific distance around the track.
//  * Used for interpolating time gaps between cars at different positions. */
// export interface ReferencePoint {
//   trackPct: number;
//   timeElapsedSinceStart: number;
//   tangent: number | undefined;
// }
//
// /**
//  * A container for all timing data associated with a specific lap.
//  * This can represent an active lap currently being recorded or a finalized "Best Lap". */
// export interface ReferenceLap {
//   classId: number;
//   refPoints: Map<number, ReferencePoint>;
//   startTime: number;
//   finishTime: number;
//   lastTrackedPct: number;
//   isCleanLap: boolean;
// }
//
// /**
//  * Quantizes a raw track percentage value into a normalized key based on the reference interval.
//  *
//  * This function floors the input key to the nearest multiple of `REFERENCE_INTERVAL`
//  * and fixes the precision to avoid floating-point artifacts.
//  *
//  * @param key - The raw track percentage (0.0 to 1.0) or generic numeric key.
//  * @returns The normalized key suitable for map lookups.
//  */
// // export function normalizeKey(key: number): number {
// //   const normalizedKey = parseFloat(
// //     (key - (key % REFERENCE_INTERVAL)).toFixed(DECIMAL_PLACES)
// //   );
// //
// //   return normalizedKey < 0 || normalizedKey >= 1 ? 0 : normalizedKey;
// // }
//
// function isLapClean(trackSurface: number, isOnPitRoad: boolean): boolean {
//   return trackSurface === TRACK_SURFACES.OnTrack && !isOnPitRoad;
// }
//
// /**
//  * A custom hook that maintains a registry of driver lap times indexed by track percentage.
//  *
//  * This hook persists data across renders using a `useRef` based `Map`. It provides mechanisms
//  * to ingest new driver positions and retrieve the accumulated reference lap data.
//  *
//  * @returns An object containing functions to process driver updates and retrieve lap data.
//  */
// export const useReferenceRegistry = (
//   seriesId: number,
//   trackId: number,
//   classList: number[]
// ) => {
//   // Persistence for 63 drivers
//   const persistedLaps = useRef<Map<number, ReferenceLap>>(
//     new Map<number, ReferenceLap>()
//   );
//
//   const initialize = useCallback(() => {
//     const loadReferenceLaps = async () => {
//       const results = await Promise.all(
//         classList.map(async (classId) => {
//           try {
//             const lap = (await window.referenceLapsBridge.getReferenceLap(
//               seriesId,
//               trackId,
//               classId
//             )) as ReferenceLap;
//             console.log(
//               `Class ${classId} Lap Time: ${lap.finishTime - lap.startTime}`
//             );
//             return { classId, lap };
//           } catch (error) {
//             console.error(
//               `Failed to load reference lap for class ${classId}:`,
//               error
//             );
//             return { classId, lap: null };
//           }
//         })
//       );
//
//       // Update the ref synchronously once data arrives
//       results.forEach(({ classId, lap }) => {
//         if (lap) {
//           persistedLaps.current.set(classId, lap);
//         }
//       });
//     };
//
//     console.log('Initilized storage!');
//
//     if (classList.length > 0 && persistedLaps.current.size === 0) {
//       loadReferenceLaps();
//     }
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);
//
//   const laps = useRef<Map<number, ReferenceLap>>(new Map());
//   const bestLaps = useRef<Map<number, ReferenceLap>>(new Map());
//
//   /**
//    * Updates the reference registry for a specific driver.
//    *
//    * Stores the `sessionTime` at a specific `trackPct`.
//    *
//    * @param carIdx - The unique identifier for the driver/car.
//    * @param trackPct - The current percentage distance around the track (0.0 - 1.0).
//    * @param sessionTime - The current session time in seconds.
//    */
//   const collectLapData = useCallback(
//     (
//       carIdx: number,
//       classId: number,
//       trackPct: number,
//       sessionTime: number,
//       trackSurface: number,
//       isOnPitRoad: boolean
//     ) => {
//       let refLap = laps.current.get(carIdx);
//       const key = normalizeKey(trackPct);
//       // 1. Initialization
//       if (!refLap) {
//         refLap = {
//           classId,
//           startTime: sessionTime,
//           finishTime: -1,
//           // TODO: Maybe only do a new map and let end of function handle?
//           refPoints: new Map<number, ReferencePoint>([
//             [key, { trackPct, timeElapsedSinceStart: 0 } as ReferencePoint],
//           ]),
//           lastTrackedPct: trackPct,
//           isCleanLap: isLapClean(trackSurface, isOnPitRoad),
//         };
//
//         laps.current.set(carIdx, refLap);
//         return;
//       }
//
//       // 2. Lap Completion Logic
//       const isLapComplete = refLap.lastTrackedPct > 0.95 && trackPct < 0.05;
//
//       if (isLapComplete) {
//         refLap.finishTime = sessionTime;
//         const currentLapTime = refLap.finishTime - refLap.startTime;
//         const MIN_POINTS_FOR_VALID_LAP = 400;
//
//         if (
//           refLap.refPoints.size >= MIN_POINTS_FOR_VALID_LAP &&
//           currentLapTime > 0
//         ) {
//           const bestLap = bestLaps.current.get(carIdx);
//
//           // If no best lap exists OR this one is faster, save it
//           if (bestLap && refLap.isCleanLap) {
//             const bestLapTime = bestLap.finishTime - bestLap.startTime;
//             if (currentLapTime < bestLapTime) {
//               precomputePCHIPTangents(refLap);
//               bestLaps.current.set(carIdx, refLap);
//
//               const savedLap = persistedLaps.current.get(refLap.classId);
//
//               if (savedLap) {
//                 const savedLapTime = savedLap?.finishTime - savedLap?.startTime;
//                 if (savedLapTime > bestLapTime) {
//                   persistedLaps.current.set(refLap.classId, refLap);
//                   saveLapData(refLap);
//                 }
//               } else {
//                 persistedLaps.current.set(refLap.classId, refLap);
//                 saveLapData(refLap);
//               }
//             }
//           } else {
//             precomputePCHIPTangents(refLap);
//             bestLaps.current.set(carIdx, refLap);
//           }
//         }
//
//         // Reset for new lap
//         refLap = {
//           classId,
//           startTime: sessionTime,
//           finishTime: -1,
//           refPoints: new Map<number, ReferencePoint>([
//             [
//               key,
//               {
//                 trackPct,
//                 timeElapsedSinceStart: 0,
//               } as ReferencePoint,
//             ],
//           ]),
//           lastTrackedPct: trackPct,
//           isCleanLap: isLapClean(trackSurface, isOnPitRoad),
//         };
//         laps.current.set(carIdx, refLap);
//       }
//
//       if (
//         refLap.isCleanLap &&
//         trackSurface !== TRACK_SURFACES.OnTrack &&
//         isOnPitRoad
//       ) {
//         refLap.isCleanLap = false;
//       }
//
//       // 3. Data Collection
//       // Only add point if this specific 0.25% bucket is empty
//       const lastRefPoint = refLap.refPoints.get(key);
//       if (!lastRefPoint && refLap.isCleanLap) {
//         refLap.refPoints.set(key, {
//           timeElapsedSinceStart: sessionTime - refLap.startTime,
//           trackPct,
//         } as ReferencePoint);
//
//         refLap.lastTrackedPct = trackPct;
//       }
//     },
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//     []
//   );
//
//   /**
//    * Retrieves the map of reference points for a specific driver.
//    *
//    * @param carIdx - The unique identifier for the driver.
//    * @returns A Map of normalized track percentages to session times, or undefined if no data exists.
//    */
//   const getReferenceLap = useCallback(
//     (
//       carIdx: number,
//       classId: number,
//       usePersistence: boolean
//     ): ReferenceLap => {
//       const bestLap = bestLaps.current.get(carIdx);
//       if (usePersistence || !bestLap) {
//         const persistedLap = persistedLaps.current.get(classId) ?? {
//           classId,
//           startTime: -1,
//           finishTime: -1,
//           refPoints: new Map<number, ReferencePoint>(),
//           lastTrackedPct: -1,
//           isCleanLap: false,
//         };
//
//         return persistedLap;
//       }
//       return bestLap;
//     },
//     []
//   );
//
//   const clearAllTrackedData = useCallback(() => {
//     bestLaps.current.clear();
//     laps.current.clear();
//     persistedLaps.current.clear();
//   }, []);
//
//   const saveLapData = useCallback(async (newLap: ReferenceLap) => {
//     const classId = newLap.classId;
//     // Create the promise but don't await it yet (batch them below)
//     const savePromise = window.referenceLapsBridge
//       .saveReferenceLap(seriesId, trackId, classId, newLap)
//       .then(() => {
//         console.log(
//           `[Session] Saved new best for class ${classId}: ${newLap.finishTime - newLap.startTime} s`
//         );
//       })
//       .catch((err: Error) => {
//         console.error(`[Session] Failed to save class ${classId}`, err);
//       });
//
//     // Wait for all necessary disk writes to finish in parallel
//     if (savePromise) {
//       await savePromise;
//     }
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);
//
//   const completeSession = useCallback(() => {
//     clearAllTrackedData();
//     initialize();
//   }, [clearAllTrackedData, initialize]);
//
//   return { collectLapData, getReferenceLap, completeSession, initialize };
// };
