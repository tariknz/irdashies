import { create } from 'zustand';
import type { Telemetry } from '@irdashies/types';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { arrayCompare } from './telemetryCompare';

interface ThrottledTelemetryState {
  telemetry: Telemetry | null;
  setTelemetry: (telemetry: Telemetry | null) => void;
}

/**
 * A store that holds throttled telemetry data (updated at ~10Hz).
 * Use this store for UI components that don't need 60Hz updates
 * to avoid excessive re-renders.
 */
export const useThrottledTelemetryStore = create<ThrottledTelemetryState>(
  (set) => ({
    telemetry: null,
    setTelemetry: (telemetry: Telemetry | null) => set({ telemetry }),
  })
);

/**
 * Returns the throttled telemetry value for a given key.
 */
export const useThrottledTelemetryValue = <T extends number | boolean = number>(
  key: keyof Telemetry
): T | undefined =>
  useStoreWithEqualityFn(
    useThrottledTelemetryStore,
    (state) => state.telemetry?.[key]?.value?.[0] as T,
    Object.is
  );

/**
 * Returns the throttled telemetry values for a given key.
 */
export const useThrottledTelemetryValues = <
  T extends number[] | boolean[] = number[],
>(
  key: keyof Telemetry
): T =>
  useStoreWithEqualityFn(
    useThrottledTelemetryStore,
    (state) => (state.telemetry?.[key]?.value ?? []) as T,
    arrayCompare
  );
