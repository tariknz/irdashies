import type { IrSdkBridge, OverlayTelemetryPayload, Telemetry } from '@irdashies/types';
import { useTelemetryStore } from './TelemetryStore';
import { useEffect, useCallback } from 'react';

export interface TelemetryProviderProps {
  bridge: IrSdkBridge | Promise<IrSdkBridge>;
}

export const TelemetryProvider = ({ bridge }: TelemetryProviderProps) => {
  const setTelemetry = useTelemetryStore((state) => state.setTelemetry);

  // Handler for telemetry updates
  const handleTelemetryUpdate = useCallback((data: Telemetry | OverlayTelemetryPayload) => {
    // Check if this is a new targeted payload or legacy full telemetry
    if (data && typeof data === 'object' && 'telemetry' in data && 'timestamp' in data) {
      // This is a new OverlayTelemetryPayload
      const payload = data as OverlayTelemetryPayload;

      // Update telemetry state with partial data
      setTelemetry((currentState) => {
        if (!currentState) {
          // If no current telemetry, create a new object with just the fields we received
          return payload.telemetry as Telemetry;
        }

        // Merge the new fields into the existing telemetry
        return {
          ...currentState,
          ...payload.telemetry,
        } as Telemetry;
      });
    } else {
      // This is legacy full telemetry
      setTelemetry(data as Telemetry);
    }
  }, [setTelemetry]);

  useEffect(() => {
    if (bridge instanceof Promise) {
      bridge.then((resolvedBridge) => {
        resolvedBridge.onTelemetry(handleTelemetryUpdate);
      });
      return () => bridge.then((resolvedBridge) => resolvedBridge.stop());
    }

    bridge.onTelemetry(handleTelemetryUpdate);
    return () => bridge.stop();
  }, [bridge, handleTelemetryUpdate]);

  return <></>;
};
