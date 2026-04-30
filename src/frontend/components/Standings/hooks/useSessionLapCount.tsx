import {
  useSessionLaps,
  useTelemetryValue,
  useTelemetryValues,
  useFocusCarIdx,
  useGreenFlagTimestamp,
  useSetGreenFlagTimestamp,
  useCheckeredLap,
  useSetCheckeredLap,
  useCurrentSessionType,
  useCarIdxClassEstLapTime,
  useCarIdxAverageLapTime,
} from '@irdashies/context';
import { SessionState } from '@irdashies/types';
import { useEffect, useMemo, useRef } from 'react';

export const useSessionLapCount = () => {
  const sessionNum = useTelemetryValue('SessionNum');
  const sessionLaps = useSessionLaps(sessionNum);
  const sessionState = useTelemetryValue('SessionState');
  const carIdxLap = useTelemetryValues('CarIdxLap');
  const carIdxPosition = useTelemetryValues('CarIdxPosition');
  const focusCarIdx = useFocusCarIdx();
  const currentLap = focusCarIdx !== undefined ? carIdxLap?.[focusCarIdx] : 0;
  const time = useTelemetryValue('SessionTime');
  const timeTotal = useTelemetryValue('SessionTimeTotal');
  const timeRemaining = useTelemetryValue('SessionTimeRemain');
  const sessionType = useCurrentSessionType();
  const avgLapTimes = useCarIdxAverageLapTime();
  const classEstLapTimes = useCarIdxClassEstLapTime();

  // Find the race leader
  let leaderCarIdx = -1;
  let leaderLap = 0;
  if (carIdxPosition && carIdxLap) {
    for (let i = 0; i < carIdxPosition.length; i++) {
      if (carIdxPosition[i] === 1) {
        leaderCarIdx = i;
        leaderLap = carIdxLap[i] ?? 0;
        break;
      }
    }
  }

  // Refs to track state transitions and late-join mode
  const prevSessionState = useRef<number | undefined>(undefined);
  const prevLeaderLap = useRef<number | undefined>(undefined);
  const isLateJoin = useRef(false);

  // Get store hooks for tracking green flag time
  const greenFlagTimestamp = useGreenFlagTimestamp();
  const setGreenFlagTimestamp = useSetGreenFlagTimestamp();
  const checkeredLap = useCheckeredLap();
  const setCheckeredLap = useSetCheckeredLap();

  useEffect(() => {
    if (
      sessionType === 'Race' &&
      greenFlagTimestamp == null &&
      sessionState === 4 &&
      time !== undefined
    ) {
      if (
        prevSessionState.current !== undefined &&
        prevSessionState.current < 4
      ) {
        // Witnessed the 3→4 transition: this IS the green flag moment
        setGreenFlagTimestamp(time);
        isLateJoin.current = false;
      } else if (prevSessionState.current === undefined) {
        // First packet already in state 4: late join — defer until P1 crosses S/F
        isLateJoin.current = true;
      }
    }

    // Late join: estimate green flag time once P1 crosses the start/finish line
    if (
      isLateJoin.current &&
      sessionType === 'Race' &&
      greenFlagTimestamp == null &&
      sessionState === 4 &&
      time !== undefined
    ) {
      const prev = prevLeaderLap.current;
      if (prev !== undefined && leaderLap > prev && leaderLap > 0) {
        const lapTimeIdx =
          leaderCarIdx >= 0 ? leaderCarIdx : (focusCarIdx as number);
        const avgLapTime =
          (avgLapTimes[lapTimeIdx] > 0
            ? avgLapTimes[lapTimeIdx]
            : classEstLapTimes?.[lapTimeIdx]) ?? -1;
        if (avgLapTime > 0) {
          setGreenFlagTimestamp(time - leaderLap * avgLapTime);
          isLateJoin.current = false;
        }
      }
    }

    // Track checkered lap: freeze once when checkered is shown, reset for new sessions
    if (sessionState !== undefined && sessionState >= SessionState.Checkered) {
      if (checkeredLap === null && currentLap !== undefined && currentLap > 0) {
        setCheckeredLap(currentLap);
      }
    } else if (
      sessionState !== undefined &&
      sessionState < SessionState.Checkered
    ) {
      if (checkeredLap !== null) {
        setCheckeredLap(null);
      }
    }

    prevSessionState.current = sessionState;
    prevLeaderLap.current = leaderLap;
  }, [
    sessionType,
    greenFlagTimestamp,
    sessionState,
    time,
    leaderLap,
    leaderCarIdx,
    avgLapTimes,
    classEstLapTimes,
    focusCarIdx,
    setGreenFlagTimestamp,
    checkeredLap,
    currentLap,
    setCheckeredLap,
  ]);

  const result = useMemo(() => {
    const result = {
      state: 0,
      currentLap: 0,
      totalLaps: 0,
      time: 0,
      timeTotal: 0,
      timeRemaining: 0,
      greenFlagTimestamp: 0,
    };

    if (!sessionLaps) {
      return result;
    }

    if (typeof sessionLaps === 'number') {
      result.totalLaps = sessionLaps;
    }

    result.state = sessionState ?? 0;
    result.time = time ?? 0;
    result.timeTotal = timeTotal ?? 0;
    const isPostCheckered = (sessionState ?? 0) >= SessionState.Checkered;
    result.currentLap = isPostCheckered
      ? (checkeredLap ?? currentLap ?? 0)
      : (currentLap ?? 0);
    if (
      sessionType === 'Race' &&
      (sessionState ?? 0) === SessionState.GetInCar
    ) {
      const remaining = timeRemaining ?? 0;
      const total = timeTotal ?? 0;
      if (remaining >= 604800 && total >= 604800) {
        result.timeRemaining = -1;
      } else {
        result.timeRemaining = remaining;
      }
    } else {
      result.timeRemaining = timeRemaining ?? 0;
    }
    result.greenFlagTimestamp = greenFlagTimestamp ?? 0;

    return result;
  }, [
    sessionLaps,
    currentLap,
    sessionState,
    sessionType,
    time,
    timeTotal,
    timeRemaining,
    greenFlagTimestamp,
    checkeredLap,
  ]);

  return result;
};
