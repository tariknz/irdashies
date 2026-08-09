import { useEffect, useMemo } from 'react';
import { useDriverCarIdx, useSessionStore } from '../SessionStore/SessionStore';
import { useStandingsSnapshot } from '../ChannelStore';
import { usePushToPassStore } from './PushToPassStore';

export const usePushToPassStoreUpdater = (enabled: boolean) => {
  const snapshot = useStandingsSnapshot(enabled);
  const sessionDrivers = useSessionStore((s) => s.session?.DriverInfo?.Drivers);
  const playerCarIdx = useDriverCarIdx();
  const update = usePushToPassStore((s) => s.update);
  const carIdxToCarId = useMemo(() => {
    const map: Record<number, number> = {};
    for (const driver of sessionDrivers ?? [])
      map[driver.CarIdx] = driver.CarID;
    return map;
  }, [sessionDrivers]);

  useEffect(() => {
    if (!enabled || !snapshot) return;
    update(
      snapshot.carIdxP2PStatus,
      snapshot.carIdxP2PCount,
      carIdxToCarId,
      Math.floor(snapshot.sessionTime),
      snapshot.sessionUniqueId,
      playerCarIdx
    );
  }, [enabled, snapshot, carIdxToCarId, playerCarIdx, update]);
};
