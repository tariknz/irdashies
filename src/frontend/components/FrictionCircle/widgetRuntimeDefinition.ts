import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'frictioncircle',
  sessionData: true,
  channels: ['car-dynamics.snapshot', 'track-state.snapshot'],
  ratePreset: 'driverFocused',
  channelRates: { 'car-dynamics.snapshot': 60 },
} satisfies WidgetRuntimeDefinition;
