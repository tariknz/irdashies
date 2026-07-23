import type { Telemetry, TelemetryVar } from '@irdashies/types';
import { create, useStore } from 'zustand';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { useEffect, useState } from 'react';
import {
  arrayCompare,
  arrayCompareRounded,
  scalarCompareRounded,
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

/**
 * Returns the first telemetry value for a given key, only triggering re-renders
 * when the value changes beyond the given decimal precision. Use for
 * high-frequency scalar telemetry (e.g. LapDistPct, SessionTime) where
 * sub-threshold changes don't produce meaningful UI updates.
 */
export const useTelemetryValueRounded = (
  key: keyof Telemetry,
  precision: number
): number | undefined =>
  useStoreWithEqualityFn(
    useTelemetryStore,
    (state) => state.telemetry?.[key]?.value?.[0] as number | undefined,
    (a, b) => scalarCompareRounded(precision, a, b)
  );

/**
 * Returns telemetry values for a given key, sampled at most once per
 * intervalMs. Unlike *Rounded variants, this throttles by time, not value
 * delta — needed for full-grid arrays (e.g. CarIdxLapDistPct) where, with
 * enough cars, some element crosses any rounding threshold almost every
 * tick, making value-based rounding a no-op for re-render cadence.
 *
 * Schedules a flush only when the store actually changes, and only if one
 * isn't already pending — leading-edge throttle, not a poll. No timer runs
 * while telemetry is idle (sim disconnected, etc).
 *
 * Not implemented via a stateful equalityFn: useSyncExternalStoreWithSelector
 * (which backs useStoreWithEqualityFn) can invoke equalityFn more than once
 * per store update, so a comparator with a time-based side effect can
 * suppress the very change it just accepted.
 */
export const useTelemetryValuesThrottled = (
  key: keyof Telemetry,
  intervalMs = 66
): number[] => {
  const [sampled, setSampled] = useState<number[]>(
    () =>
      (useTelemetryStore.getState().telemetry?.[key]?.value ?? []) as number[]
  );

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const flush = () => {
      timer = undefined;
      const latest = (useTelemetryStore.getState().telemetry?.[key]?.value ??
        []) as number[];
      setSampled((prev) => (arrayCompare(prev, latest) ? prev : latest));
    };

    const unsubscribe = useTelemetryStore.subscribe(() => {
      if (timer === undefined) {
        timer = setTimeout(flush, intervalMs);
      }
    });

    return () => {
      unsubscribe();
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [key, intervalMs]);

  return sampled;
};
