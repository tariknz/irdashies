import { useEffect } from 'react';
import type { TelemetryInspectorBridge } from '@irdashies/types';
import { useSessionStore } from '../SessionStore/SessionStore';
import { useTelemetryStore } from '../TelemetryStore/TelemetryStore';

export const TelemetryInspectorProvider = ({
  bridge,
}: {
  bridge: TelemetryInspectorBridge;
}) => {
  const setSession = useSessionStore((state) => state.setSession);
  const setTelemetry = useTelemetryStore((state) => state.setTelemetry);

  useEffect(() => {
    const unsubscribeTelemetry = bridge.onTelemetry(setTelemetry);
    const unsubscribeSession = bridge.onSessionData(setSession);
    return () => {
      unsubscribeTelemetry?.();
      unsubscribeSession?.();
    };
  }, [bridge, setSession, setTelemetry]);

  return null;
};
