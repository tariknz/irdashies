import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'relative',
  legacyTelemetry: true,
  channels: [
    'lap-times.snapshot',
    'radio.snapshot',
    'session-timing.snapshot',
    'relative-gaps.snapshot',
    'standings.snapshot',
  ],
  ratePreset: 'gapTiming',
  channelRates: { 'radio.snapshot': 25 },
} satisfies WidgetRuntimeDefinition;
