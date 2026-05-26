import { memo, useEffect, useRef, useState } from 'react';

export interface WindDirectionProps {
  speedMs?: number;
  direction?: number;
  metric?: boolean;
}

export const WindDirection = memo(
  ({ speedMs, direction, metric = true }: WindDirectionProps) => {
    const speed =
      speedMs !== undefined ? speedMs * (metric ? 3.6 : 2.23694) : undefined;
    const [normalizedAngle, setNormalizedAngle] = useState(0);
    const prevAngleRef = useRef(0);

    useEffect(() => {
      if (direction === undefined) return;

      const prevAngle = prevAngleRef.current;
      let diff = direction - prevAngle;

      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;

      setNormalizedAngle((prev) => prev + diff);
      prevAngleRef.current = direction;
    }, [direction]);

    return (
      <div className="flex justify-center">
        <div className="flex aspect-square relative w-full max-w-[120px] mx-auto items-center justify-center">
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
    );
  }
);
WindDirection.displayName = 'WindDirection';
