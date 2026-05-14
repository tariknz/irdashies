import { useEffect, useMemo } from 'react';
import { useStore } from 'zustand';
import {
  useTelemetryValues,
  useTelemetryValue,
  useTelemetryStore,
} from '../TelemetryStore/TelemetryStore';
import { useDriverCarIdx, useSessionStore } from '../SessionStore/SessionStore';
import { usePushToPassStore, type P2PDisplayState } from './PushToPassStore';

/**
 * Hook that drives the PushToPassStore from telemetry each frame.
 * Call this once in Standings and Relative components.
 */
export const usePushToPassStoreUpdater = () => {
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
    update(
      p2pStatus ?? [],
      p2pCount ?? [],
      carIdxToCarId,
      sessionTime ?? 0,
      sessionUniqId ?? 0,
      playerCarIdx
    );
  }, [
    p2pStatus,
    p2pCount,
    carIdxToCarId,
    sessionTime,
    sessionUniqId,
    playerCarIdx,
    update,
  ]);
};

/**
 * Returns computed P2P display state for every car index.
 * Returns undefined for cars that do not support P2P.
 */
export const useP2PDisplayStates = (): (P2PDisplayState | undefined)[] => {
  return usePushToPassStore((s) => s.displayStates);
};
