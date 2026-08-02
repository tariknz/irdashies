import { useEffect } from 'react';
import { useSessionBestLapTime } from '../../components/Standings/hooks/useSessionBestLapTime';
import { useSessionBestLapStore } from './SessionBestLapStore';

export const useSessionBestLapStoreUpdater = (enabled: boolean) => {
  const sessionBestLap = useSessionBestLapTime();
  const update = useSessionBestLapStore((s) => s.update);

  useEffect(() => {
    if (!enabled) return;
    update(sessionBestLap);
  }, [enabled, sessionBestLap, update]);
};

/**
 * Mount once (see OverlayContainer's SessionBestLapUpdater) so the
 * CarIdxBestLapTime filter+min runs once instead of once per SessionBar
 * item that needs it.
 */
export const SessionBestLapStoreUpdater = ({
  enabled,
}: {
  enabled: boolean;
}) => {
  useSessionBestLapStoreUpdater(enabled);
  return null;
};
