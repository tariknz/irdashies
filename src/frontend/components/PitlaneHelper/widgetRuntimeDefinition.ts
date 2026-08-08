import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'pitlanehelper',
  legacyTelemetry: false,
  sessionData: true,
  pitLaneData: true,
  channels: ['driver-controls.snapshot', 'track-state.snapshot'],
  ratePreset: 'driverFocused',
  channelRates: { 'driver-controls.snapshot': 60 },
} satisfies WidgetRuntimeDefinition;
