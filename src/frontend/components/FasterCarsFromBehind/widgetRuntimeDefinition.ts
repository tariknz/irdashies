import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'fastercarsfrombehind',
  legacyTelemetry: true,
  channels: ['relative-gaps.snapshot'],
  ratePreset: 'gapTiming',
} satisfies WidgetRuntimeDefinition;
