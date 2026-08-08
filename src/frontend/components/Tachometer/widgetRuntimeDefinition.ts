import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'tachometer',
  legacyTelemetry: false,
  channels: ['driver-controls.snapshot'],
  ratePreset: 'driverFocused',
} satisfies WidgetRuntimeDefinition;
