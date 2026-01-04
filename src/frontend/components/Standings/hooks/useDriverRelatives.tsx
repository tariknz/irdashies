import { useMemo } from 'react';
import {
  useSessionStore,
  useTelemetryValues,
  useFocusCarIdx,
} from '@irdashies/context';
import { useDriverStandings } from './useDriverPositions';
import type { Standings } from '../createStandings';

// === TEMPORARY RAW TELEMETRY LOGGER ===
// Captures raw iRacing telemetry to files in C:\Temp\irdashies
// Files are written every 30 seconds with accumulated data
// Set RAW_LOG_ENABLED = true to enable for debugging
const RAW_LOG_ENABLED = false;
const RAW_LOG_INTERVAL_MS = 30000; // Write to file every 30 seconds
const RAW_LOG_SAMPLE_INTERVAL_MS = 1000; // Sample data every 1 second
let lastRawLogTime = 0;
let lastSampleTime = 0;
let logBuffer: string[] = [];
let fileIndex = 0;
let sessionStartTime = 0;

// Declare the debug bridge type for TypeScript
declare global {
  interface Window {
    debugBridge?: {
      writeLog: (filename: string, content: string) => Promise<{ success: boolean; path?: string; error?: string }>;
    };
  }
}

interface RawLogEntry {
  sessionTime: number;
  carIdx: number;
  driver: string;
  estTime: number;      // CarIdxEstTime - iRacing's estimated gap
  lapDistPct: number;   // CarIdxLapDistPct - track position 0-1
  lap: number;          // CarIdxLap
  lastLapTime: number;  // CarIdxLastLapTime
  bestLapTime: number;  // CarIdxBestLapTime
  trackSurface: number; // CarIdxTrackSurface
  f2Time: number;       // CarIdxF2Time - time behind leader
  onPitRoad: boolean;
  playerEstTime: number; // Player's CarIdxEstTime for comparison
  playerDistPct: number; // Player's position
  // Calculated for comparison
  estTimeDelta: number;  // Difference in CarIdxEstTime (other - player)
  simpleGap: number;     // Our simple calculation
  currentGap: number;    // What we're currently showing
}

const CSV_HEADER = 'sessionTime,carIdx,driver,estTime,playerEstTime,estTimeDelta,lapDistPct,playerDistPct,lap,lastLap,bestLap,surface,f2Time,pitRoad,simpleGap,currentGap';

function sampleTelemetry(
  sessionTime: number,
  playerIdx: number,
  entries: RawLogEntry[]
) {
  if (!RAW_LOG_ENABLED) return;

  const now = Date.now();

  // Initialize session start time
  if (sessionStartTime === 0) {
    sessionStartTime = now;
    fileIndex = 0;
  }

  // Only sample every SAMPLE_INTERVAL
  if (now - lastSampleTime < RAW_LOG_SAMPLE_INTERVAL_MS) return;
  lastSampleTime = now;

  // Add entries to buffer
  for (const e of entries) {
    logBuffer.push(
      `${e.sessionTime.toFixed(2)},${e.carIdx},"${e.driver.substring(0,20)}",${e.estTime.toFixed(3)},${e.playerEstTime.toFixed(3)},${e.estTimeDelta.toFixed(3)},${e.lapDistPct.toFixed(4)},${e.playerDistPct.toFixed(4)},${e.lap},${e.lastLapTime.toFixed(3)},${e.bestLapTime.toFixed(3)},${e.trackSurface},${e.f2Time.toFixed(3)},${e.onPitRoad},${e.simpleGap.toFixed(3)},${e.currentGap.toFixed(3)}`
    );
  }

  // Write to file periodically
  if (now - lastRawLogTime >= RAW_LOG_INTERVAL_MS && logBuffer.length > 0) {
    lastRawLogTime = now;
    const content = CSV_HEADER + '\n' + logBuffer.join('\n');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `telemetry_${timestamp}_${fileIndex}.csv`;

    // Write asynchronously via bridge
    if (window.debugBridge) {
      window.debugBridge.writeLog(filename, content).then((result) => {
        if (result.success) {
          console.log(`[DebugLog] Written ${logBuffer.length} entries to ${result.path}`);
        } else {
          console.error(`[DebugLog] Failed to write: ${result.error}`);
        }
      });
    }

    // Clear buffer and increment file index
    logBuffer = [];
    fileIndex++;
  }
}
// === END TEMPORARY RAW TELEMETRY LOGGER ===

export const useDriverRelatives = ({ buffer }: { buffer: number }) => {
  const driversGrouped = useDriverStandings();
  const drivers = driversGrouped as Standings[];
  const carIdxLapDistPct = useTelemetryValues('CarIdxLapDistPct');
  const carIdxLap = useTelemetryValues('CarIdxLap');
  const carIdxTrackSurface = useTelemetryValues('CarIdxTrackSurface');
  const sessionTime = useTelemetryValues('SessionTime')?.[0] ?? 0;
  // CarIdxEstTime - iRacing's native estimated time gap calculation
  const carIdxEstTime = useTelemetryValues('CarIdxEstTime');
  // Raw telemetry values for logging only
  const carIdxLastLapTime = useTelemetryValues('CarIdxLastLapTime');
  const carIdxBestLapTime = useTelemetryValues('CarIdxBestLapTime');
  const carIdxF2Time = useTelemetryValues('CarIdxF2Time');
  // Use focus car index which handles spectator mode (uses CamCarIdx when spectating)
  const playerIndex = useFocusCarIdx();
  const paceCarIdx =
    useSessionStore((s) => s.session?.DriverInfo?.PaceCarIdx) ?? -1;

  const standings = useMemo(() => {
    const driversByCarIdx = new Map(drivers.map(driver => [driver.carIdx, driver]));

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

    const calculateDelta = (otherCarIdx: number) => {
      const playerCarIdx = playerIndex ?? 0;
      const player = playerIndex !== undefined ? driversByCarIdx.get(playerIndex) : undefined;
      const other = driversByCarIdx.get(otherCarIdx);

      // Get class info
      const playerClassId = player?.carClass?.id;
      const otherClassId = other?.carClass?.id;
      const isSameClass = playerClassId !== undefined && playerClassId === otherClassId;

      // Get lap times - use other car's class lap time for cross-class (more accurate for their position)
      const otherEstLapTime = other?.carClass?.estLapTime ?? 0;
      const playerEstLapTime = player?.carClass?.estLapTime ?? 0;
      // For cross-class, use the other car's lap time; for same-class, use the faster time
      const baseLapTime = isSameClass
        ? Math.min(playerEstLapTime, otherEstLapTime) || Math.max(playerEstLapTime, otherEstLapTime)
        : otherEstLapTime || playerEstLapTime;

      // Calculate distance-based delta (always needed for sanity check and fallback)
      const playerDistPct = carIdxLapDistPct?.[playerCarIdx];
      const otherDistPct = carIdxLapDistPct?.[otherCarIdx];

      if (playerDistPct === undefined || otherDistPct === undefined) {
        return 0;
      }

      let distPctDifference = otherDistPct - playerDistPct;
      if (distPctDifference > 0.5) {
        distPctDifference -= 1.0;
      } else if (distPctDifference < -0.5) {
        distPctDifference += 1.0;
      }
      const distanceBasedDelta = distPctDifference * baseLapTime;

      // Check if either car is in pits - CarIdxEstTime is unreliable for pit cars
      const playerInPits = player?.onPitRoad ?? false;
      const otherInPits = other?.onPitRoad ?? false;

      // Only use CarIdxEstTime for same-class cars on track
      // It drifts for cross-class due to different lap speed assumptions
      if (!isSameClass || playerInPits || otherInPits) {
        return distanceBasedDelta;
      }

      // Use iRacing's native CarIdxEstTime for same-class gap calculation
      const playerEstTime = carIdxEstTime?.[playerCarIdx];
      const otherEstTime = carIdxEstTime?.[otherCarIdx];

      if (playerEstTime === undefined || otherEstTime === undefined) {
        return distanceBasedDelta;
      }

      const estTimeDelta = otherEstTime - playerEstTime;

      // Sanity check: CarIdxEstTime can be wrong after pit exit, teleport, or at S/F crossing
      // 1. Gap must be reasonable (not more than half a lap time)
      // 2. Sign must match the distance-based calculation (both agree on who is ahead)
      const maxReasonableGap = baseLapTime * 0.5;
      const signsMatch = (estTimeDelta >= 0) === (distanceBasedDelta >= 0) ||
                         Math.abs(distanceBasedDelta) < 0.5; // Allow small deltas where sign might flip
      const estTimeIsSane = Math.abs(estTimeDelta) < maxReasonableGap && signsMatch;

      if (!estTimeIsSane) {
        return distanceBasedDelta;
      }

      return estTimeDelta;
    };

    const sortedDrivers = drivers
      .filter((driver) => 
        (driver.onTrack || driver.carIdx === playerIndex) && 
        driver.carIdx > -1 && 
        driver.carIdx !== paceCarIdx
      )
      .map((result) => {
        const relativePct = calculateRelativePct(result.carIdx);
        return {
          ...result,
          relativePct,
          delta: calculateDelta(result.carIdx),
        };
      })
      .filter((result) => !isNaN(result.relativePct) && !isNaN(result.delta));

    const playerArrIndex = sortedDrivers.findIndex(
      (result) => result.carIdx === playerIndex,
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

    const finalResult = [...driversAhead, player, ...driversBehind];

    // === RAW TELEMETRY LOGGING ===
    if (RAW_LOG_ENABLED && playerIndex !== undefined) {
      const playerDistPct = carIdxLapDistPct?.[playerIndex] ?? 0;
      const playerEstTime = carIdxEstTime?.[playerIndex] ?? 0;
      const playerLapTime = driversByCarIdx.get(playerIndex)?.carClass?.estLapTime ?? 90;

      const rawEntries: RawLogEntry[] = finalResult.map((d) => {
        const otherDistPct = carIdxLapDistPct?.[d.carIdx] ?? 0;
        const otherEstTime = carIdxEstTime?.[d.carIdx] ?? 0;
        let distDiff = otherDistPct - playerDistPct;
        if (distDiff > 0.5) distDiff -= 1.0;
        else if (distDiff < -0.5) distDiff += 1.0;

        return {
          sessionTime,
          carIdx: d.carIdx,
          driver: d.driver?.name ?? `Car${d.carIdx}`,
          estTime: otherEstTime,
          playerEstTime,
          estTimeDelta: otherEstTime - playerEstTime,
          lapDistPct: carIdxLapDistPct?.[d.carIdx] ?? 0,
          playerDistPct,
          lap: carIdxLap?.[d.carIdx] ?? 0,
          lastLapTime: carIdxLastLapTime?.[d.carIdx] ?? 0,
          bestLapTime: carIdxBestLapTime?.[d.carIdx] ?? 0,
          trackSurface: carIdxTrackSurface?.[d.carIdx] ?? 0,
          f2Time: carIdxF2Time?.[d.carIdx] ?? 0,
          onPitRoad: d.onPitRoad,
          simpleGap: distDiff * playerLapTime,
          currentGap: d.delta,
        };
      });

      sampleTelemetry(sessionTime, playerIndex, rawEntries);
    }

    return finalResult;
  }, [buffer, playerIndex, carIdxLapDistPct, carIdxLap, carIdxTrackSurface, sessionTime, drivers, paceCarIdx, carIdxEstTime, carIdxLastLapTime, carIdxBestLapTime, carIdxF2Time]);

  return standings;
};
