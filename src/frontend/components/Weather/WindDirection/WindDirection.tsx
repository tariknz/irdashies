import { WindIcon } from '@phosphor-icons/react';
import { memo, useRef, useEffect, useState } from 'react';

export interface WindDirectionProps {
  speedMs?: number;
  direction?: number;
  metric?: boolean;
  variant?: 'default' | 'compact' | 'inline';
}

interface WindArrowProps {
  normalizedAngle: number;
  className: string;
  strokeWidth: string;
}

const WindArrow = ({
  normalizedAngle,
  className,
  strokeWidth,
}: WindArrowProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 60 60"
    aria-hidden="true"
    className={className}
    style={{
      rotate: `calc(${normalizedAngle} * 1rad + 0.5turn)`,
    }}
  >
    <path
      d="M48 8A28 28 90 0158 30c0 15.464-12.536 28-28 28S2 45.464 2 30A28 28 90 0112 8M22 9 30 1l8 8"
      className={strokeWidth}
    />
  </svg>
);

export const WindDirection = memo(
  ({
    speedMs,
    direction,
    metric = true,
    variant = 'default',
  }: WindDirectionProps) => {
    // Convert m/s to user's preferred unit
    const speed =
      speedMs !== undefined
        ? speedMs * (metric ? 3.6 : 2.23694) // km/h or mph
        : undefined;

    const [normalizedAngle, setNormalizedAngle] = useState<number>(0);
    const prevAngleRef = useRef<number>(0);

    useEffect(() => {
      if (direction === undefined) return;

      const currentAngle = direction;
      const prevAngle = prevAngleRef.current;

      // Calculate the shortest path difference
      let diff = currentAngle - prevAngle;

      // Normalize to [-π, π] range
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;

      // Update the normalized angle
      setNormalizedAngle((prev) => prev + diff);
      prevAngleRef.current = currentAngle;
    }, [direction]);

    const displaySpeed = speed !== undefined ? Math.round(speed) : '-';

    if (variant === 'compact') {
      return (
        <div
          className="bg-slate-800/70 px-2 py-1 rounded-sm min-w-0"
          title="Wind"
        >
          <div className="flex items-center gap-x-1.5">
            <WindArrow
              normalizedAngle={normalizedAngle}
              className="flex-none size-5 stroke-current box-border fill-none origin-center transform-gpu transition-transform duration-1000 ease-out text-white/70"
              strokeWidth="stroke-[5]"
            />
            <div className="text-sm font-medium truncate">{displaySpeed}</div>
          </div>
        </div>
      );
    }

    if (variant === 'inline') {
      return (
        <div className="bg-slate-800/70 px-2 py-1 rounded-sm min-w-0">
          <div className="flex items-center gap-x-1.5 text-sm">
            <WindArrow
              normalizedAngle={normalizedAngle}
              className="flex-none size-5 stroke-current box-border fill-none origin-center transform-gpu transition-transform duration-1000 ease-out text-white/70"
              strokeWidth="stroke-[5]"
            />
            <span className="truncate min-w-0">Wind</span>
            <div className="flex-none whitespace-nowrap text-right font-medium">
              {displaySpeed}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-slate-800/70 p-2 rounded-sm w-full min-w-0">
        <div className="flex flex-row gap-x-2 items-center text-sm mb-3">
          <WindIcon className="flex-none" />
          <span className="truncate min-w-0 flex-1 @max-[120px]:hidden">
            Wind
          </span>
        </div>
        <div className="flex justify-center">
          <div className="flex aspect-square relative w-full max-w-[120px] mx-auto items-center justify-center">
            <WindArrow
              normalizedAngle={normalizedAngle}
              className="absolute stroke-current w-full h-full box-border fill-none origin-center transform-gpu transition-transform duration-1000 ease-out"
              strokeWidth="stroke-[3]"
            />

            <div className="absolute w-full h-full flex justify-center items-center text-[32px]">
              {displaySpeed}
            </div>
          </div>
        </div>
      </div>
    );
  }
);
WindDirection.displayName = 'WindDirection';
