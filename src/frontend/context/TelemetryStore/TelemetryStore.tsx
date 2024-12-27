import type { Telemetry, TelemetryVar } from '@irdashies/types';
import { create } from 'zustand';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { telemetryCompare } from './telemetryCompare';

interface TelemetryState {
  telemetry: Telemetry | null;
  setTelemetry: (session: Telemetry) => void;
}

export const useTelemetryStore = create<TelemetryState>((set) => ({
  telemetry: null as Telemetry | null,
  setTelemetry: (telemetry: Telemetry) => set({ telemetry }),
}));

export const useTelemetryValue = <T extends number[] | boolean[] = number[]>(
  key: keyof Telemetry
) =>
  useStoreWithEqualityFn(
    useTelemetryStore,
    (state) => state.telemetry?.[key] as TelemetryVar<T>,
    telemetryCompare
  );

export const useSingleTelemetryValue = <T extends number | boolean = number>(
  key: keyof Telemetry
): T | undefined => {
  const val = useTelemetryValue(key);
  return val?.value?.[0] as T;
};
