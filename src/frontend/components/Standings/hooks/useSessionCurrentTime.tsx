import { useMemo } from 'react';
import { useTelemetryValue } from '@irdashies/context';

export const useSessionCurrentTime = () => {
  const options: Intl.DateTimeFormatOptions = useMemo(
    () => ({
      hour: 'numeric',
      minute: '2-digit',
    }),
    []
  );
  // session time of day is in seconds
  const sessionTime = useTelemetryValue('SessionTimeOfDay');
  
  const formattedTime = useMemo(() => {
    if (sessionTime == null) return '';
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setSeconds(sessionTime);
    return date.toLocaleTimeString([], options);
  }, [sessionTime, options]);

  return formattedTime;
};
