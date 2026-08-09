import { useEffect } from 'react';
import type { TelemetryInspectorBridge } from '@irdashies/types';
import { useTelemetryStore } from './TelemetryStore';

/** Story-only adapter for fixtures that still drive the raw telemetry store. */
export const StoryTelemetryProvider = ({
  bridge,
}: {
  bridge: TelemetryInspectorBridge | Promise<TelemetryInspectorBridge>;
}) => {
  const setTelemetry = useTelemetryStore((state) => state.setTelemetry);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    Promise.resolve(bridge).then((resolved) => {
      if (cancelled) return;
      unsubscribe = resolved.onTelemetry(setTelemetry);
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [bridge, setTelemetry]);

  return null;
};
