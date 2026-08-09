import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'standings',
  legacyTelemetry: false,
  sessionData: true,
  channels: [
    'lap-times.snapshot',
    'reference-laps.snapshot',
    'radio.snapshot',
    'session-timing.snapshot',
    'session-bar.snapshot',
    'standings.snapshot',
    'track-state.snapshot',
  ],
  ratePreset: 'gapTiming',
  channelRates: { 'radio.snapshot': 25 },
} satisfies WidgetRuntimeDefinition;
