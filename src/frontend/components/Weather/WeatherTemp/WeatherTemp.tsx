import { memo } from 'react';

export interface WeatherTempProps {
  title: string;
  value: string;
  icon: React.ElementType;
}

export const WeatherTemp = memo(({ title, value, icon: Icon }: WeatherTempProps) => {
  return (
    <div className="bg-slate-800/70 p-2 rounded-sm w-full min-w-0">
      <div className="flex flex-row gap-x-2 items-center text-sm">
        <Icon className="flex-none" />
        <span className="truncate min-w-0 flex-1 @max-[120px]:hidden">
          {title}
        </span>
        <div className="flex-none whitespace-nowrap text-right">{value}</div>
      </div>
    </div>
  );
});
WeatherTemp.displayName = 'WeatherTemp';
