import { useSessionLaps, useTelemetryValue } from '@irdashies/context';
import { useMemo } from 'react';

export const useSessionLapCount = () => {
  const sessionNum = useTelemetryValue('SessionNum');
  const sessionLaps = useSessionLaps(sessionNum);
  const current = useTelemetryValue('Lap');
  const timeRemaining = useTelemetryValue('SessionTimeTotal');
  const timeElapsed = useTelemetryValue('SessionTimeRemain');

  const result = useMemo(() => {
    const result = {
      current: 0,
      total: 0,
      timeElapsed: 0,
      timeRemaining: 0,
    };

    if (!sessionLaps) {
      return result;
    }

    if (typeof sessionLaps === 'number') {
      result.total = sessionLaps;
    }

    result.current = current ?? 0;
    result.timeRemaining = timeRemaining ?? 0;
    result.timeElapsed = timeElapsed ?? 0;

    return result;
  }, [sessionLaps, current, timeRemaining, timeElapsed]);

  return result;
};
