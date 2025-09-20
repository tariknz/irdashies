import type { IrSdkBridge, OverlayTelemetryPayload, Telemetry } from '@irdashies/types';
import { useTelemetryStore } from './TelemetryStore';
import { useEffect, useCallback } from 'react';

export interface TelemetryProviderProps {
  bridge: IrSdkBridge | Promise<IrSdkBridge>;
}

export const TelemetryProvider = ({ bridge }: TelemetryProviderProps) => {
  const setTelemetry = useTelemetryStore((state) => state.setTelemetry);

  // Handler for telemetry updates
  const handleTelemetryUpdate = useCallback((data: OverlayTelemetryPayload) => {
    const payload = data;

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
