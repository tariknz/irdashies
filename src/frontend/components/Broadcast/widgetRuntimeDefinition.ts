import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'broadcast',
  sessionData: true,
  // raceControl.incidents is an event channel, subscribed directly.
  channels: [
    'lap-times.snapshot',
    'radio.snapshot',
    'session-bar.snapshot',
    'session-timing.snapshot',
    'standings.snapshot',
    'track-state.snapshot',
  ],
  ratePreset: 'gapTiming',
  channelRates: { 'radio.snapshot': 25 },
} satisfies WidgetRuntimeDefinition;
