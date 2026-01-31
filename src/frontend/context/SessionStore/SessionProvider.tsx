import type { IrSdkBridge } from '@irdashies/types';
import { useSessionStore } from './SessionStore';
import { useEffect } from 'react';

export interface SessionProviderProps {
  bridge: IrSdkBridge | Promise<IrSdkBridge>;
}

export const SessionProvider = ({ bridge }: SessionProviderProps) => {
  const setSession = useSessionStore((state) => state.setSession);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | undefined;

    if (bridge instanceof Promise) {
      bridge.then((resolved) => {
        if (cancelled) {
          resolved.stop();
          return;
        }
        unsub = resolved.onSessionData((session) => {
          setSession(session);
        });
      });
      return () => {
        cancelled = true;
        if (unsub) unsub();
        bridge.then((resolved) => resolved.stop());
      };
    }

    unsub = bridge.onSessionData((session) => {
      setSession(session);
    });

    return () => {
      cancelled = true;
      if (unsub) unsub();
      bridge.stop();
    };
  }, [bridge, setSession]);

  return <></>;
};