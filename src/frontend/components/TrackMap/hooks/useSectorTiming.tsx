import { useEffect, useRef } from 'react';
import {
  useSectorTimingStore,
  useSectorColors,
  useDashboard,
  type SectorColor,
} from '@irdashies/context';
import { useTelemetryValue, useSessionStore } from '@irdashies/context';
import type { SectorDeltaConfig } from '@irdashies/types';
import { getSectorDeltaThresholdFractions } from '../../SectorDelta/sectorColorUtils';

/**
 * Feeds player telemetry into the SectorTimingStore each tick and returns
 * the current per-sector performance colors.
 *
 * Also syncs SectorDelta threshold settings so the TrackMap sector coloring
 * always uses the same thresholds as the SectorDelta widget, even when the
 * SectorDelta widget is not mounted.
 *
 * Call this hook once at the overlay-container level so any widget can consume
 * sector timing state, even when the track map is not mounted.
 */
export const useSectorTiming = (): SectorColor[] => {
  const sectors = useSessionStore((s) => s.session?.SplitTimeInfo?.Sectors);
  const setSectors = useSectorTimingStore((s) => s.setSectors);
  const tick = useSectorTimingStore((s) => s.tick);
  const markCurrentSectorUnclean = useSectorTimingStore(
    (s) => s.markCurrentSectorUnclean
  );
  const setThresholds = useSectorTimingStore((s) => s.setThresholds);

  const { currentDashboard } = useDashboard();
  const sectorDeltaThresholds = (
    currentDashboard?.widgets.find((w) => w.id === 'sectordelta')?.config as
      | SectorDeltaConfig
      | undefined
  )?.thresholds;

  // Keep the store thresholds in sync with the SectorDelta widget config so
  // the TrackMap sector coloring matches the SectorDelta widget.
  useEffect(() => {
    const { green, yellow } = getSectorDeltaThresholdFractions(
      sectorDeltaThresholds
    );
    setThresholds(green, yellow);
  }, [sectorDeltaThresholds, setThresholds]);

  const lapDistPct = useTelemetryValue('LapDistPct');
  const sessionTime = useTelemetryValue('SessionTime');
  const isOnTrack = useTelemetryValue<boolean>('IsOnTrack');

  // Sync sector boundaries whenever the track/session changes
  useEffect(() => {
    if (sectors && sectors.length > 0) {
      setSectors(sectors);
    }
  }, [sectors, setSectors]);

  // Mark the current sector unclean when the player goes off-track. This keeps
  // the real elapsed sector time while letting the widget flag the incident.
  const prevIsOnTrack = useRef<boolean | null>(null);
  useEffect(() => {
    const current = !!isOnTrack;
    if (prevIsOnTrack.current === true && !current) {
      markCurrentSectorUnclean();
    }
    prevIsOnTrack.current = current;
  }, [isOnTrack, markCurrentSectorUnclean]);

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
