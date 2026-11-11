import { HeartIcon } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { DEMO_HEART_RATE_INTERVAL_MS, demoHeartRate } from './demoData';

/** HypeRate is externally hosted, so offline settings never load the real embed. */
export const HeartRatePreview = () => {
  const [bpm, setBpm] = useState(() => demoHeartRate(0));
  useEffect(() => {
    let tick = 0;
    const timer = setInterval(() => {
      tick++;
      setBpm(demoHeartRate(tick));
    }, DEMO_HEART_RATE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 rounded-md bg-slate-800/80 px-3 text-center text-white">
      <div className="flex items-center gap-3">
        <HeartIcon size={32} weight="fill" className="text-rose-500" />
        <span className="text-3xl tabular-nums">
          {bpm}
          <span className="ml-1 text-sm text-slate-400">BPM</span>
        </span>
      </div>
      <p className="text-xs text-slate-400">
        Sample only. Live appearance comes from HypeRate.
      </p>
    </div>
  );
};
