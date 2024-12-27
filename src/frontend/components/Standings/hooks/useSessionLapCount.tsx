import { useTelemetryValue } from '@irdashies/context';
import { useCurrentSession } from './useCurrentSession';
import { useMemo } from 'react';

export const useSessionLapCount = () => {
  const currentSession = useCurrentSession();
  const current = useTelemetryValue('RaceLaps');
  const timeRemaining = useTelemetryValue('SessionTimeTotal');
  const timeElapsed = useTelemetryValue('SessionTimeRemain');

  const result = useMemo(() => {
    const result = {
      current: 0,
      total: 0,
      timeElapsed: 0,
      timeRemaining: 0,
    };

    if (!currentSession?.SessionLaps) {
      return result;
    }

    if (typeof currentSession.SessionLaps === 'number') {
      result.total = currentSession.SessionLaps;
    }

    result.current = current ?? 0;
    result.timeRemaining = timeRemaining ?? 0;
    result.timeElapsed = timeElapsed ?? 0;

    return result;
  }, [currentSession?.SessionLaps, current, timeRemaining, timeElapsed]);

  return result;
};
