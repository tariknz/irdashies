import type { Telemetry, TelemetryVar } from '@irdashies/types';
import { create, useStore } from 'zustand';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { arrayCompare, telemetryCompare } from './telemetryCompare';

interface TelemetryState {
  telemetry: Telemetry | null;
  setTelemetry: (session: Telemetry) => void;
}

export const useTelemetryStore = create<TelemetryState>((set) => ({
  telemetry: null as Telemetry | null,
  setTelemetry: (telemetry: Telemetry) => set({ telemetry }),
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
 * Returns the first telemetry value for a given key plus a mapping function.
 * @param key the key of the telemetry value to retrieve
 * @param mapFn the mapping function to apply to the value
 * @returns the first telemetry value
 */
export const useTelemetryValuesMapped = <
  T extends number[] | boolean[], // Ensure T is an array of numbers or booleans
>(
  key: keyof Telemetry,
  mapFn: (val: T[number]) => T[number]
): T =>
  useStoreWithEqualityFn(
    useTelemetryStore,
    (state) => (state.telemetry?.[key]?.value ?? []).map(mapFn) as T,
    arrayCompare
  );
