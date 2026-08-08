import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'map',
  legacyTelemetry: true,
  channels: ['reference-laps.snapshot', 'sector-timing.snapshot'],
  ratePreset: 'static',
} satisfies WidgetRuntimeDefinition;
