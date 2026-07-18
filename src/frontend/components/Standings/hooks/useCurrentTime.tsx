import { useEffect, useMemo, useState } from 'react';

export const useCurrentTime = () => {
  const options: Intl.DateTimeFormatOptions = useMemo(
    () => ({
      hour: 'numeric',
      minute: '2-digit',
    }),
    []
  );
  const [time, setTime] = useState<string>(() =>
    new Date().toLocaleTimeString([], options)
  );

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const tick = () => {
      setTime(new Date().toLocaleTimeString([], options));
      // align next tick to the next wall-clock minute boundary
      timeoutId = setTimeout(tick, 60_000 - (Date.now() % 60_000));
    };

    timeoutId = setTimeout(tick, 60_000 - (Date.now() % 60_000));

    return () => clearTimeout(timeoutId);
  }, [options]);

  return time;
};
