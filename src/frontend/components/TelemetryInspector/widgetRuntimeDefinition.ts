import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'telemetryinspector',
  legacyTelemetry: true,
  ratePreset: 'driverFocused',
} satisfies WidgetRuntimeDefinition;
