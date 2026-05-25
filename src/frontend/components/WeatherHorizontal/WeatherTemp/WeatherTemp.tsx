import { memo } from 'react';

export interface WeatherTempProps {
  value: string;
  icon: React.ElementType;
}

export const WeatherTemp = memo(({ value, icon: Icon }: WeatherTempProps) => {
  return (
    <div className="bg-slate-800/70 px-2 py-1 w-full min-w-0">
      <div className="flex items-center gap-x-1.5">
        <Icon size={12} className="flex-none text-white/50" />
        <div className="text-sm font-medium truncate">{value}</div>
      </div>
    </div>
  );
});
WeatherTemp.displayName = 'WeatherTemp';
