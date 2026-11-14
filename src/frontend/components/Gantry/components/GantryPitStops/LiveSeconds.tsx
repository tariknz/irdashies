import { createContext, memo, useContext, useEffect, useState } from 'react';
import { formatStopSeconds } from './pitStopFormat';

/** True while no new stop data can arrive, such as a loaded replay file. */
export const PitTimersPaused = createContext(false);

interface LiveSecondsProps {
  /** Seconds when the data arrived. */
  seconds: number | null;
  /** Still counting: the car is on pit road or in its stall. */
  running: boolean;
  /** performance.now() when the data arrived. */
  since: number;
}

/**
 * A stop time that keeps counting while the car is still in the pits. Only
 * running timers re-render, so a long stop log stays still.
 */
export const LiveSeconds = memo(
  ({ seconds, running, since }: LiveSecondsProps) => {
    const paused = useContext(PitTimersPaused);
    const ticking = running && !paused;
    const [now, setNow] = useState(() => performance.now());
    useEffect(() => {
      if (!ticking) return;
      setNow(performance.now());
      const timer = setInterval(() => setNow(performance.now()), 500);
      return () => clearInterval(timer);
    }, [ticking, since]);
    const shown =
      seconds !== null && ticking
        ? seconds + Math.max(0, now - since) / 1000
        : seconds;
    return (
      <span className={running ? 'text-amber-300' : undefined}>
        {formatStopSeconds(shown)}
      </span>
    );
  }
);
LiveSeconds.displayName = 'LiveSeconds';
