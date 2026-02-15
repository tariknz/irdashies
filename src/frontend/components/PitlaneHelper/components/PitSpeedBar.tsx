import { memo } from 'react';

export interface PitSpeedBarProps {
  /** Current speed in km/h */
  speedKph: number;
  /** Pit speed limit in km/h */
  limitKph: number;
}

/**
 * Vertical bar showing current speed relative to the pit speed limit.
 * The limit is marked at the midpoint of the bar. The fill grows upward
 * from zero and changes colour based on proximity to the limit.
 *
 * - Green:  more than 5 km/h below limit
 * - Amber:  within 5 km/h below limit
 * - Red:    at or above limit
 */
export const PitSpeedBar = memo(({ speedKph, limitKph }: PitSpeedBarProps) => {
  // The bar represents 0 → 2× the limit. The midpoint (50%) = limit.
  const maxSpeed = limitKph * 2;
  const clampedSpeed = Math.max(0, Math.min(speedKph, maxSpeed));
  const fillPercent = (clampedSpeed / maxSpeed) * 100;

  const deltaKph = speedKph - limitKph;

  let fillColor = 'rgb(34, 197, 94)'; // green-500
  if (deltaKph >= 0) {
    fillColor = 'rgb(239, 68, 68)'; // red-500
  } else if (deltaKph > -5) {
    fillColor = 'rgb(234, 179, 8)'; // yellow-500
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-xs text-slate-400">Speed</div>

      {/* Bar container */}
      <div
        className="relative w-5 bg-slate-700/50 rounded overflow-hidden"
        style={{ height: '100px' }}
      >
        {/* Speed fill — grows from bottom */}
        <div
          className="absolute bottom-0 w-full transition-all duration-150 ease-out rounded"
          style={{
            height: `${fillPercent}%`,
            backgroundColor: fillColor,
          }}
        />

        {/* Limit marker at 50% */}
        <div
          className="absolute w-full border-t-2 border-white/80"
          style={{ bottom: '50%' }}
        />
      </div>

      <div className="text-xs text-slate-400">0</div>
    </div>
  );
});

PitSpeedBar.displayName = 'PitSpeedBar';
