import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'broadcastevents',
  sessionData: true,
  // raceControl.incidents is an event channel, subscribed directly.
  channels: ['standings.snapshot', 'track-state.snapshot'],
  ratePreset: 'informational',
} satisfies WidgetRuntimeDefinition;
