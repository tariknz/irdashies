import { useEffect, useState } from 'react';

export const useBlinkState = (animate: boolean, blinkPeriod?: number) => {
  const [blinkOn, setBlinkOn] = useState(true);

  useEffect(() => {
    if (!animate) return;
    const periodMs =
      blinkPeriod && blinkPeriod > 0
        ? Math.max(100, Math.floor(blinkPeriod * 1000))
        : 500;
    const id = setInterval(() => setBlinkOn((v) => !v), periodMs);
    return () => clearInterval(id);
  }, [animate, blinkPeriod]);

  return blinkOn;
};
