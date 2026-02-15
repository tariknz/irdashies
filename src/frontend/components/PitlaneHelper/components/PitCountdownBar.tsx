import { memo } from 'react';

export interface PitCountdownBarProps {
  distance: number; // Distance in meters
  maxDistance: number; // Maximum distance for progress calculation
  orientation: 'horizontal' | 'vertical';
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
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[10px] text-slate-300 tabular-nums leading-none">
            {valueLabel}
          </span>
          <div
            className="relative w-4 bg-slate-700/50 rounded overflow-hidden"
            style={{ height: '64px' }}
          >
            <div
              className="absolute bottom-0 w-full transition-all duration-200 ease-out"
              style={{ height: `${progressPercent}%`, backgroundColor: color }}
            />
          </div>
          <span className="text-[10px] text-slate-400 leading-none">
            {targetName}
          </span>
        </div>
      );
    }

    // Horizontal orientation
    return (
      <div className="flex flex-col gap-0.5">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-slate-400">{targetName}</span>
          <span className="text-[10px] text-slate-300 tabular-nums">
            {valueLabel}
          </span>
        </div>
        <div className="relative h-3 w-full bg-slate-700/50 rounded overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full transition-all duration-200 ease-out"
            style={{ width: `${progressPercent}%`, backgroundColor: color }}
          />
        </div>
      </div>
    );
  }
);

PitCountdownBar.displayName = 'PitCountdownBar';
