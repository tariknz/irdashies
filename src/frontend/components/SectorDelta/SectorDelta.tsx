import { useEffect } from 'react';
import {
  useDashboard,
  useSectorDeltas,
  useSectorTimingStore,
} from '@irdashies/context';
import type { SectorDeltaConfig } from '@irdashies/types';
import { SectorDeltaDisplay } from './SectorDeltaDisplay';
import { SectorDeltaPreview } from './SectorDeltaPreview';
import { getSectorDeltaThresholdFractions } from './sectorColorUtils';

const LiveSectorDelta = (config: SectorDeltaConfig) => {
  const data = useSectorDeltas();
  const setThresholds = useSectorTimingStore((s) => s.setThresholds);
  const setTrackIncidentSectors = useSectorTimingStore(
    (s) => s.setTrackIncidentSectors
  );
  const { thresholds, trackIncidentSectors = true } = config;
  useEffect(() => {
    const { green, yellow } = getSectorDeltaThresholdFractions(thresholds);
    setThresholds(green, yellow);
  }, [thresholds, setThresholds]);
  useEffect(() => {
    setTrackIncidentSectors(trackIncidentSectors);
  }, [trackIncidentSectors, setTrackIncidentSectors]);
  return <SectorDeltaDisplay {...config} data={data} demo={false} />;
};

export const SectorDelta = (config: SectorDeltaConfig) => {
  const { isDemoMode } = useDashboard();
  return isDemoMode ? (
    <SectorDeltaPreview {...config} />
  ) : (
    <LiveSectorDelta {...config} />
  );
};
