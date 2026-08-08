import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'fastercarsfrombehind',
  legacyTelemetry: false,
  sessionData: true,
  channels: [
    'relative-gaps.snapshot',
    'standings.snapshot',
    'track-state.snapshot',
  ],
  ratePreset: 'gapTiming',
} satisfies WidgetRuntimeDefinition;
