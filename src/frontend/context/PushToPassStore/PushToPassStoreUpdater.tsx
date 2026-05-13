import { useEffect, useMemo } from 'react';
import { useStore } from 'zustand';
import {
  useTelemetryValues,
  useTelemetryValue,
  useTelemetryStore,
} from '../TelemetryStore/TelemetryStore';
import { useDriverCarIdx, useSessionStore } from '../SessionStore/SessionStore';
import { usePushToPassStore, type P2PDisplayState } from './PushToPassStore';
import { getCarP2PConfig } from './carP2PConfigs';

// Other cars report CarIdxP2P_Count as IEEE-754 float32 bits despite varType=2 (int).
// The player's own car reports it as a plain integer — no conversion needed.
const parseP2PCount = (bits: number, isPlayer: boolean): number => {
  if (isPlayer) return bits;
  const view = new DataView(new ArrayBuffer(4));
  view.setInt32(0, bits, true);
  return Math.round(view.getFloat32(0, true)*10);
};

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
  const p2pStatus = useTelemetryValues<boolean[]>('CarIdxP2P_Status');
  const p2pCount = useTelemetryValues<number[]>('CarIdxP2P_Count');
  const sessionDrivers = useSessionStore((s) => s.session?.DriverInfo?.Drivers);
  const playerCarIdx = useDriverCarIdx();
  const cooldownEndTimes = usePushToPassStore((s) => s.cooldownEndTimes);
  const sessionTime = usePushToPassStore((s) => s.sessionTime);

  return useMemo(() => {
    const carIdxToCarId: Record<number, number> = {};
    for (const driver of sessionDrivers ?? []) {
      carIdxToCarId[driver.CarIdx] = driver.CarID;
    }

    const maxIdx = Math.max(p2pStatus?.length ?? 0, p2pCount?.length ?? 0);
    const result: (P2PDisplayState | undefined)[] = [];

    for (let carIdx = 0; carIdx < maxIdx; carIdx++) {
      const carId = carIdxToCarId[carIdx];
      const config = carId !== undefined ? getCarP2PConfig(carId) : undefined;

      if (!config) {
        result[carIdx] = undefined;
        continue;
      }

      const count = parseP2PCount(
        p2pCount?.[carIdx] ?? 0,
        carIdx === playerCarIdx
      );
      const isActive = p2pStatus?.[carIdx] ?? false;
      const cooldownEnd = cooldownEndTimes[carIdx] ?? null;

      let status: P2PDisplayState['status'];
      if (count <= 0) {
        status = 'exhausted';
      } else if (isActive) {
        status = 'active';
      } else if (cooldownEnd !== null && sessionTime < cooldownEnd) {
        status = 'cooldown';
      } else {
        status = 'inactive';
      }

      result[carIdx] = { status, count };
    }

    return result;
  }, [
    p2pStatus,
    p2pCount,
    sessionDrivers,
    playerCarIdx,
    cooldownEndTimes,
    sessionTime,
  ]);
};
