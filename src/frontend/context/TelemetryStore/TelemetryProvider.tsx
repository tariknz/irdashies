import type { IrSdkBridge } from '@irdashies/types';
import { useTelemetryStore } from './TelemetryStore';
import { useEffect } from 'react';

export interface TelemetryProviderProps {
  bridge: IrSdkBridge | Promise<IrSdkBridge>;
}

/**
 * Provider that sets up telemetry listeners
 * Returns null - does not render any UI, only initializes listeners
 */
export const TelemetryProvider = ({ bridge }: TelemetryProviderProps) => {
  const setTelemetry = useTelemetryStore((state) => state.setTelemetry);

  useEffect(() => {
    console.log('📡 TelemetryProvider mounted, bridge:', bridge);
    
    if (bridge instanceof Promise) {
      console.log('📡 Bridge is Promise, waiting...');
      bridge.then((bridge) => {
        console.log('📡 Bridge resolved, setting up callback');
        bridge.onTelemetry((telemetry) => {
          setTelemetry(telemetry);
        });
      });
      return () => bridge.then((bridge) => bridge.stop());
    }

    console.log('📡 Bridge is ready, setting up callback');
    bridge.onTelemetry((telemetry) => {
      setTelemetry(telemetry);
    });

    return () => bridge.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge]);

  return null;
};
