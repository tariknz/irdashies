import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'damage',
  sessionData: true,
  channels: [
    'car-condition.snapshot',
    'driver-controls.snapshot',
    'track-state.snapshot',
  ],
  ratePreset: 'driverFocused',
} satisfies WidgetRuntimeDefinition;
