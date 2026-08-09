import { useEffect } from 'react';
import { useSessionBarSnapshot } from '../ChannelStore';
import { useTrackTemperatureStore } from './TrackTemperatureStore';

export const useTrackTemperatureStoreUpdater = (enabled: boolean) => {
  const snapshot = useSessionBarSnapshot();
  const update = useTrackTemperatureStore((s) => s.update);

  useEffect(() => {
    if (!enabled) return;
    update(snapshot?.trackTemp, snapshot?.airTemp);
  }, [enabled, snapshot?.trackTemp, snapshot?.airTemp, update]);
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
