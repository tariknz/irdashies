import { memo } from 'react';

export interface PitSpeedBarProps {
  /** Current speed in km/h */
  speedKph: number;
  /** Pit speed limit in km/h */
  limitKph: number;
  /** orientation */
  orientation: 'horizontal' | 'vertical' | undefined;
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
export const PitSpeedBar = memo(
  ({ speedKph, limitKph, orientation }: PitSpeedBarProps) => {
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

    if (orientation === 'vertical') {
      return (
        <div className="h-full flex flex-col flex-1 relative items-center gap-1">
          <span className="text-sm text-white font-medium tabular-nums leading-none">
            {speedKph.toFixed(1)}
          </span>

          {/* Bar */}
          <div className="relative w-full min-w-10 min-h-10 bg-slate-700/50 rounded overflow-hidden h-full">
            <div
              className="absolute bottom-0 w-full transition-all duration-150 ease-out"
              style={{ height: `${fillPercent}%`, backgroundColor: fillColor }}
            />
            {/* Limit marker at midpoint */}
            <div
              className="absolute w-full border-t-2 border-white/70"
              style={{ bottom: '50%' }}
            />
          </div>

          <div className="flex justify-center items-center text-[11px] w-full">
            <span className="text-slate-400">Speed</span>
          </div>
        </div>
      );
    }

    // Horizontal orientation
    return (
      <div className="flex flex-col h-full flex-1 gap-1">
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-400">Speed</span>
          <span className="text-white font-medium tabular-nums">
            {speedKph.toFixed(1)}
          </span>
        </div>
        {/* Horizontal bar */}
        <div className="relative min-h-5 h-full bg-slate-700/50 rounded overflow-hidden flex-1">
          <div
            className="absolute left-0 top-0 h-full transition-all duration-150 ease-out"
            style={{ width: `${fillPercent}%`, backgroundColor: fillColor }}
          />
          {/* Midpoint marker */}
          <div className="absolute left-1/2 top-0 h-full border-l-2 border-white/70" />
        </div>
        
      </div>
    );
  }
);

PitSpeedBar.displayName = 'PitSpeedBar';
