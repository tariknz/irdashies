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

  const isUltra = generalSettings?.compactMode === 'ultra';

  const isGreen =
    time !== undefined && best !== undefined && time > 0 && time == best;

  const isPurple =
    time !== undefined && overall !== undefined && time > 0 && time == overall;

  const isYellow =
    time !== undefined && alltime !== undefined && time > 0 && time == alltime;

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
      className={`flex w-full flex-col @[9em]:flex-row ${isUltra ? 'p-0' : 'p-1'} items-center justify-top @[9em]:justify-center bg-slate-800/[var(--fg-alpha)]`} 
      style={
          {
            '--fg-alpha': `${opacity / 2}%`,
          } as React.CSSProperties
        }>
        <span className="text-[0.6em] mx-2">{label}</span>
        <span className={`text-[1em] ${getLapColor()}`}>{formatTime(time)}</span>
      </div>
    </div>
  );
});

LapTimeCell.displayName = 'LapTimeCell';