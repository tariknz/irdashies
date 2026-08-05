import { useEffect, useRef } from 'react';
import type { SessionLifecycleEvent } from '@irdashies/types';

export const useSessionLifecycle = (
  handler: (event: SessionLifecycleEvent) => void
): void => {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!window.channelBridge) return;
    return window.channelBridge.subscribe('session.lifecycle', (event) =>
      handlerRef.current(event)
    );
  }, []);
};
