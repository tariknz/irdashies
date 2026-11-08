import { HeartIcon } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';

/** HypeRate is externally hosted, so offline settings never load the real embed. */
export const HeartRatePreview = () => {
  const [bpm, setBpm] = useState(126);
  useEffect(() => {
    let tick = 0;
    const timer = setInterval(() => {
      tick++;
      setBpm(126 + Math.round(Math.sin(tick / 3) * 6));
    }, 1000);
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
