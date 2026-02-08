import type { IrSdkBridge } from '@irdashies/types';
import { useTelemetryStore } from './TelemetryStore';
import { useEffect } from 'react';

export interface TelemetryProviderProps {
  bridge: IrSdkBridge | Promise<IrSdkBridge>;
}

export const TelemetryProvider = ({ bridge }: TelemetryProviderProps) => {
  const setTelemetry = useTelemetryStore((state) => state.setTelemetry);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | undefined;

    if (bridge instanceof Promise) {
      bridge.then((resolved) => {
        if (cancelled) {
          resolved.stop();
          return;
        }
        unsub = resolved.onTelemetry((telemetry) => {
          setTelemetry(telemetry);
        });
      });
      return () => {
        cancelled = true;
        if (unsub) unsub();
        bridge.then((resolved) => resolved.stop());
      };
    }

    unsub = bridge.onTelemetry((telemetry) => {
      setTelemetry(telemetry);
    });

    return () => {
      cancelled = true;
      if (unsub) unsub();
      bridge.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge]);

  return <></>;
};
