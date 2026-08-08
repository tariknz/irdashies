import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'flatmap',
  legacyTelemetry: true,
  channels: ['reference-laps.snapshot'],
  ratePreset: 'static',
} satisfies WidgetRuntimeDefinition;
