import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'standings',
  legacyTelemetry: true,
  channels: [
    'lap-times.snapshot',
    'reference-laps.snapshot',
    'radio.snapshot',
    'standings.snapshot',
  ],
  ratePreset: 'gapTiming',
  channelRates: { 'radio.snapshot': 25 },
} satisfies WidgetRuntimeDefinition;
