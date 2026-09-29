import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'radar',
  sessionData: true,
  // Positions come from radar.snapshot; the side-overlap bars take the sim's
  // own CarLeftRight verdict from blind-spot.snapshot, because a car placed
  // from lap distance cannot tell which side of the player another car is on.
  channels: ['radar.snapshot', 'blind-spot.snapshot'],
  ratePreset: 'driverFocused',
  channelRates: { 'radar.snapshot': 25, 'blind-spot.snapshot': 25 },
} satisfies WidgetRuntimeDefinition;
