import type { IrSdkBridge } from '@irdashies/types';
import { useSessionStore } from './SessionStore';
import { useEffect } from 'react';

export interface SessionProviderProps {
  bridge: IrSdkBridge | Promise<IrSdkBridge>;
}

export const SessionProvider = ({ bridge }: SessionProviderProps) => {
  const setSession = useSessionStore((state) => state.setSession);

  useEffect(() => {
    if (bridge instanceof Promise) {
      bridge.then((bridge) => {
        bridge.onSessionData((telemetry) => {
          setSession(telemetry);
        });
      });
      return;
    }

    bridge.onSessionData((telemetry) => {
      setSession(telemetry);
    });
    // Don't stop bridge on unmount - it should persist
  }, [bridge, setSession]);

  return <></>;
};
