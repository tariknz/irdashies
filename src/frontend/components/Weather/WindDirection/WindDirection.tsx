import { WindIcon } from '@phosphor-icons/react';
import { memo, useRef, useEffect, useState } from 'react';

export interface WindDirectionProps {
  speedMs?: number;
  direction?: number;
  metric?: boolean;
}

export const WindDirection = memo(
  ({ speedMs, direction, metric = true }: WindDirectionProps) => {
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

    return (
      <div className="bg-slate-800/70 p-2 rounded-sm">
        <div className="flex flex-row gap-x-2 items-center text-sm mb-3">
          <WindIcon />
          <span className="grow">Wind</span>
        </div>
        <div className="flex justify-center">
          <div
            id="wind"
            className="flex aspect-square relative w-full max-w-[120px] mx-auto items-center justify-center"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 60 60"
              className="absolute stroke-current stroke-[3] w-full h-full box-border fill-none origin-center transform-gpu transition-transform duration-1000 ease-out"
              style={{
                rotate: `calc(${normalizedAngle} * 1rad + 0.5turn)`,
              }}
            >
              <path d="M48 8A28 28 90 0158 30c0 15.464-12.536 28-28 28S2 45.464 2 30A28 28 90 0112 8M22 9 30 1l8 8" />
            </svg>

            <div className="absolute w-full h-full flex justify-center items-center text-[32px]">
              {speed !== undefined ? Math.round(speed) : '-'}
            </div>
          </div>
        </div>
      </div>
    );
  }
);
WindDirection.displayName = 'WindDirection';
