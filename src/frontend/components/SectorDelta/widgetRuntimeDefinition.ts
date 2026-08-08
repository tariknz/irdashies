import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'sectordelta',
  legacyTelemetry: true,
  channels: ['reference-laps.snapshot'],
  ratePreset: 'static',
} satisfies WidgetRuntimeDefinition;
