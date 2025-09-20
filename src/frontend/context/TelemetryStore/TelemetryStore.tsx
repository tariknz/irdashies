import type { Telemetry, TelemetryVar } from '@irdashies/types';
import { create, useStore } from 'zustand';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { useEffect } from 'react';
import { arrayCompare, telemetryCompare } from './telemetryCompare';
import { useCurrentOverlayId } from '../shared/useCurrentOverlayId';

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
  fieldSubscriptions: Map<string, Set<keyof Telemetry>>;
  subscribeToFields: (overlayId: string, fields: (keyof Telemetry)[]) => void;
  unsubscribeFromFields: (overlayId: string, fields: (keyof Telemetry)[]) => void;
}

export const useTelemetryStore = create<TelemetryState>((set) => ({
  telemetry: null,
  fieldSubscriptions: new Map<string, Set<keyof Telemetry>>(),
  setTelemetry: (telemetry) => {
    if (typeof telemetry === 'function') {
      set((state) => ({ telemetry: telemetry(state.telemetry) }));
    } else {
      set({ telemetry });
    }
  },
  subscribeToFields: (overlayId: string, fields: (keyof Telemetry)[]) => {
    set((state) => {
      const newSubscriptions = new Map(state.fieldSubscriptions);
      const overlayFields = newSubscriptions.get(overlayId) || new Set();
      const updatedFields = new Set([...overlayFields, ...fields]);
      newSubscriptions.set(overlayId, updatedFields);
      return { fieldSubscriptions: newSubscriptions };
    });
  },
  unsubscribeFromFields: (overlayId: string, fields: (keyof Telemetry)[]) => {
    set((state) => {
      const newSubscriptions = new Map(state.fieldSubscriptions);
      const overlayFields = newSubscriptions.get(overlayId);
      if (overlayFields) {
        const updatedFields = new Set(overlayFields);
        fields.forEach(field => updatedFields.delete(field));
        if (updatedFields.size === 0) {
          newSubscriptions.delete(overlayId);
        } else {
          newSubscriptions.set(overlayId, updatedFields);
        }
      }
      return { fieldSubscriptions: newSubscriptions };
    });
  },
}));

// Hook to track telemetry field usage and auto-subscribe
export const useTelemetryFieldTracker = (field: keyof Telemetry) => {
  const overlayId = useCurrentOverlayId();
  const subscribeToFields = useTelemetryStore(state => state.subscribeToFields);
  const unsubscribeFromFields = useTelemetryStore(state => state.unsubscribeFromFields);

  useEffect(() => {
    if (overlayId) {
      try {
        // Subscribe to this field locally
        subscribeToFields(overlayId, [field]);

        // Send subscription to main process via IPC (only log errors)
        window.telemetryBridge?.subscribeToTelemetryFields([field])
          .catch(error => {
            console.warn(`Failed to subscribe to telemetry field ${field}:`, error);
            // Continue with local subscription even if IPC fails
          });
      } catch (error) {
        console.error(`Error subscribing to telemetry field ${field}:`, error);
      }
    }

    return () => {
      if (overlayId) {
        try {
          // Unsubscribe locally
          unsubscribeFromFields(overlayId, [field]);

          // Unsubscribe from main process
          window.telemetryBridge?.unsubscribeFromTelemetryFields([field])
            .catch(error => {
              console.warn(`Failed to unsubscribe from telemetry field ${field}:`, error);
            });
        } catch (error) {
          console.error(`Error unsubscribing from telemetry field ${field}:`, error);
        }
      }
    };
  }, [field, overlayId, subscribeToFields, unsubscribeFromFields]);
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
