import { memo } from 'react';
import { DropHalfIcon, DropIcon } from '@phosphor-icons/react';

interface Props {
  humidity: number | undefined | null;
}

export const WeatherHumidity = memo(({ humidity }: Props) => {
  const hasHumidity = humidity !== undefined && humidity !== null;
  const humidityValue = hasHumidity ? Number(humidity.toFixed(2)) : 0;
  const humidityPercent = humidityValue * 100;

  return (
    <div className="bg-slate-800/70 p-2 rounded-sm w-full">
      <div className="flex flex-row gap-x-2 items-center text-sm">
        {hasHumidity &&
          (humidityPercent <= 50 ? <DropIcon /> : <DropHalfIcon />)}
        <span className="grow">Humidity</span>
        <div className="text-center">
          {hasHumidity ? `${Math.round(humidityPercent)}%` : '- %'}
        </div>
      </div>
    </div>
  );
});
WeatherHumidity.displayName = 'WeatherHumidity';
