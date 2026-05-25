import { memo } from 'react';
import { PathIcon } from '@phosphor-icons/react';

interface Props {
  trackRubbered: string | undefined;
}

export const WeatherTrackRubbered = memo(({ trackRubbered }: Props) => {
  return (
    <div className="bg-slate-800/70 px-2 py-1 w-full min-w-0">
      <div className="flex items-center gap-x-1.5">
        <PathIcon size={12} className="flex-none text-white/50" />
        <div
          className="text-sm font-medium capitalize truncate"
          title={trackRubbered ?? 'N/A'}
        >
          {trackRubbered ?? 'N/A'}
        </div>
      </div>
    </div>
  );
});
WeatherTrackRubbered.displayName = 'WeatherTrackRubbered';
