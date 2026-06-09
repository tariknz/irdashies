import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getWindIntensityClass } from '../../../domain/weather/wind';

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
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [size, setSize] = useState<number | null>(null);
    const windIntensityClass = getWindIntensityClass(speed);

    useEffect(() => {
      if (direction === undefined) return;

      const prevAngle = prevAngleRef.current;
      let diff = direction - prevAngle;

      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;

      setNormalizedAngle((prev) => prev + diff);
      prevAngleRef.current = direction;
    }, [direction]);

    useLayoutEffect(() => {
      const node = containerRef.current;
      if (!node) return;

      const updateSize = () => {
        const { clientWidth, clientHeight } = node;
        if (!clientWidth || !clientHeight) return;

        setSize(Math.round(Math.min(clientWidth, clientHeight)));
      };

      updateSize();
      const observer = new ResizeObserver(updateSize);
      observer.observe(node);

      return () => observer.disconnect();
    }, []);

    const visualSize = size ? `${size}px` : '100%';
    const fontSize = size ? Math.max(10, Math.round(size * 0.27)) : 32;

    return (
      <div
        ref={containerRef}
        className="flex h-full w-full min-h-0 min-w-0 items-center justify-center"
      >
        <div
          data-testid="wind-direction"
          className={`relative flex aspect-square items-center justify-center transition-colors duration-300 ${windIntensityClass}`}
          style={{ width: visualSize, height: visualSize }}
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

          <div
            className="absolute flex h-full w-full items-center justify-center leading-none"
            style={{ fontSize }}
          >
            {speed !== undefined ? Math.round(speed) : '-'}
          </div>
        </div>
      </div>
    );
  }
);
WindDirection.displayName = 'WindDirection';
