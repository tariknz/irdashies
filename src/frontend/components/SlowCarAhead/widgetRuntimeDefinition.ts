import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'slowcarahead',
  legacyTelemetry: true,
  channels: ['car-speeds.snapshot'],
  ratePreset: 'driverFocused',
  channelRates: { 'car-speeds.snapshot': 10 },
} satisfies WidgetRuntimeDefinition;
