import { IrSdkBridge } from '@irdashies/types';
import { useTelemetryStore } from './TelemetryStore';
import { useEffect } from 'react';

export type TelemetryProviderProps = {
  bridge: IrSdkBridge | Promise<IrSdkBridge>;
};

export const TelemetryProvider = ({ bridge }: TelemetryProviderProps) => {
  const setTelemetry = useTelemetryStore((state) => state.setTelemetry);

  useEffect(() => {
    if (bridge instanceof Promise) {
      bridge.then((bridge) => {
        bridge.onTelemetry((telemetry) => {
          setTelemetry(telemetry);
        });
      });
      return () => bridge.then((bridge) => bridge.stop());
    }

    bridge.onTelemetry((telemetry) => {
      setTelemetry(telemetry);
    });
    return () => bridge.stop();
  }, [bridge, setTelemetry]);

  return <></>;
};
