import { useEffect, useMemo } from 'react';
import { useStore } from 'zustand';
import {
  useTelemetryValues,
  useTelemetryValue,
  useTelemetryStore,
} from '../TelemetryStore/TelemetryStore';
import { useDriverCarIdx, useSessionStore } from '../SessionStore/SessionStore';
import { usePushToPassStore } from './PushToPassStore';

/**
 * Hook that drives the PushToPassStore from telemetry each frame.
 * Call this once in Standings and Relative components.
 */
export const usePushToPassStoreUpdater = (enabled: boolean) => {
  const p2pStatus = useTelemetryValues<boolean[]>('CarIdxP2P_Status');
  const p2pCount = useTelemetryValues<number[]>('CarIdxP2P_Count');
  const sessionUniqId = useTelemetryValue('SessionUniqueID');
  const sessionDrivers = useSessionStore((s) => s.session?.DriverInfo?.Drivers);
  const playerCarIdx = useDriverCarIdx();
  const update = usePushToPassStore((s) => s.update);

  const sessionTime = useStore(useTelemetryStore, (state) => {
    const raw = state.telemetry?.SessionTime?.value?.[0];
    if (raw == null) return null;
    return Math.floor(raw);
  });

  const carIdxToCarId = useMemo(() => {
    const map: Record<number, number> = {};
    for (const driver of sessionDrivers ?? []) {
      map[driver.CarIdx] = driver.CarID;
    }
    return map;
  }, [sessionDrivers]);

  useEffect(() => {
    if (!enabled) return;
    update(
      p2pStatus ?? [],
      p2pCount ?? [],
      carIdxToCarId,
      sessionTime ?? 0,
      sessionUniqId ?? 0,
      playerCarIdx
    );
  }, [
    enabled,
    p2pStatus,
    p2pCount,
    carIdxToCarId,
    sessionTime,
    sessionUniqId,
    playerCarIdx,
    update,
  ]);
};
