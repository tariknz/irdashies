import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'broadcastpodium',
  sessionData: true,
  channels: [
    'car-speeds.snapshot',
    'lap-times.snapshot',
    'session-timing.snapshot',
    'standings.snapshot',
    'track-state.snapshot',
  ],
  ratePreset: 'informational',
} satisfies WidgetRuntimeDefinition;
