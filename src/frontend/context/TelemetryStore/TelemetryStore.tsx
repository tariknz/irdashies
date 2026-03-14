import type { Telemetry, TelemetryVar } from '@irdashies/types';
import { create, useStore } from 'zustand';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import {
  arrayCompare,
  arrayCompareRounded,
  telemetryCompare,
} from './telemetryCompare';

interface TelemetryState {
  telemetry: Telemetry | null;
  setTelemetry: (telemetry: Telemetry | null) => void;
  resetTelemetry: () => void;
}

export const useTelemetryStore = create<TelemetryState>((set) => ({
  telemetry: null,
  setTelemetry: (telemetry: Telemetry | null) => set({ telemetry }),
  resetTelemetry: () => set({ telemetry: null }),
}));

export const useTelemetry = <T extends number[] | boolean[] = number[]>(
  key: keyof Telemetry
) =>
  useStoreWithEqualityFn(
    useTelemetryStore,
    (state) => state.telemetry?.[key] as TelemetryVar<T>,
    telemetryCompare
  );

/**
 * Returns the first telemetry value for a given key.
 * @param key the key of the telemetry value to retrieve
 * @returns the first telemetry value
 */
export const useTelemetryValue = <T extends number | boolean = number>(
  key: keyof Telemetry
): T | undefined =>
  useStore(
    useTelemetryStore,
    (state) => state.telemetry?.[key]?.value?.[0] as T
  );

/**
 * Returns the first telemetry value for a given key.
 * @param key the key of the telemetry value to retrieve
 * @returns the first telemetry value
 */
export const useTelemetryValues = <T extends number[] | boolean[] = number[]>(
  key: keyof Telemetry
): T =>
  useStoreWithEqualityFn(
    useTelemetryStore,
    (state) => (state.telemetry?.[key]?.value ?? []) as T,
    arrayCompare
  );

/**
 * Returns telemetry values for a given key, only triggering re-renders when
 * values change beyond the given decimal precision. Use for high-frequency
 * array telemetry (e.g. CarIdxLapDistPct) where sub-threshold changes don't
 * produce meaningful UI updates.
 */
export const useTelemetryValuesRounded = (
  key: keyof Telemetry,
  precision: number
): number[] =>
  useStoreWithEqualityFn(
    useTelemetryStore,
    (state) => (state.telemetry?.[key]?.value ?? []) as number[],
    (a, b) => arrayCompareRounded(precision, a, b)
  );
