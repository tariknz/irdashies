import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'input',
  sessionData: true,
  channels: ['driver-controls.snapshot', 'track-state.snapshot'],
  ratePreset: 'driverFocused',
  channelRates: { 'driver-controls.snapshot': 60 },
} satisfies WidgetRuntimeDefinition;
