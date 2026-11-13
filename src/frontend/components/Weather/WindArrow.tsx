import { memo, useEffect, useRef, useState } from 'react';

export interface WindArrowProps {
  /** Direction the wind blows from, relative to the car, radians. */
  relative?: number;
  className?: string;
}

// Keeps adding the shortest turn so the arrow never spins the long way round
// when the angle wraps past 0/360.
const useUnwrapped = (angle = 0) => {
  const [total, setTotal] = useState(angle);
  const prev = useRef(angle);
  useEffect(() => {
    let diff = angle - prev.current;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    prev.current = angle;
    setTotal((t) => t + diff);
  }, [angle]);
  return total;
};

export const WindArrow = memo(({ relative, className }: WindArrowProps) => {
  const turn = useUnwrapped(relative);
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`size-[34px] origin-center transition-transform duration-1000 ease-out ${className ?? ''}`}
      // The wind blows from `relative`, so the arrow points the other way.
      style={{ rotate: `${(turn + Math.PI) * (180 / Math.PI)}deg` }}
    >
      <path d="M12 2 19 13h-5v9h-4v-9H5Z" className="fill-current" />
    </svg>
  );
});
WindArrow.displayName = 'WindArrow';
