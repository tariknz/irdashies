import { memo } from 'react';

export interface WeatherTempProps {
  title: string;
  value: string;
  icon: React.ElementType;
  variant?: 'default' | 'compact' | 'inline';
}

export const WeatherTemp = memo(
  ({ title, value, icon: Icon, variant = 'default' }: WeatherTempProps) => {
    if (variant === 'compact') {
      return (
        <div
          className="bg-slate-800/70 px-2 py-1 rounded-sm min-w-0"
          title={title}
        >
          <div className="flex items-center gap-x-1.5">
            <Icon size={12} className="flex-none text-white/50" />
            <div className="text-sm font-medium truncate">{value}</div>
          </div>
        </div>
      );
    }

    if (variant === 'inline') {
      return (
        <div className="bg-slate-800/70 px-2 py-1 rounded-sm min-w-0">
          <div className="flex items-center gap-x-1.5 text-sm">
            <Icon size={12} className="flex-none text-white/50" />
            <span className="truncate min-w-0 text-white/60">{title}</span>
            <div className="flex-none whitespace-nowrap text-right font-medium">
              {value}
            </div>
          </div>
        </div>
      );
    }

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
  }
);
WeatherTemp.displayName = 'WeatherTemp';
