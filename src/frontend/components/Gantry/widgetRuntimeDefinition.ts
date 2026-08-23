import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'gantry',
  // Gantry lists the field from useSessionDrivers, which is session data
  // rather than telemetry.
  sessionData: true,
  // Event channels (raceControl.incidents, session.lifecycle) are subscribed
  // directly through window.channelBridge and only publish when something
  // happens, so they are deliberately not declared as required inputs.
  channels: [
    'lap-times.snapshot',
    'lap-history.snapshot',
    'standings.snapshot',
    'track-state.snapshot',
    'radio.snapshot',
  ],
  // 5 Hz - the supported sortable rate for standings.
  ratePreset: 'gapTiming',
  channelRates: {
    // Only read for the replay flag and display units, neither of which needs
    // to be sampled at the standings rate.
    'track-state.snapshot': 1,
    // Subscribed transitively by useDriverStandings; Gantry never renders it.
    'radio.snapshot': 1,
    // Publishes on version change, so this only caps the worst case. A 60-car
    // field completes a lap about 0.6 times a second.
    'lap-history.snapshot': 2,
  },
} satisfies WidgetRuntimeDefinition;
