import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'laptimelog',
  legacyTelemetry: false,
  sessionData: true,
  channels: ['lap-log.snapshot'],
  ratePreset: 'driverFocused',
} satisfies WidgetRuntimeDefinition;
