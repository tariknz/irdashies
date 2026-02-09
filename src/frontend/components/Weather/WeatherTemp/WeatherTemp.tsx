import { ThermometerIcon } from '@phosphor-icons/react';
import { memo } from 'react';

export interface WeatherTempProps {
  title: string;
  value: string;
}

export const WeatherTemp = memo(({ title, value }: WeatherTempProps) => {
  return (
    <div className="bg-slate-800/70 p-2 rounded-sm w-full">
      <div className="flex flex-row gap-x-2 items-center text-sm">
        <ThermometerIcon />
        <span className="grow">{title}</span>
        <div className="text-center">{value}</div>
      </div>
    </div>
  );
});
WeatherTemp.displayName = 'WeatherTemp';
