import { useEffect, useRef, useState } from 'react';

/**
 * Throttles a value to update at most once per specified interval.
 * Useful for reducing the frequency of expensive computations based on high-frequency data.
 *
 * @param value - The value to throttle
 * @param intervalMs - Minimum time between updates in milliseconds (default: 100ms = 10Hz)
 * @returns The throttled value
 */
export function useThrottledValue<T>(value: T, intervalMs = 100): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastUpdateRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestValueRef = useRef<T>(value);

  useEffect(() => {
    // Always keep the latest value in a ref
    latestValueRef.current = value;
    
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateRef.current;

    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (timeSinceLastUpdate >= intervalMs) {
      // Enough time has passed, schedule update for next tick to avoid cascading renders
      timeoutRef.current = setTimeout(() => {
        lastUpdateRef.current = Date.now();
        setThrottledValue(latestValueRef.current);
      }, 0);
    } else {
      // Schedule an update for when the interval expires
      timeoutRef.current = setTimeout(() => {
        lastUpdateRef.current = Date.now();
        setThrottledValue(latestValueRef.current);
      }, intervalMs - timeSinceLastUpdate);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, intervalMs]);

  return throttledValue;
}
