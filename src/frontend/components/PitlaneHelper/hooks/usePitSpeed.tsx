import { useMemo } from 'react';
import {
  trackStateSelectors,
  useTrackStateSelector,
  useSessionStore,
} from '@irdashies/context';
import {
  kphFromSpeed,
  speedFromKph,
  speedFromMs,
} from '@irdashies/utils/units';

export interface PitSpeedResult {
  deltaKph: number;
  deltaMph: number;
  limitKph: number;
  limitMph: number;
  speedKph: number;
  speedMph: number;
  colorClass: string;
  isPulsing: boolean;
  isSpeeding: boolean; // Over limit at all
  isSeverelyOver: boolean; // More than 1.5 km/h over limit
}

export const usePitSpeed = (): PitSpeedResult => {
  const session = useSessionStore((state) => state.session);
  const speed = useTrackStateSelector(trackStateSelectors.speed) ?? 0;

  return useMemo(() => {
    // Parse pit speed limit (format: "60.00 kph" or "35.00 mph")
    const limitString = session?.WeekendInfo?.TrackPitSpeedLimit ?? '0 kph';
    const limitValue = parseFloat(limitString.split(' ')[0]);
    const limitUnit = limitString.split(' ')[1]?.toLowerCase();

    // Determine limit in both units. iRacing writes the limit in whichever unit
    // the track uses, so normalise via km/h rather than trusting one of them.
    const limitKph =
      limitUnit === 'mph' ? kphFromSpeed(limitValue, 'mph') : limitValue;
    const limitMph = speedFromKph(limitKph, 'mph');

    // Current speed (convert m/s to km/h and mph)
    const speedKph = speedFromMs(speed, 'km/h');
    const speedMph = speedFromMs(speed, 'mph');

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

    // Speeding flags
    const isSpeeding = deltaKph > 0;
    const isSeverelyOver = deltaKph > 1.5;

    return {
      deltaKph,
      deltaMph,
      limitKph,
      limitMph,
      speedKph,
      speedMph,
      colorClass,
      isPulsing,
      isSpeeding,
      isSeverelyOver,
    };
  }, [speed, session?.WeekendInfo?.TrackPitSpeedLimit]);
};
