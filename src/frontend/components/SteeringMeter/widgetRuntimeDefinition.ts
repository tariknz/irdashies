import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'steeringmeter',
  sessionData: true,
  channels: [
    'driver-controls.snapshot',
    'car-condition.snapshot',
    'track-state.snapshot',
  ],
  ratePreset: 'driverFocused',
  channelRates: { 'driver-controls.snapshot': 60 },
} satisfies WidgetRuntimeDefinition;
