import { memo } from 'react';
import { PathIcon } from '@phosphor-icons/react';

interface Props {
  trackRubbered: string | undefined;
}

export const WeatherTrackRubbered = memo(({ trackRubbered }: Props) => {
  return (
    <div className="bg-slate-800/70 p-2 rounded-sm w-full min-w-0">
      <div className="flex flex-row items-center gap-2">
        <span className="text-m text-gray-400 mr-1 flex-none">
          <PathIcon />
        </span>
        <span className="text-sm capitalize truncate flex-1 min-w-0">
          {trackRubbered ?? 'N/A'}
        </span>
      </div>
    </div>
  );
});
WeatherTrackRubbered.displayName = 'WeatherTrackRubbered';
