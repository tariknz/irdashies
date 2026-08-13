import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'deltaspeed',
  // DriverInfo.DriverCarIdx, to pick the player's own session-best lap.
  sessionData: true,
  channels: ['reference-laps.snapshot', 'track-state.snapshot'],
  ratePreset: 'static',
  // The bar animates against live speed, so it wants track-state at the
  // channel's ceiling rather than the informational default.
  channelRates: { 'track-state.snapshot': 25 },
} satisfies WidgetRuntimeDefinition;
