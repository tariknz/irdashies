import { useSessionLaps, useTelemetryValue } from '@irdashies/context';
import { useMemo } from 'react';

export const useSessionLapCount = () => {
  const sessionNum = useTelemetryValue('SessionNum');
  const sessionLaps = useSessionLaps(sessionNum);
  const sessionState = useTelemetryValue('SessionState');
  const currentLap = useTelemetryValue('Lap');
  const time = useTelemetryValue('SessionTime');
  const timeTotal = useTelemetryValue('SessionTimeTotal');
  const timeRemaining = useTelemetryValue('SessionTimeRemain');

  const result = useMemo(() => {
    const result = {
      state: 0,
      currentLap: 0,
      totalLaps: 0,
      time: 0,
      timeTotal: 0,
      timeRemaining: 0,
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
    result.currentLap = currentLap ?? 0;
    result.timeRemaining = timeRemaining ?? 0;

    return result;
  }, [sessionLaps, currentLap, sessionState, time, timeTotal, timeRemaining]);

  return result;
};
