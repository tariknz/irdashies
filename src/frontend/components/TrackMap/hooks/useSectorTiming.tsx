import { useEffect, useRef } from 'react';
import {
  useSectorTimingStore,
  useSectorColors,
  type SectorColor,
} from '@irdashies/context';
import { useTelemetryValue, useSessionStore } from '@irdashies/context';

/**
 * Feeds player telemetry into the SectorTimingStore each tick and returns
 * the current per-sector performance colors.
 *
 * Call this hook once in TrackMap — it is the single updater for the store.
 */
export const useSectorTiming = (): SectorColor[] => {
  const sectors = useSessionStore((s) => s.session?.SplitTimeInfo?.Sectors);
  const setSectors = useSectorTimingStore((s) => s.setSectors);
  const tick = useSectorTimingStore((s) => s.tick);
  const invalidateLap = useSectorTimingStore((s) => s.invalidateLap);

  const lapDistPct = useTelemetryValue('LapDistPct');
  const sessionTime = useTelemetryValue('SessionTime');
  const isOnTrack = useTelemetryValue<boolean>('IsOnTrack');

  // Sync sector boundaries whenever the track/session changes
  useEffect(() => {
    if (sectors && sectors.length > 0) {
      setSectors(sectors);
    }
  }, [sectors, setSectors]);

  // Invalidate lap tracking when the player goes off-track (pits, reset to box).
  // This forces a S/F crossing before timing resumes, preventing mid-track
  // rejoins from producing misleading sector times.
  const prevIsOnTrack = useRef<boolean | null>(null);
  useEffect(() => {
    const current = !!isOnTrack;
    if (prevIsOnTrack.current === true && !current) {
      invalidateLap();
    }
    prevIsOnTrack.current = current;
  }, [isOnTrack, invalidateLap]);

  // Feed each telemetry tick into the store
  useEffect(() => {
    if (
      lapDistPct === undefined ||
      lapDistPct === null ||
      sessionTime === undefined ||
      sessionTime === null
    )
      return;
    tick(lapDistPct as number, sessionTime as number, !!isOnTrack);
  }, [lapDistPct, sessionTime, isOnTrack, tick]);

  return useSectorColors();
};
