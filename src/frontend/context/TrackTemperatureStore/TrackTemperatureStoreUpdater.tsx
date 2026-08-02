import { useEffect } from 'react';
import { useTelemetry } from '@irdashies/context';
import { useTrackTemperatureStore } from './TrackTemperatureStore';

export const useTrackTemperatureStoreUpdater = (enabled: boolean) => {
  const trackTempVal = useTelemetry('TrackTempCrew');
  const airTempVal = useTelemetry('AirTemp');
  const update = useTrackTemperatureStore((s) => s.update);

  useEffect(() => {
    if (!enabled) return;
    update(trackTempVal?.value?.[0], airTempVal?.value?.[0]);
  }, [enabled, trackTempVal?.value, airTempVal?.value, update]);
};

/**
 * Mount once (see OverlayContainer's TrackTemperatureUpdater) so the
 * TrackTempCrew/AirTemp telemetry subscriptions run once instead of once
 * per widget item that needs them.
 */
export const TrackTemperatureStoreUpdater = ({
  enabled,
}: {
  enabled: boolean;
}) => {
  useTrackTemperatureStoreUpdater(enabled);
  return null;
};
