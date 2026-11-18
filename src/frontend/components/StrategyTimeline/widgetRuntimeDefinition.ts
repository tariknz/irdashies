import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'strategytimeline',
  // The user's own stints are found by the DriverUserID in session info.
  sessionData: true,
  channels: ['race-plan.progress'],
  // The channel publishes once a second.
  ratePreset: 'informational',
} satisfies WidgetRuntimeDefinition;
