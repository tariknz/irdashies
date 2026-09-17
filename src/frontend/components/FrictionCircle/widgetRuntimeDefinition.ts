import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'frictioncircle',
  channels: ['driver-controls.snapshot'],
  ratePreset: 'driverFocused',
  channelRates: { 'driver-controls.snapshot': 60 },
} satisfies WidgetRuntimeDefinition;
