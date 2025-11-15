import type { IrSdkBridge } from '@irdashies/types';
import { useTelemetryStore } from './TelemetryStore';
import { useEffect } from 'react';

export interface TelemetryProviderProps {
  bridge: IrSdkBridge | Promise<IrSdkBridge>;
}

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
      return;
    }

    console.log('📡 Bridge is ready, setting up callback');
    bridge.onTelemetry((telemetry) => {
      setTelemetry(telemetry);
    });
    // Don't stop bridge on unmount - it should persist
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge]);

  return <></>;
};
