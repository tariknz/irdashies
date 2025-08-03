import { useMemo } from 'react';
import {
  ArrowsClockwiseIcon,
  ArrowsCounterClockwiseIcon,
} from '@phosphor-icons/react';

interface RotationIndicatorProps {
  currentAngleRad: number;
}

export function RotationIndicator({
  currentAngleRad
}: RotationIndicatorProps) {
  // Memoize calculations to avoid recalculating on every render
  const { shouldShow, angleDegrees, direction } =
    useMemo(() => {
      // Convert radians to degrees
      const angleDegrees = (currentAngleRad * -1 * 180) / Math.PI;

      // Only show when beyond ±270 degrees
      const shouldShow = Math.abs(angleDegrees) > 270;

      if (!shouldShow) {
        return {
          shouldShow,
          angleDegrees,
          direction: 'none' as const,
        };
      }

      // Determine direction to center
      const direction = angleDegrees > 0 ? 'left' : 'right';

      return {
        shouldShow,
        angleDegrees,
        direction,
      };
    }, [currentAngleRad]);

  // Don't render anything if not showing
  if (!shouldShow) {
    return null;
  }

  return (
    <div
      className={`absolute inset-0 flex items-center justify-center`}
    >
      {/* Central flashing indicator */}
      <div className="relative flex items-center justify-center">
        {/* Background indicator */}
        <div
          className="absolute w-8 h-8 rounded-full bg-red-500/40 backdrop-blur-sm border-2 border-red-500"
          style={{
            animation: 'pulse 1s ease-in-out infinite',
            animationDelay: '0.5s',
          }}
        />

        {/* Direction arrow */}
        <div className="absolute w-6 h-6 flex items-center justify-center">
          {direction === 'left' ? (
            <ArrowsCounterClockwiseIcon
              size={20}
              weight="bold"
              className="text-white"
            />
          ) : (
            <ArrowsClockwiseIcon
              size={20}
              weight="bold"
              className="text-white"
            />
          )}
        </div>
      </div>

      {/* Centered text */}
      <div className="absolute top-1/8 text-xs text-white min-w-[2.5rem] text-center font-medium bg-black/40 rounded-md">
        {shouldShow ? `${angleDegrees.toFixed(0)}°` : ''}
      </div>
    </div>
  );
}
