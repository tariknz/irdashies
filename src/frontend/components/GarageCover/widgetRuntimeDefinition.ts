import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'garagecover',
  legacyTelemetry: false,
  channels: ['track-state.snapshot'],
  ratePreset: 'driverFocused',
} satisfies WidgetRuntimeDefinition;
