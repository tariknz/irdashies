import { useMemo } from 'react';
import { useTelemetryValue, useSessionStore } from '@irdashies/context';

export interface PitSpeedResult {
  deltaKph: number;
  deltaMph: number;
  limitKph: number;
  limitMph: number;
  speedKph: number;
  speedMph: number;
  colorClass: string;
  isPulsing: boolean;
}

export const usePitSpeed = (): PitSpeedResult => {
  const session = useSessionStore((state) => state.session);
  const speed = useTelemetryValue('Speed') ?? 0;

  return useMemo(() => {
    // Parse pit speed limit (format: "60.00 kph" or "35.00 mph")
    const limitString = session?.WeekendInfo?.TrackPitSpeedLimit ?? '0 kph';
    const limitValue = parseFloat(limitString.split(' ')[0]);
    const limitUnit = limitString.split(' ')[1]?.toLowerCase();

    // Determine limit in both units
    const limitKph = limitUnit === 'mph' ? limitValue * 1.60934 : limitValue;
    const limitMph = limitUnit === 'kph' ? limitValue / 1.60934 : limitValue;

    // Current speed (convert m/s to km/h and mph)
    const speedKph = speed * 3.6;
    const speedMph = speed * 2.23694;

    // Calculate deltas
    const deltaKph = speedKph - limitKph;
    const deltaMph = speedMph - limitMph;

    // Color coding:
    // < -5: green (safe)
    // -5 to 0: amber (caution)
    // 0 to 2: red (over)
    // > 2: red + pulse (urgent)
    let colorClass = 'text-green-500';
    let isPulsing = false;

    if (deltaKph >= 2) {
      colorClass = 'text-red-500';
      isPulsing = true;
    } else if (deltaKph > 0) {
      colorClass = 'text-red-500';
    } else if (deltaKph > -5) {
      colorClass = 'text-amber-500';
    }

    return {
      deltaKph,
      deltaMph,
      limitKph,
      limitMph,
      speedKph,
      speedMph,
      colorClass,
      isPulsing,
    };
  }, [speed, session?.WeekendInfo?.TrackPitSpeedLimit]);
};
