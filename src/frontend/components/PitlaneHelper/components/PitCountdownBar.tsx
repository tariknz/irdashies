import { memo } from 'react';

export interface PitCountdownBarProps {
  distance: number;           // Distance in meters
  maxDistance: number;        // Maximum distance for progress calculation
  orientation: 'horizontal' | 'vertical';
  color: string;              // RGB color string
  targetName: string;         // "Pit Entry" | "Pitbox" | "Pit Exit"
}

export const PitCountdownBar = memo(({
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

  if (orientation === 'vertical') {
    return (
      <div className="flex flex-col items-center gap-2 w-full">
        {/* Distance Label */}
        <div className="text-white text-sm font-medium">
          {distance > 0 ? `${Math.round(distance)}m` : targetName}
        </div>

        {/* Vertical Bar */}
        <div
          className="relative w-8 bg-slate-700/50 rounded overflow-hidden"
          style={{ height: '120px' }}
        >
          {/* Fill from bottom to top */}
          <div
            className="absolute bottom-0 w-full transition-all duration-200 ease-out"
            style={{
              height: `${progressPercent}%`,
              backgroundColor: color,
            }}
          />
        </div>

        {/* Target Label */}
        <div className="text-slate-400 text-xs">{targetName}</div>
      </div>
    );
  }

  // Horizontal orientation
  return (
    <div className="flex flex-col gap-1 w-full">
      {/* Distance and Target Label */}
      <div className="flex justify-between items-center text-xs">
        <span className="text-slate-400">{targetName}</span>
        <span className="text-white font-medium">
          {distance > 0 ? `${Math.round(distance)}m` : 'At Target'}
        </span>
      </div>

      {/* Horizontal Bar */}
      <div className="relative h-6 w-full bg-slate-700/50 rounded overflow-hidden">
        {/* Fill from left to right */}
        <div
          className="absolute left-0 top-0 h-full transition-all duration-200 ease-out"
          style={{
            width: `${progressPercent}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
});

PitCountdownBar.displayName = 'PitCountdownBar';
