import { memo } from 'react';
import type { LapTimeLogConfig } from '@irdashies/types';
import { formatTime } from '@irdashies/utils/time';
import { useGeneralSettings } from '@irdashies/context';

interface LapTimeCellProps {
  label: string;
  time: number | undefined;
  best?: number | undefined;
  overall?: number | undefined;
  alltime?: number | undefined;
  settings?: LapTimeLogConfig;
}

export const LapTimeCell = memo(({
  label,
  time,
  best,
  overall,
  alltime,
  settings,
}: LapTimeCellProps) => {
  const generalSettings = useGeneralSettings();

  const isCompact = generalSettings?.compactMode === 'compact';
  const isUltra = generalSettings?.compactMode === 'ultra';

  const isSameLapTime = (left?: number, right?: number) =>
    left !== undefined &&
    right !== undefined &&
    left > 0 &&
    Math.abs(left - right) < 0.001;

  const isGreen = isSameLapTime(time, best);
  const isPurple = isSameLapTime(time, overall);
  const isYellow = isSameLapTime(time, alltime);

  const opacity = settings?.foreground?.opacity ?? 0;

  const getLapColor = () => {
    if (isYellow) return 'text-yellow-400';
    if (isPurple) return 'text-purple-400';
    if (isGreen) return 'text-green-400';
    return 'text-white';
  };

  return (
    <div className="flex-1 flex @container">
      <div 
      className={`flex w-full flex-col @[10em]:flex-row ${isUltra ? 'p-0' : (isCompact ? 'p-1' : 'p-2')} items-center justify-top @[10em]:justify-center bg-slate-800/[var(--fg-alpha)]`} 
      style={
          {
            '--fg-alpha': `${opacity / 2}%`,
          } as React.CSSProperties
        }>
        <span className="text-[0.6em] @[10em]:text-[0.8em] mx-2">{label}</span>
        <span className={`text-[1em] tabular-nums ${getLapColor()}`}>{formatTime(time)}</span>
      </div>
    </div>
  );
});

LapTimeCell.displayName = 'LapTimeCell';