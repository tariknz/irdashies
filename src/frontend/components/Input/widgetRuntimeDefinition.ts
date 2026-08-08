import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'input',
  legacyTelemetry: false,
  channels: ['driver-controls.snapshot'],
  ratePreset: 'driverFocused',
  channelRates: { 'driver-controls.snapshot': 60 },
} satisfies WidgetRuntimeDefinition;
