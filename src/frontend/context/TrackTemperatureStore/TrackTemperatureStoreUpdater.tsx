import { useEffect } from 'react';
import type { SessionBarSnapshot } from '@irdashies/types';
import { shallow } from 'zustand/shallow';
import { useSessionBarSelector } from '../ChannelStore';
import { useTrackTemperatureStore } from './TrackTemperatureStore';

const EMPTY_TEMPERATURES: readonly [number | undefined, number | undefined] = [
  undefined,
  undefined,
];

const selectTemperatures = (snapshot: SessionBarSnapshot) =>
  [snapshot.trackTemp, snapshot.airTemp] as const;

export const useTrackTemperatureStoreUpdater = (enabled: boolean) => {
  const [trackTemp, airTemp] =
    useSessionBarSelector(selectTemperatures, { equality: shallow }) ??
    EMPTY_TEMPERATURES;
  const update = useTrackTemperatureStore((s) => s.update);

  useEffect(() => {
    if (!enabled) return;
    update(trackTemp, airTemp);
  }, [enabled, trackTemp, airTemp, update]);
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
