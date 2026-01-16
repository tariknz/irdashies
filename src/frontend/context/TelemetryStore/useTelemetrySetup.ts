import type { IrSdkBridge } from '@irdashies/types';
import { useTelemetryStore } from './TelemetryStore';
import { useEffect } from 'react';

/**
 * Hook to set up telemetry listeners and sync with Zustand store
 * Call this once in your app to initialize telemetry data flow
 */
export const useTelemetrySetup = (bridge: IrSdkBridge | Promise<IrSdkBridge>) => {
  const setTelemetry = useTelemetryStore((state) => state.setTelemetry);

  useEffect(() => {
    console.log('📡 Telemetry setup initialized, bridge:', bridge);
    
    if (bridge instanceof Promise) {
      console.log('📡 Bridge is Promise, waiting...');
      bridge.then((bridge) => {
        console.log('📡 Bridge resolved, setting up telemetry callback');
        bridge.onTelemetry((telemetry) => {
          setTelemetry(telemetry);
        });
      });
      return () => bridge.then((bridge) => bridge.stop());
    }

    console.log('📡 Bridge is ready, setting up telemetry callback');
    bridge.onTelemetry((telemetry) => {
      setTelemetry(telemetry);
    });

    return () => bridge.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge]);
};
