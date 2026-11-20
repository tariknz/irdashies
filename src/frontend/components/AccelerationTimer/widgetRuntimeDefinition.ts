import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'accelerationtimer',
  sessionData: true,
  channels: [
    'car-dynamics.snapshot',
    'driver-controls.snapshot',
    'track-state.snapshot',
  ],
  ratePreset: 'driverFocused',
  channelRates: { 'car-dynamics.snapshot': 60 },
} satisfies WidgetRuntimeDefinition;
