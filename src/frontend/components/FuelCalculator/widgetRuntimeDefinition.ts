import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'fuel',
  legacyTelemetry: false,
  channels: ['fuel.projection'],
  ratePreset: 'gapTiming',
} satisfies WidgetRuntimeDefinition;
