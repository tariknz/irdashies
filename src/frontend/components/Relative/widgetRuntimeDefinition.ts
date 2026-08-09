import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'relative',
  legacyTelemetry: false,
  sessionData: true,
  channels: [
    'lap-times.snapshot',
    'radio.snapshot',
    'session-timing.snapshot',
    'session-bar.snapshot',
    'relative-gaps.snapshot',
    'standings.snapshot',
    'track-state.snapshot',
  ],
  ratePreset: 'gapTiming',
  channelRates: { 'radio.snapshot': 25 },
} satisfies WidgetRuntimeDefinition;
