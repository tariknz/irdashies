import type { Telemetry, TelemetryVar } from '@irdashies/types';
import { create, useStore } from 'zustand';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { arrayCompare, telemetryCompare } from './telemetryCompare';

// Module augmentation for telemetryBridge
declare global {
  interface Window {
    telemetryBridge: {
      subscribeToTelemetryFields: (fields: (keyof Telemetry)[]) => Promise<void>;
      unsubscribeFromTelemetryFields: (fields: (keyof Telemetry)[]) => Promise<void>;
    };
  }
}

interface TelemetryState {
  telemetry: Telemetry | null;
  setTelemetry: (telemetry: Telemetry | null | ((prevState: Telemetry | null) => Telemetry | null)) => void;
  fieldSubscriptions: Set<keyof Telemetry>;
  subscribeToFields: (fields: (keyof Telemetry)[]) => void;
  unsubscribeFromFields: (fields: (keyof Telemetry)[]) => void;
}

// Hook to get current overlay ID from route
export const useCurrentOverlayId = (): string | null => {
  const location = useLocation();
  // Extract overlay ID from path (e.g., "/speedometer" -> "speedometer")
  const pathParts = location.pathname.split('/');
  const overlayId = pathParts[1] || null;
  return overlayId;
};

export const useTelemetryStore = create<TelemetryState>((set, get) => ({
  telemetry: null,
  fieldSubscriptions: new Set<keyof Telemetry>(),
  setTelemetry: (telemetry) => {
    if (typeof telemetry === 'function') {
      set((state) => ({ telemetry: telemetry(state.telemetry) }));
    } else {
      set({ telemetry });
    }
  },
  subscribeToFields: (fields: (keyof Telemetry)[]) => {
    const currentSubscriptions = get().fieldSubscriptions;
    const newSubscriptions = new Set([...currentSubscriptions, ...fields]);
    set({ fieldSubscriptions: newSubscriptions });
  },
  unsubscribeFromFields: (fields: (keyof Telemetry)[]) => {
    const currentSubscriptions = get().fieldSubscriptions;
    const newSubscriptions = new Set(currentSubscriptions);
    fields.forEach(field => newSubscriptions.delete(field));
    set({ fieldSubscriptions: newSubscriptions });
  },
}));

// Hook to track telemetry field usage and auto-subscribe
export const useTelemetryFieldTracker = (field: keyof Telemetry) => {
  const overlayId = useCurrentOverlayId();
  const subscribeToFields = useTelemetryStore(state => state.subscribeToFields);

  useEffect(() => {
    if (overlayId) {
      // Subscribe to this field
      subscribeToFields([field]);

      // Send subscription to main process via IPC
      window.telemetryBridge?.subscribeToTelemetryFields([field]);
    }

    return () => {
      if (overlayId) {
        window.telemetryBridge?.unsubscribeFromTelemetryFields([field]);
      }
    };
  }, [field, overlayId, subscribeToFields]);
};

export const useTelemetry = <T extends number[] | boolean[] = number[]>(
  key: keyof Telemetry
) => {
  // Track that this component uses this field
  useTelemetryFieldTracker(key);

  return useStoreWithEqualityFn(
    useTelemetryStore,
    (state) => state.telemetry?.[key] as TelemetryVar<T>,
    telemetryCompare
  );
};

/**
 * Returns the first telemetry value for a given key.
 * @param key the key of the telemetry value to retrieve
 * @returns the first telemetry value
 */
export const useTelemetryValue = <T extends number | boolean = number>(
  key: keyof Telemetry
): T | undefined => {
  // Track that this component uses this field
  useTelemetryFieldTracker(key);

  return useStore(
    useTelemetryStore,
    (state) => state.telemetry?.[key]?.value?.[0] as T
  );
};

/**
 * Returns the telemetry values for a given key.
 * @param key the key of the telemetry value to retrieve
 * @returns the telemetry values
 */
export const useTelemetryValues = <T extends number[] | boolean[] = number[]>(
  key: keyof Telemetry
): T => {
  // Track that this component uses this field
  useTelemetryFieldTracker(key);

  return useStoreWithEqualityFn(
    useTelemetryStore,
    (state) => (state.telemetry?.[key]?.value ?? []) as T,
    arrayCompare
  );
};

/**
 * Returns the telemetry values for a given key plus a mapping function.
 * @param key the key of the telemetry value to retrieve
 * @param mapFn the mapping function to apply to the value
 * @returns the telemetry values
 */
export const useTelemetryValuesMapped = <
  T extends number[] | boolean[], // Ensure T is an array of numbers or booleans
>(
  key: keyof Telemetry,
  mapFn: (val: T[number]) => T[number]
): T => {
  // Track that this component uses this field
  useTelemetryFieldTracker(key);

  return useStoreWithEqualityFn(
    useTelemetryStore,
    (state) => (state.telemetry?.[key]?.value ?? []).map(mapFn) as T,
    arrayCompare
  );
};
