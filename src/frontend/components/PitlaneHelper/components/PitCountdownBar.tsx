import { memo } from 'react';

export interface PitCountdownBarProps {
  distance: number; // Distance in meters
  maxDistance: number; // Maximum distance for progress calculation
  orientation: 'horizontal' | 'vertical' | undefined;
  color: string; // RGB color string
  targetName: string; // "Pit Entry" | "Pitbox" | "Pit Exit"
}

export const PitCountdownBar = memo(
  ({
    distance,
    maxDistance,
    orientation,
    color,
    targetName,
  }: PitCountdownBarProps) => {
    // Calculate progress percentage (0-100)
    const progressPercent = Math.max(
      0,
      Math.min(100, ((maxDistance - distance) / maxDistance) * 100)
    );

    const valueLabel = distance > 0 ? `${Math.round(distance)}m` : 'here';

    if (orientation === 'vertical') {
      return (
        <div className="flex flex-col flex-1 items-center gap-1">
          <span className="text-sm text-white font-medium tabular-nums leading-none">
            {valueLabel}
          </span>
          <div className="relative w-full h-full min-w-5 min-h-10 bg-slate-700/50 rounded overflow-hidden">
            <div
              className="absolute bottom-0 w-full transition-all duration-200 ease-out"
              style={{ height: `${progressPercent}%`, backgroundColor: color }}
            />
            {/* Limit marker at top */}
            <div
              className="absolute w-full border-t-2 border-white/70"
              style={{ top: '0%' }}
            />
          </div>
          <div className="flex justify-center items-center text-[11px] w-full">
            <span className="text-slate-400">{targetName}</span>
          </div>
        </div>
      );
    }

    // Horizontal orientation
    return (
      <div className="flex flex-col flex-1 gap-1">
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-400">{targetName}</span>
          <span className="text-white font-medium tabular-nums">
            {valueLabel}
          </span>
        </div>
        <div className="relative h-full min-h-5 w-full bg-slate-700/50 rounded overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full transition-all duration-200 ease-out"
            style={{ width: `${progressPercent}%`, backgroundColor: color }}
          />
          {/* Limit marker at right */}
          <div
            className="absolute h-full border-r-2 border-white/70"
            style={{ right: '0%' }}
          />
        </div>
      </div>
    );
  }
);

PitCountdownBar.displayName = 'PitCountdownBar';
