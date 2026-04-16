import { memo } from 'react';
import { CloudRainIcon } from '@phosphor-icons/react';

interface Props {
  precipitation: number | undefined | null;
}

export const WeatherPrecipitation = memo(({ precipitation }: Props) => {
  const hasPrecipitation =
    precipitation !== undefined && precipitation !== null;
  // iRacing provides precipitation as 0.0 to 1.0 decimal
  const precipitationPercent = hasPrecipitation
    ? Math.round(precipitation * 100)
    : 0;

  return (
    <div className="bg-slate-800/70 p-2 rounded-sm w-full min-w-0">
      <div className="flex flex-row gap-x-2 items-center text-sm">
        <CloudRainIcon className="flex-none" />
        <span className="truncate min-w-0 flex-1 @max-[120px]:hidden">
          Precipitation
        </span>
        <div className="flex-none whitespace-nowrap text-right font-mono">
          {hasPrecipitation ? `${precipitationPercent}%` : '- %'}
        </div>
      </div>
    </div>
  );
});
WeatherPrecipitation.displayName = 'WeatherPrecipitation';
