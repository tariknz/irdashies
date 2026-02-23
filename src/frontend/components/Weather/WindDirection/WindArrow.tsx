import { memo, useRef, useEffect, useState } from 'react';

interface WindArrowProps {
  direction?: number;
  className?: string;
}

export const WindArrow = memo(
  ({ direction, className = 'w-3.5 h-4' }: WindArrowProps) => {
    const [normalizedAngle, setNormalizedAngle] = useState<number>(0);
    const prevAngleRef = useRef<number>(0);

    useEffect(() => {
      if (direction === undefined) return;

      const currentAngle = direction;
      const prevAngle = prevAngleRef.current;

      let diff = currentAngle - prevAngle;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;

      setNormalizedAngle((prev) => prev + diff);
      prevAngleRef.current = currentAngle;
    }, [direction]);

    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="50 80 650 720"
        className={`${className} fill-current origin-center transform-gpu transition-[rotate] duration-1000 ease-out`}
        style={{
          rotate: `calc(${normalizedAngle} * 1rad + 0.5turn)`,
        }}
      >
        <path
          fillRule="nonzero"
          d="m373.75 91.496c-0.95-1.132-74.87 153.23-164.19 343.02-160.8 341.68-162.27 345.16-156.49 350.27 3.203 2.83 6.954 4.79 8.319 4.34 1.365-0.46 71.171-73.88 155.14-163.1 83.97-89.22 153.66-162.83 154.87-163.56 1.2-0.72 71.42 72.34 156.04 162.29s155.21 163.82 156.95 164.19 5.57-1.19 8.5-3.44c5.04-3.86-3.75-23.46-156.04-348-88.77-189.18-162.15-344.88-163.1-346.01z"
        />
      </svg>
    );
  }
);
WindArrow.displayName = 'WindArrow';
