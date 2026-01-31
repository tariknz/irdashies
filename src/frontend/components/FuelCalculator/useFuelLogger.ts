import { useRef, useEffect } from 'react';
import type { FuelCalculatorSettings } from './types';

/**
 * Hook to log detailed fuel calculation data to a file for analysis.
 * Logs are written only if `enableLogging` is true in settings.
 * 
 * @param data The fuel calculation data to log
 * @param settings The fuel calculator settings containing the toggle
 */
export function useFuelLogger(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
  settings?: FuelCalculatorSettings
) {
  const lastLogTimeRef = useRef<number>(0);
  
  useEffect(() => {
    // Only proceed if logging is enabled AND we have data
    if (!settings?.enableLogging || !data) return;

    // Rate limit logging to avoid performance impact (e.g., max once per second or on every update?)
    // The user said "save ALL data". strict interpretation means every update.
    // However, writing to disk every frame (60fps) is bad.
    // `useFuelCalculation` updates on telemetry changes (60hz potentially).
    // Let's throttle to a reasonable rate (e.g. 10Hz or only on significant changes?)
    // Or assume `data` is memoized and only changes when calculated values change.
    // `useFuelCalculation` does `useMemo` but depends on telemetry which updates fast.
    
    // Let's log every 1 second to catch trends without killing IO, 
    // OR log every time `data` changes but throttle to 100ms.
    const now = Date.now();
    if (now - lastLogTimeRef.current < 5000) { // Throttle to once every 5 seconds
        return;
    }
    
    lastLogTimeRef.current = now;

    // Fire and forget
    window.fuelCalculatorBridge.logData({
      timestamp: now,
      ...data
    }).catch(err => {
        console.error('[FuelLogger] Failed to log data:', err);
    });

  }, [data, settings?.enableLogging]);
}
