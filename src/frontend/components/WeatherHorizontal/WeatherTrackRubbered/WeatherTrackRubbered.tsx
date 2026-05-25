import { memo } from 'react';
import { PathIcon } from '@phosphor-icons/react';

interface Props {
  trackRubbered: string | undefined;
}

export const WeatherTrackRubbered = memo(({ trackRubbered }: Props) => {
  return (
    <div className="bg-slate-800/70 p-2 rounded-sm w-full min-w-0">
      <div className="flex flex-row gap-x-2 items-center text-sm">
        <PathIcon className="flex-none" />
        <span className="truncate min-w-0 flex-1">Rubber</span>
        <div
          className="flex-none truncate text-right capitalize"
          title={trackRubbered ?? 'N/A'}
        >
          {trackRubbered ?? 'N/A'}
        </div>
      </div>
    </div>
  );
});
WeatherTrackRubbered.displayName = 'WeatherTrackRubbered';
