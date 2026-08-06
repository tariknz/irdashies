import { defineRendererSubscriptionBridge } from './defineBridge';

export const LEGACY_STREAM_BRIDGE = 'legacy-stream';

export type LegacyRendererStream = 'telemetry' | 'sessionData';

export const isLegacyRendererStream = (
  value: unknown
): value is LegacyRendererStream =>
  value === 'telemetry' || value === 'sessionData';

export const setupLegacyRendererSubscriptions = () =>
  defineRendererSubscriptionBridge<LegacyRendererStream>({
    name: LEGACY_STREAM_BRIDGE,
    isValidKey: isLegacyRendererStream,
  });
