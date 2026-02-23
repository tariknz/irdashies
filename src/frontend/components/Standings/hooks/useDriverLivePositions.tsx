import { useMemo, useRef, useEffect } from 'react';
import { useCurrentSessionType, useSessionPositions, useSessionStore, useTelemetryValue, useTelemetryValues } from '@irdashies/context';
import { SessionState } from '@irdashies/types';

interface DriverData {
  driverIdx: number;
  progress: number;
  lapCompleted: number;
  sessionLapsCompleted: number;
  sessionClassPosition: number;
  // qualifyPosition: number;
}

/**
 * Computes live in-class positions from telemetry during race sessions.
 *
 * Returns {} when the session is not a race or not in Racing/Checkered, so consumers
 * fall back to the default position feed. Uses lap count + lap distance percent for
 * ordering and groups cars by `CarIdxClass`.
 *
 * During checkered, freezes a snapshot when P1 finishes to keep finishers ahead of
 * cars still running; finished cars tie-break with session class position. Sorting per class:
 * 1) Higher completed laps (falling back to session laps if lap telemetry is -1)
 * 2) Checkered separation of finished vs unfinished
 * 3) Lap progress (lap + dist pct) for cars on the same lap
 *
 * @returns Record of driverIdx -> 1-based class position; empty when not applicable.
 */
export const useDriverLivePositions = ({ enabled }: { enabled: boolean }): Record<number, number> => {

  // Old variables, not used anymore. Left here for reference.
  // const carIdxClassPosition = useTelemetryValues<number[]>('CarIdxClassPosition');
  // const sessionDrivers = useSessionDrivers();
  //const carIdxSessionFlags = useTelemetryValues<number[]>('CarIdxSessionFlags');
  //const isReplayPlaying = useTelemetryValue<boolean>('IsReplayPlaying') ?? false;
  //const sessionQualifyingResults = useSessionQualifyingResults();

  // Refs to hold persistent state across renders
  const lastLapSnapshotRef = useRef<Map<number, number> | undefined>(undefined);
  const p1LapCompletedRef = useRef<number | undefined>(undefined);
  const p1CarRef = useRef<number | undefined>(undefined);

  const sessionType = useCurrentSessionType();
  const sessionNum = useTelemetryValue('SessionNum');
  const sessionPositions = useSessionPositions(sessionNum);
  const sessionState = useTelemetryValue('SessionState') ?? 0;
  const carIdxLapCompleted = useTelemetryValues<number[]>('CarIdxLapCompleted');
  const carIdxLapDistPct = useTelemetryValues<number[]>('CarIdxLapDistPct');
  const carIdxClass = useTelemetryValues<number[]>('CarIdxClass');
  const paceCarIdx = useSessionStore((s) => s.session?.DriverInfo?.PaceCarIdx) ?? -1;
  const p1Car = sessionPositions?.find(pos => pos.Position === 1); // Position is 1-based
  const p1LapCompleted = p1Car ? (carIdxLapCompleted[p1Car.CarIdx] ?? 0) : 0;

  // Handle ref updates in an effect, not during render
  useEffect(() => {

    if (!enabled) return;

    //console.log(lastLapSnapshotRef.current, p1CarRef.current, p1Car?.CarIdx, JSON.stringify(carIdxLapCompleted));

    // Clear ref variables based on session state changes
    if (lastLapSnapshotRef.current !== undefined &&
      (sessionState === SessionState.Racing || sessionState === SessionState.CoolDown)) {
      // Reset last lap snapshot when not racing
      lastLapSnapshotRef.current = undefined;
      p1LapCompletedRef.current = undefined;
      p1CarRef.current = undefined;

      //console.log('reset var');

      // Capture p1Car and p1LapCompleted when checkered flag is shown
    } else if (lastLapSnapshotRef.current === undefined &&
      p1CarRef.current !== p1Car?.CarIdx &&
      sessionState === SessionState.Checkered) {
      p1CarRef.current = p1Car?.CarIdx;
      p1LapCompletedRef.current = p1LapCompleted;

      //console.log('set p1 lap');

      // Capture last lap array snapshot when p1 completes a lap after checkered flag
    } else if (lastLapSnapshotRef.current === undefined &&
      p1LapCompletedRef.current !== undefined &&
      p1LapCompleted > (p1LapCompletedRef.current ?? -1)) {

      //console.log('set lap array');

      lastLapSnapshotRef.current = new Map(carIdxLapCompleted.map((lapCompleted, carIdx) => [carIdx, lapCompleted]));
      const p1carIdx = p1Car?.CarIdx ?? 0
      // Adjust p1 car lap count back by 1 to reflect lap count at checkered
      if (p1carIdx !== 0) lastLapSnapshotRef.current.set(p1carIdx, (lastLapSnapshotRef.current.get(p1carIdx) ?? 0) - 1);
    }

    // console.log('lastLapSnapshot:', lastLapSnapshotRef.current ? JSON.stringify(Object.fromEntries(lastLapSnapshotRef.current), ) : undefined, lastLapSnapshotRef.current, p1CarRef.current, p1Car?.CarIdx);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionState, p1LapCompleted, p1Car]);

  return useMemo(() => {

    if (!enabled) return {};

    /*
    Return empty object to fall back to default position system when:
    - Replay is playing
    - Not a race session
    - Race session but not in Racing or Checkered state
    - All drivers have no class assigned (-1)
    */
    // if (isReplayPlaying) return {};
    if (sessionType !== 'Race') return {};
    if (sessionType === 'Race') {
      if (sessionState !== SessionState.Racing && sessionState !== SessionState.Checkered) return {};
    }
    if (carIdxClass.length > 0 && carIdxClass.every(classId => classId === -1)) return {};

    // console.log('Live !!!');

    // To group drivers by class
    const driversByClass = new Map<number, DriverData[]>();

    // Ensure all necessary data is available
    if (carIdxLapCompleted.length > 0 && carIdxLapDistPct.length > 0 && carIdxClass.length > 0) {
      // Create a map for O(1) lookup instead of O(n) find
      //const qualifyingResultsMap = new Map(sessionQualifyingResults?.map(result => [result.CarIdx, result]) ?? []);
      const sessionPositionsMap = new Map(sessionPositions?.map(position => [position.CarIdx, position]) ?? []);

      carIdxLapCompleted.forEach((lapCompleted, driverIdx) => {

        // Skip the pace car
        if (driverIdx === paceCarIdx) return;

        // Old variables, not used anymore. Left here for reference.
        // const qualifyingResultSource = qualifyingResultsMap.get(driver.CarIdx);
        // const qualifyPosition = qualifyingResultSource ? qualifyingResultSource.ClassPosition + 1 : -1;
        // const iRacingPosition = carIdxClassPosition[driver.CarIdx] ?? -1;

        // Collect necessary data
        const sessionPositionSource = sessionPositionsMap.get(driverIdx);
        const sessionClassPosition = sessionPositionSource ? sessionPositionSource.ClassPosition + 1 : -1;
        const sessionLapsCompleted = sessionPositionSource?.LapsComplete ?? 0;
        const classId = carIdxClass[driverIdx] ?? -1;
        const distPct = carIdxLapDistPct[driverIdx] ?? 0;

        // const lapCompleted = lapCompleted ?? 0;

        // Create driver data object
        const driverData: DriverData = {
          driverIdx: driverIdx,
          progress: lapCompleted + distPct,
          lapCompleted,
          sessionLapsCompleted,
          sessionClassPosition,
          // qualifyPosition,
        };

        // Group drivers by their class
        const classDrivers = driversByClass.get(classId) ?? [];
        classDrivers.push(driverData);
        driversByClass.set(classId, classDrivers);
      });
    }

    // To hold the final live positions
    const livePositions: Record<number, number> = {};

    // Calculate live positions within each class
    driversByClass.forEach((drivers) => {

      drivers.sort((a, b) => {

        // if(a.driverIdx === 39) {
        //   // console.log('Debug 39', lastLapSnapshotRef.current?.get(a.driverIdx));
        //   // console.log('Debug 39', JSON.stringify(lastLapSnapshotRef.current));
        // }

        // After the race has ended, if a driver gets out of the car, their lapCompleted
        // telemetry can go to -1. In that case, use sessionLapsCompleted for comparison.
        const driverALapsCompleted = a.lapCompleted === -1 && a.sessionLapsCompleted > -1 
          ? a.sessionLapsCompleted 
          : a.lapCompleted;
        const driverBLapsCompleted = b.lapCompleted === -1 && b.sessionLapsCompleted > -1 
          ? b.sessionLapsCompleted 
          : b.lapCompleted;

        if (driverALapsCompleted > driverBLapsCompleted) return -1; // cars on different laps
        if (driverALapsCompleted < driverBLapsCompleted) return 1; // cars on different laps

        // both cars are on the same lap
        // during checkered flag, handle finished vs unfinished cars
        if (sessionState === SessionState.Checkered && lastLapSnapshotRef.current !== undefined) { // Tower is showing checkered flag, not all cars have finished

          // If cars are on the same lap, the one that has crossed the finish line is behind.
          // Yes, behind, it's counter-intuitive.
          if ((driverALapsCompleted > (lastLapSnapshotRef.current?.get(a.driverIdx) ?? 0)) &&
            (driverBLapsCompleted <= (lastLapSnapshotRef.current?.get(b.driverIdx) ?? 0))) { // a finished, b didn't
            // if (a.lapCompleted > b.lapCompleted) return -1;
            return 1;
          }

          // If cars are on the same lap, the one that has crossed the finish line is behind.
          // Yes, behind, it's counter-intuitive.
          if ((driverBLapsCompleted > (lastLapSnapshotRef.current?.get(b.driverIdx) ?? 0)) &&
            (driverALapsCompleted <= (lastLapSnapshotRef.current?.get(a.driverIdx) ?? 0))) { // b finished, a didn't
            // if (b.lapCompleted > a.lapCompleted) return 1;
            return -1;
          }

          if (driverALapsCompleted > (lastLapSnapshotRef.current?.get(a.driverIdx) ?? 0) &&
            driverBLapsCompleted > (lastLapSnapshotRef.current?.get(b.driverIdx) ?? 0)) {
            return a.sessionClassPosition - b.sessionClassPosition; // both cars finished
          }
        }

        // finally use progress for the rest
        return b.progress - a.progress;
      });

      // Assign positions within the class starting from 1
      drivers.forEach((driver, index) => {
        livePositions[driver.driverIdx] = index + 1;
      });

    });

    return livePositions;
  }, [enabled, carIdxLapCompleted, carIdxLapDistPct, carIdxClass, sessionPositions, paceCarIdx, sessionType, sessionState]);
};
