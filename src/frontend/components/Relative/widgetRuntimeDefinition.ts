import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'relative',
  legacyTelemetry: true,
  channels: ['lap-times.snapshot'],
  ratePreset: 'gapTiming',
} satisfies WidgetRuntimeDefinition;
