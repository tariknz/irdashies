import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'battle',
  legacyTelemetry: true,
  channels: ['car-speeds.snapshot', 'reference-laps.snapshot'],
  ratePreset: 'driverFocused',
  channelRates: { 'car-speeds.snapshot': 10 },
} satisfies WidgetRuntimeDefinition;
