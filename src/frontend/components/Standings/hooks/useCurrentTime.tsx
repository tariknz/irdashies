import { useEffect, useMemo, useState } from 'react';

export const useCurrentTime = () => {
  const options: Intl.DateTimeFormatOptions = useMemo(
    () => ({
      hour: 'numeric',
      minute: '2-digit',
    }),
    []
  );
  const [time, setTime] = useState<string>(
    new Date().toLocaleTimeString([], options)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      // only hour / minutes
      setTime(new Date().toLocaleTimeString([], options));
    }, 60000);

    return () => clearInterval(interval);
  }, [options]);

  return time;
};
